// ADR-0010, FRESCO-243: pure mapping of the check_and_increment_rate_limit
// RPC's boolean result to the 429 response. Kept out of index.ts so it is
// testable with bun:test without importing index.ts itself (which calls
// Deno.serve() at module scope and cannot run under bun test) — same
// "extract the pure logic" pattern as menu-selector.ts / prompt.ts.

import { assertRateLimitAllowed as assertRateLimitAllowedShared } from '../_shared/rate-limit.ts'

const GENERATION_LIMIT_MESSAGE = 'Límite de generación alcanzado, inténtalo de nuevo en unos minutos'

/**
 * Throws a 429 HttpError unless the rate-limit RPC explicitly reported
 * `true` (fail-closed, ADR-0010 Decision 2). The verdict logic is the shared
 * one in `_shared/rate-limit.ts`; this wrapper only pins the generation-
 * specific message.
 */
export function assertRateLimitAllowed(allowed: boolean | null | undefined): void {
  assertRateLimitAllowedShared(allowed, GENERATION_LIMIT_MESSAGE)
}
