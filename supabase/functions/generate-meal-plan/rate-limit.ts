// ADR-0010, FRESCO-243: pure mapping of the check_and_increment_rate_limit
// RPC's boolean result to the 429 response. Kept out of index.ts so it is
// testable with bun:test without importing index.ts itself (which calls
// Deno.serve() at module scope and cannot run under bun test) — same
// "extract the pure logic" pattern as menu-selector.ts / prompt.ts.

import { HttpError } from '../_shared/http.ts'

/**
 * Throws a 429 HttpError unless the rate-limit RPC explicitly reported
 * `true`. Treating anything other than `true` (including `null`/`undefined`,
 * which index.ts never passes here after its own error check, but a caller
 * of this function might) as blocked is deliberate fail-closed behavior
 * (ADR-0010 Decision 2, matching this file's existing fail-fast convention
 * for profileError/recipesError/planError/slotsError) — an ambiguous result
 * never silently lets a request through.
 */
export function assertRateLimitAllowed(allowed: boolean | null | undefined): void {
  if (allowed !== true) {
    throw new HttpError('Límite de generación alcanzado, inténtalo de nuevo en unos minutos', 429)
  }
}
