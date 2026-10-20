// FRESCO-947 (follow-up to FRESCO-910, GDPR art. 17): retry the PostHog deletions that failed.
//
// `delete-account` erases the PostHog person after the auth user is gone. If that call fails the
// account is deleted anyway and `account_erasures` keeps the row as `posthog = 'failed'`, with the
// id in `pending_posthog_distinct_id` (the only place a user id outlives the account). This sweep
// takes those rows once a day, tries the deletion again, and:
//   * on success moves the row to `deleted` / `not_found` and clears the id in the same write (a
//     table constraint ties `failed` and the id together, so they can never be split);
//   * on failure counts the attempt and leaves the row as it was;
//   * past MAX_ATTEMPTS stops retrying but KEEPS the row and its id, and logs it: giving up
//     silently would lose the erasure, retrying forever would hide it.
//
// Triggered exclusively by pg_cron -> pg_net (ADR-0011, see the `retry_posthog_erasures`
// migration), never by a browser, so the caller must prove it is that job: `requireServiceRoleCaller`.
// It lives in an Edge Function and not in the Next.js reconcile cron because the PostHog
// credentials (`deletePostHogPerson`) are Function secrets that Vercel does not have.

import { requireServiceRoleCaller } from '../_shared/auth.ts'
import { jsonResponse, toErrorResponse } from '../_shared/http.ts'
import { recordJobHeartbeat } from '../_shared/job-heartbeat.ts'
import { logger } from '../_shared/logger.ts'
import { deletePostHogPerson } from '../_shared/posthog-erasure.ts'
import { createServiceRoleClient } from '../_shared/service-role-client.ts'

const FN_NAME = 'retry-posthog-erasures'

/** One try a day, so a row that keeps failing is given up on after ten days. */
const MAX_ATTEMPTS = 10
/** More failed rows than this in one pass is an incident, not a backlog; the rest wait for tomorrow. */
const BATCH_SIZE = 200
/** Edge Functions have a wall-clock limit and each PostHog call can take up to its own timeout. */
const BATCH_BUDGET_MS = 110_000

interface FailedErasureRow {
  id: string
  pending_posthog_distinct_id: string
  posthog_attempts: number
}

interface RetryPosthogErasuresResponse {
  attempted: number
  deleted: number
  still_failing: number
  gave_up: number
}

Deno.serve(async (req: Request) => {
  try {
    requireServiceRoleCaller(req)

    const serviceClient = createServiceRoleClient()
    // The Deno client is untyped: assert the row shape at the boundary.
    const { data, error: queryError } = await serviceClient
      .from('account_erasures')
      .select('id, pending_posthog_distinct_id, posthog_attempts')
      .eq('posthog', 'failed')
      .limit(BATCH_SIZE)
    if (queryError) throw queryError

    const failedRows = (data ?? []) as FailedErasureRow[]
    const retryable = failedRows.filter(row => row.posthog_attempts < MAX_ATTEMPTS)
    const exhausted = failedRows.length - retryable.length

    if (exhausted > 0) {
      // Row ids only: the erased user's id must not end up in the logs this table exists to avoid.
      logger.error('PostHog erasure retries exhausted, manual deletion needed', {
        fn: FN_NAME,
        rows: failedRows.filter(row => row.posthog_attempts >= MAX_ATTEMPTS).map(row => row.id),
        maxAttempts: MAX_ATTEMPTS,
      })
    }

    const summary: RetryPosthogErasuresResponse = { attempted: 0, deleted: 0, still_failing: 0, gave_up: exhausted }
    const startedAt = Date.now()
    let credentialsMissing = false

    for (const row of retryable) {
      if (Date.now() - startedAt > BATCH_BUDGET_MS) {
        logger.warn('Time budget spent, remaining rows wait for the next run', { fn: FN_NAME })
        break
      }
      summary.attempted++

      let outcome: Awaited<ReturnType<typeof deletePostHogPerson>>
      try {
        outcome = await deletePostHogPerson(row.pending_posthog_distinct_id)
      }
      catch (err) {
        summary.still_failing++
        logger.warn('PostHog erasure retry failed', {
          fn: FN_NAME,
          row: row.id,
          attempts: row.posthog_attempts + 1,
          error: err instanceof Error ? err.message : String(err),
        })
        await writeRow(serviceClient, row.id, {
          posthog_attempts: row.posthog_attempts + 1,
          posthog_last_attempt_at: new Date().toISOString(),
        })
        continue
      }

      if (outcome === 'not_configured') {
        // Missing credentials say nothing about this row, so no attempt is spent. Every other row
        // would hit the same wall, hence the early stop.
        summary.still_failing++
        logger.error('PostHog credentials are not configured, nothing was retried', { fn: FN_NAME })
        credentialsMissing = true
        break
      }

      summary.deleted++
      await writeRow(serviceClient, row.id, {
        posthog: outcome,
        pending_posthog_distinct_id: null,
        posthog_last_attempt_at: new Date().toISOString(),
      })
    }

    // FRESCO-1017: no heartbeat when the credentials are missing, that run did nothing useful.
    if (!credentialsMissing) await recordJobHeartbeat(serviceClient, FN_NAME, FN_NAME)

    return jsonResponse(summary, { req })
  }
  catch (err) {
    return toErrorResponse(err, { req, fnName: FN_NAME })
  }
})

/** `.eq('posthog', 'failed')` keeps two overlapping runs from both claiming the same row. */
async function writeRow(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  id: string,
  changes: Record<string, unknown>,
): Promise<void> {
  const { error } = await serviceClient
    .from('account_erasures')
    .update(changes)
    .eq('id', id)
    .eq('posthog', 'failed')
  if (error) {
    // The PostHog side already changed; surface it, the next run reconciles (deleting a person twice is a not_found).
    logger.error('Could not record the outcome of a PostHog erasure retry', { fn: FN_NAME, row: id, error: error.message })
  }
}
