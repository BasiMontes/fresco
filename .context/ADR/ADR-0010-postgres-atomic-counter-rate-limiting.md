# ADR-0010 — Rate limiting on Edge Functions via a Postgres atomic-counter table, no external dependency

- **Status:** Accepted
- **Date:** 2026-08-23 (drafted), 2026-08-27 (accepted)
- **Deciders:** Founder (product + technical decision, drafted by AI workflow for approval)
- **Tags:** security, abuse-control, edge-functions, cross-cutting-invariant, database
- **Supersedes:** —
- **Superseded by:** —

---

## Context

`generate-meal-plan` (Supabase Edge Function) is reachable by any authenticated user with no limit on call frequency. Per ADR-0005, the function no longer calls Gemini for menu selection — it is fully deterministic — so the abuse surface is not LLM spend but Postgres read/write load: each call runs the `get_filtered_recipes` RPC against the recipe catalog, then (on success) inserts one `meal_plans` row and 21 `meal_plan_recipes` rows. A user (or script) hammering the endpoint, including via delete-then-regenerate cycles that bypass the existing one-plan-per-ISO-week check, can drive unbounded DB load with no product benefit to any legitimate user.

FRESCO-243 (tech-debt) flagged this gap. No prior ADR covers rate limiting or Edge Function abuse control (checked ADR-0001–0009). The founder confirmed two decisions directly, in-session, before this ADR was drafted: (1) mechanism — a Postgres counter table checked via an atomic RPC, not an external service like Upstash/Redis, matching the project's existing preference for zero new external dependencies (ADR-0005's own removal of the Gemini hard-dependency is the same instinct applied here); (2) threshold — 5 requests per user per rolling hour, fixed-window.

This function is very likely not the last Edge Function that will need abuse control as the product surface grows (any future user-triggered generation/write-heavy endpoint has the same shape of risk), which is why this is being raised as a reusable pattern decision rather than a one-off fix scoped only to `generate-meal-plan`.

## Decision

**We will rate-limit abuse-prone Edge Functions using a shared Postgres table plus an atomic, single-round-trip `check_and_increment_rate_limit` Postgres function — never an external rate-limiting service, and never a check implemented as two separate read-then-write round trips from the Edge Function.**

Concretely:
- A single `rate_limits` table (not per-function tables) keyed by `(user_id, endpoint, window_start)`, so the same mechanism serves any future Edge Function by passing a different `endpoint` value — this is the reusability contract the pattern exists to provide.
- The check-and-increment happens in **one atomic Postgres function** (`check_and_increment_rate_limit(p_user_id uuid, p_endpoint text, p_limit int, p_window_seconds int) returns boolean`), called once via `supabase.rpc(...)`. This is the invariant every adopting function must uphold: **never** read the current count in one round trip and write the increment in a second — that gap is exactly what lets two concurrent requests both observe `count = 4` and both proceed, defeating the limit under real concurrency (which is precisely the abuse case this exists to stop).
- The check runs as early as reasonably possible in the function — after auth (so the limit is per authenticated user, not per anonymous caller) but before any expensive read/write work, so a rate-limited caller gets a fast `429` instead of paying the cost the limit exists to prevent.
- Fixed-window (not sliding-window): the window resets on the hour boundary rather than continuously. This is a deliberate simplicity trade-off (see Consequences) — acceptable because 5 req/hour is generous for a legitimate 1-plan-per-week workflow and the goal is stopping abuse, not precisely smoothing legitimate burst traffic.

## Consequences

**Positive:**
- Zero new external dependencies, zero new credentials to manage in `.env`, no new vendor cost line — consistent with the project's existing bias (ADR-0005) toward removing rather than adding external service dependencies.
- The pattern is reusable by construction: any future Edge Function adopts it by calling the same RPC with its own `endpoint` string and calling it early in its handler — no new table, no new migration, no bespoke logic per function.
- Atomicity is enforced at the database layer (a single Postgres function call), not by application-layer discipline the Edge Function code has to remember to get right on every call site — removes an entire class of race-condition bugs by construction, the same "unreachable by construction" philosophy ADR-0005 already established for menu-slot validity.

