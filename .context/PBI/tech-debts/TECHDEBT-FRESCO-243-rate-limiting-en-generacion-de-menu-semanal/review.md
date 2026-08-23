# Review — FRESCO-243 (Rate limiting en generación de menú semanal)

Branch: `feat/FRESCO-243-rate-limiting-generacion-menu`
Reviewer: independent adversarial subagent (fresh context, no implementation stake)
Overall verdict from reviewer: **APPROVE WITH NITS**

## Findings + adjudication

| # | Tag | Finding | file:line | Adjudication | Action |
|---|-----|---------|-----------|---------------|--------|
| 1 | MAJOR | `p_window_seconds` accepted but silently ignored (hardcoded hour truncation) — correct today (only call site passes 3600) but a latent trap for the ADR's own declared reuse case | `supabase/migrations/20260823180000_add_rate_limits_table_and_check_function.sql:65` | **Legitimate** — verified: the ADR explicitly sells the table as reusable-by-construction for future Edge Functions, so a silently-ignored parameter contradicts that promise. | **Fixed** (commit `8d322a8`): function now raises if `p_window_seconds <> 3600`, so a mismatched future caller fails loudly instead of silently getting the wrong window. |
| 2 | MINOR | RPC directly callable via PostgREST by any authenticated user with attacker-chosen `p_limit`/`p_endpoint`/`p_window_seconds` | `supabase/migrations/20260823180000_add_rate_limits_table_and_check_function.sql:97` | **Legitimate but non-blocking** — reviewer walked the exploit path: no cross-user access (`auth.uid()` self-check) and no bypass of the real protection (the actual call site hardcodes `p_limit: 5` server-side, never client-derived). Worst case is self-inflicted early lockout. | Documented here; no code change. Accepted trade-off, matches this repo's existing `get_filtered_recipes` exposure pattern. |
| 3 | MINOR | No concurrency/race test exists for the atomic RPC (only the pure `assertRateLimitAllowed()` mapping is unit-tested) | `supabase/functions/generate-meal-plan/rate-limit.test.ts` | **Legitimate, accepted gap** — no local Docker/Supabase stack was available to build a real integration test; reviewer independently hand-verified the atomicity logic instead (see below) as compensating control. | No code change. Manual staging verification (see DoD below) must include a concurrent-request check, not just serial counting. |
| 4 | NIT | `// 1.5.` step numbering in `index.ts` is a first in this file (existing steps are integers 1–11) | `supabase/functions/generate-meal-plan/index.ts:45` | **Legitimate, trivial** — defensible (avoids renumbering 10 downstream comments for one inserted step) but sets a new local convention without precedent. | No code change. Noted for future readers. |

## Atomicity — independently hand-verified by the reviewer

Walked the `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE ... RETURNING` statement for the concurrency case (two simultaneous requests from the same user at count=4): Postgres's row-level lock on the conflicting key serializes the two writers, so the second one re-evaluates `WHERE count < p_limit` against the *post-first-writer* value — exactly one of the two succeeds. Boundary confirmed: call 5 succeeds (4→5), call 6 sees count=5, `5 < 5` is false, zero rows returned, `v_count` stays NULL, function returns `false`. No off-by-one, no read-then-write gap.

## Security — independently checked

- RLS enabled + zero policies + `REVOKE ALL` from `public`/`anon`/`authenticated` — deny-all at both layers.
- `SECURITY DEFINER` + `search_path = public` is safe here because every identifier in the function body is fully schema-qualified (`public.rate_limits`, `auth.uid()`) — no unqualified reference for a hijacked object to intercept.
- Byte-for-byte match of the pre-existing `get_filtered_recipes` SECURITY DEFINER pattern (`20260801010000_harden_security_definer_functions.sql`).
- Fully parameterized, no dynamic SQL / string concatenation.

## Fail-closed behavior — checked, consistent

`index.ts`'s `if (rateLimitError) throw new HttpError(..., 500)` matches this file's existing convention for every other RPC error in the same function (`profileError`, `recipesError`, `planError`, `slotsError` — all fail-fast, never silently continue).

## DoD — manual staging verification (required before Ready For QA)

- Fire 6 rapid sequential calls as the same test user; confirm the 6th returns 429, the first 5 succeed.
- Fire 2 concurrent calls near the boundary (count=4, i.e. calls 5 and 6 simultaneously); confirm exactly one gets a 429, not both succeeding or both blocked — this is the case a serial test alone cannot catch.
- Confirm the window resets after the hour boundary (or wait/verify with a manually-inserted past `window_start` row).
