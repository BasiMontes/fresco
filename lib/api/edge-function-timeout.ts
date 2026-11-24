/**
 * FRESCO-1249 — the time limit of the client's Edge Function calls, and what the person sees when one runs out.
 *
 * The chaos experiments (FRESCO-1248) showed that a call to a function that does not answer never fails: it hangs
 * until the browser gives up. The limits below are ceilings, not measurements: the chaos only runs on the local
 * stack and the hosted environment has not been timed.
 *
 * A timeout aborts the CLIENT, never the server, so the work may still land afterwards. That is why a timed-out
 * generation tells the person it may already exist, and why a timed-out account deletion never invites a blind
 * retry.
 */

/** What a function gets unless it has its own entry. Reads, marks and small writes answer in milliseconds. */
const DEFAULT_TIMEOUT_MS = 15_000;

/** `NFR-PERF-1`: menu generation completes in under 30 seconds, and the real time is far below it. */
const GENERATION_TIMEOUT_MS = 30_000;

/**
 * `delete-account` ends the Stripe billing, asks PostHog to erase the person and then deletes the user, so it is
 * given the same room as a generation.
 */
const DELETE_ACCOUNT_TIMEOUT_MS = 30_000;

const TIMEOUT_MS_BY_FUNCTION: Readonly<Record<string, number>> = {
  'generate-meal-plan': GENERATION_TIMEOUT_MS,
  'delete-account': DELETE_ACCOUNT_TIMEOUT_MS,
};

export function timeoutMsFor(functionName: string): number {
  return TIMEOUT_MS_BY_FUNCTION[functionName] ?? DEFAULT_TIMEOUT_MS;
}

/** The function did not answer within its limit. The request may still be running on the server. */
export class EdgeFunctionTimeoutError extends Error {
  constructor(
    public readonly functionName: string,
    public readonly timeoutMs: number,
  ) {
    super(`Edge Function ${functionName} did not answer within ${timeoutMs} ms`);
    this.name = 'EdgeFunctionTimeoutError';
  }
}

/** Reads, marks and small writes: nothing to warn about beyond trying again. */
export const EDGE_FUNCTION_TIMEOUT_MESSAGE = 'Está tardando más de lo normal. Inténtalo de nuevo.';

/** A generation that timed out may have landed, so the person is told to reload rather than only to retry. */
export const GENERATION_TIMEOUT_MESSAGE = 'Está tardando más de lo normal. Puede que ya se haya generado: recarga la página.';

/** An irreversible operation that timed out: say what is unknown and how to find out, never "try again". */
export const DELETE_ACCOUNT_TIMEOUT_MESSAGE = 'No hemos podido confirmar el borrado. Inicia sesión para comprobar si tu cuenta sigue ahí.';

/** The message for a failed call: the shared timeout wording when it timed out, otherwise the caller's own. */
export function edgeFailureMessage(error: unknown, fallback: string): string {
  return error instanceof EdgeFunctionTimeoutError ? EDGE_FUNCTION_TIMEOUT_MESSAGE : fallback;
}