**Negative / trade-offs:**
- Fixed-window rate limiting allows a burst-at-the-boundary pattern (e.g. 5 requests just before the hour rolls over, 5 more just after) that a sliding window would smooth out. Accepted as out of scope for this decision given the traffic pattern this endpoint actually sees (product-normal use is ~1 call/week per user).
- Every Postgres-backed Edge Function invocation now costs one extra RPC round-trip (the atomic check) before doing its real work — a small, constant latency tax on every call, including legitimate ones under the limit.
- The `rate_limits` table needs its own retention/cleanup story (old `window_start` rows accumulate indefinitely otherwise) — solved at acceptance by the `pg_cron` sweep in the migration (see follow-ups).

**Neutral / follow-ups:**
- Retention IS handled here (added at acceptance, 2026-08-27): the migration schedules a `cleanup-expired-rate-limits` `pg_cron` job (daily `03:15`) that deletes rows whose `window_start` is more than 2 hours stale — reusing the exact `pg_cron` pattern from the guest-cleanup job (FRESCO-238). A window older than the current hour can never be re-hit, so the 2-hour margin is pure safety.
- If a future Edge Function's legitimate traffic pattern genuinely needs sliding-window precision (not just "some abuse control"), that is a new decision to make at that time, not an automatic upgrade of this table — this ADR only commits to the fixed-window, single-table, atomic-RPC shape.
- Threshold (5/hour) and window (fixed hour) are `generate-meal-plan`-specific product decisions, stored as RPC call parameters, not hardcoded into the shared mechanism — future adopting functions choose their own values.

## Alternatives considered

- **External rate-limiting service (Upstash Redis or similar).** Rejected: adds a new vendor dependency, a new credential to manage, and recurring cost, for a rate-limiting need this project's traffic volume does not require the precision or throughput of a dedicated KV store to solve. Directly weighed against the Postgres option with the founder; Postgres was chosen explicitly.
- **In-memory / Deno KV counter inside the Edge Function.** Rejected without formal weighing: Supabase Edge Functions are stateless per invocation (cold starts, no guaranteed instance affinity), so an in-process counter would not persist reliably across calls — it would appear to work in light testing and silently fail to limit anything under real traffic, which is worse than no rate limiting at all because it creates false confidence.
- **Read-then-write check from the Edge Function (two round trips, no atomic RPC).** Rejected: race-prone under concurrent requests from the same user, which is exactly the abuse scenario (a script firing several requests near-simultaneously) this decision needs to hold against. The atomic single-RPC design specifically closes this gap.

## References

- `.context/PBI/tech-debts/TECHDEBT-FRESCO-243-rate-limiting-en-generacion-de-menu-semanal/` — the tech-debt ticket and Stage 1 implementation plan (posted as a Jira comment; the `spec_implementation_plan` field rejected the payload at its 255-char cap) this ADR was drafted alongside.
- `.context/ADR/ADR-0005-deterministic-menu-slot-selection.md` — establishes both the "remove external hard-dependencies where possible" instinct and the "make invariants unreachable-by-construction" philosophy this ADR extends to rate limiting.
- `supabase/functions/generate-meal-plan/index.ts` — the first adopting call site (`requireAuthenticatedUser` → rate-limit check → existing logic).
- `supabase/migrations/20260827210808_add_rate_limits_table_and_check_function.sql` — the `rate_limits` table, the atomic RPC, and the `cleanup-expired-rate-limits` `pg_cron` sweep.
- `supabase/migrations/20260823120000_enable_pg_cron_cleanup_abandoned_guest_users.sql` (FRESCO-238) — the `pg_cron` pattern the retention sweep reuses.
