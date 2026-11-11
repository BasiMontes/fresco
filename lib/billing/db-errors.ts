/**
 * FRESCO-1160 (audit: PAY-N4, ADR-0062 follow-up) — which database failures are worth a retry.
 *
 * `isTransientStripeError` only reads Stripe's `type` / `statusCode`; a Supabase write that fails
 * (PostgREST 5xx, a dropped connection, a pool timeout) carries neither, so the webhook answered
 * 200 and Stripe never retried: a paid renewal or purchase stayed lost until the daily reconcile.
 * An outage passes by itself, so it is answered 5xx; a deterministic error (a constraint, a
 * policy, a bad value) would fail the same way again and stays a logged 200.
 */

/** PostgREST's own codes for "the database or its pool is not there right now" (PGRST000-003). */
const TRANSIENT_POSTGREST_CODES: ReadonlySet<string> = new Set(['PGRST000', 'PGRST001', 'PGRST002', 'PGRST003']);

/**
 * Postgres SQLSTATEs that pass on their own: class 08 (connection exception), 53 (insufficient
 * resources: disk, memory, too many connections), serialization failure, deadlock, lock not
 * available, admin shutdown / crash shutdown / cannot connect now, and a cancelled statement
 * (statement timeout).
 */
const TRANSIENT_SQLSTATES: ReadonlySet<string> = new Set(['40001', '40P01', '55P03', '57P01', '57P02', '57P03', '57014']);
const TRANSIENT_SQLSTATE_CLASSES: ReadonlyArray<string> = ['08', '53'];

/**
 * A failure that never reached Postgres has no code: supabase-js reports a failed `fetch` as
 * `TypeError: fetch failed` with an empty code, and a gateway in front of PostgREST answers its
 * own HTML page, which ends up as the message.
 */
const TRANSIENT_MESSAGE = /fetch failed|network|econnreset|econnrefused|etimedout|eai_again|socket hang up|timed out|timeout|aborted|bad gateway|service unavailable|gateway time-?out/i;

/** True for a Supabase / network failure that a later attempt may well get past. */
export function isTransientDatabaseError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { code, status, message } = error as { code?: unknown, status?: unknown, message?: unknown };

  if (typeof status === 'number' && (status >= 500 || status === 429)) {
    return true;
  }
  if (typeof code === 'string' && code !== '') {
    return TRANSIENT_POSTGREST_CODES.has(code)
      || TRANSIENT_SQLSTATES.has(code)
      || TRANSIENT_SQLSTATE_CLASSES.some(sqlstateClass => code.startsWith(sqlstateClass));
  }
  return typeof message === 'string' && TRANSIENT_MESSAGE.test(message);
}
