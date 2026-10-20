// FRESCO-1017 (A7-OPS-02): the Edge Functions that pg_cron fires write their own heartbeat once a
// whole pass has completed, for the same reason `stripe-reconcile` does (FRESCO-915): `net.http_post`
// only enqueues, so `cron.job_run_details` says `succeeded` even when the function answers 401.
// The Next.js side reads `job_heartbeat` through `/api/health/jobs`; the job names live in
// `lib/jobs/heartbeat.ts` (`JOB_STALE_AFTER_HOURS`) and must match.
//
// Utility convention (CLAUDE.md §10): silent-fail. A failed heartbeat write is logged and never
// fails the run it describes; the worst case is a false "stale" alert, which is the safe direction.

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger.ts'

export async function recordJobHeartbeat(client: SupabaseClient, job: string, fn: string): Promise<void> {
  try {
    const now = new Date().toISOString()
    const { error } = await client
      .from('job_heartbeat')
      .upsert({ job, last_success_at: now, updated_at: now }, { onConflict: 'job' })
    if (error) throw error
  } catch (err) {
    logger.error('Could not record the job heartbeat', {
      fn,
      job,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
