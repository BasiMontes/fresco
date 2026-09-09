# ADR-0026 — DB-integration test layer runs against the Supabase CLI local stack, in its own CI job

- **Status:** Proposed <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-09-09
- **Deciders:** Basi Montes
- **Tags:** testing, security, rls, ci, cross-cutting-invariant
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Every test that touches the data layer is mocked — `reassign-guest-data/index.test.ts`,
`lib/api/meal-plan.test.ts`, `app/api/stripe/portal/route.test.ts`, and the rest
stub `db.rpc` / the PostgREST client. There was not one test executing a real
query.

`.agents/skills/sprint-development/references/rpc-authorization.md` §5 is explicit
that this is a gap with teeth: a `SECURITY DEFINER` function bypasses RLS, so its
`WHERE` clause is a *selection filter*, not an authorization check, and the only
proof the actor bind actually fires is a test that **attempts the spoof against a
real database**. A mocked call cannot exercise the guard. Audit-4 found real
bypasses of exactly this class — FRESCO-360 (`user_profiles` INSERT self-grant of
Pro), FRESCO-361 / FRESCO-362 (edge-function allergen / whitelist re-filters).

The infrastructure to run against a real backend already exists: ADR-0017 stands
up the whole Supabase stack (Postgres + GoTrue + PostgREST + Edge Runtime)
locally inside a GitHub Actions job for the `e2e` suite, and ADR-0018 fixed the
constraint that governs that job — its **wall-clock is the binding limit**, so
new coverage must not be bolted onto it.

## Decision

We will add a **DB-integration test layer** at `tests/db/`, run by `bun test`
against a **real Postgres — the Supabase CLI local stack only, never a hosted
project** — and gated into its **own CI job (`db-integration`)**, parallel to
`unit` / `deno` and never part of `e2e`.

Invariants this establishes:

1. **Local stack only.** `tests/db/harness.ts` pins the base URL to
   `127.0.0.1:54321` and `assertLocalStack()` throws on any other host. The
   harness creates and deletes GoTrue auth users; it must never be able to reach
   a shared database. Same last-line-of-defence shape as
   `scripts/seed-e2e-users.ts`. Credentials are Supabase's public
   `supabase-demo` demo constants, read from the committed `.env.ci` — no
   hosted-project key is in scope.
2. **Opt-in, isolated from the default suite.** Every file guards its `describe`
   with `describe.skipIf(!(process.env.RUN_DB_INTEGRATION === '1' &&
   stackReachable()))`. A bare `bun test` and `bun run test:coverage` skip the
   layer; only `bun run test:db` runs it. `tests/` is already outside the
   coverage ratchet, so the floor is untouched.
3. **Separate CI job, off the `e2e` critical path.** The `db-integration` job
   does its own `supabase start` + `supabase db reset` + `bun run test:db` +
   `supabase stop`. It carries no secrets, so it runs on `push` as well as
   `pull_request` (same triggers as `unit`). It never runs inside `e2e` and adds
   nothing to that job's wall-clock (ADR-0018).
4. **Cleanup by cascade.** Mirrors `tests/test-user-factory.ts`: create an auth
   user, seed rows under its id, delete the auth user in teardown —
   `ON DELETE CASCADE` back to `auth.users.id` / `user_profiles.id` removes
   everything, pass or fail.

The first tests shipped with the layer: a spoof test for every `SECURITY
DEFINER` function in `public` that takes a caller-supplied identity/scope
parameter, and a cross-user RLS-denial test for every user-data table.

## Consequences

- **Positive:**
  - The `rpc-authorization.md` §5 obligation is met with a runnable artifact,
    not a promise — the actor binds on all 13 in-scope `SECURITY DEFINER`
    functions are now exercised against real Postgres, and every user-data
    table has a real cross-user denial test.
  - A regression that weakens an RLS policy or drops an actor bind fails a fast,
    secret-free job on every PR and every push.
  - New security-sensitive DB work (a new RPC, a new table) has an obvious,
    cheap place to add its proof.
  - `supabase db reset` in this job is a second "migrations still apply from
    empty" gate alongside `e2e`.
- **Negative / trade-offs:**
  - A third CI job that boots the ~7-container Supabase stack (cold ≈ +2–4 min).
    It runs in parallel, so it adds runner-minutes, not perceived latency, and
    it deliberately does not reuse `e2e`'s stack (that would couple the two
    jobs' timing — the thing ADR-0018 forbids).
  - happy-dom, registered globally for component tests (ADR-0024), replaces
    `fetch` with an XHR impl that blocks the plain-HTTP local stack as mixed
    content. `bun-test-setup.ts` stashes the native `fetch` before the swap and
    the harness reads it back — a small, documented coupling between the two
    test layers' setup.
  - The harness is a second HTTP client for Supabase in the repo (plain `fetch`,
    not `@supabase/supabase-js`, not Playwright's `APIRequestContext`), chosen
    so it needs no new dependency and gives exact control over PostgREST error
    codes.
- **Neutral / follow-ups:**
  - The edge-function HTTP negative contract (401 / 400 / 403 / 429 / 422 for
    the 6 functions) is the sibling of this work and ships as PR2 of FRESCO-464 —
    same harness, HTTP layer instead of the DB layer.
  - Observation, not in scope here: `service_role` lacks `SELECT` on
    `public.meal_plans` (and likely other tables) on the local stack — the
    baseline `GRANT` only covered `anon` / `authenticated`. The harness works
    around it by verifying "row unchanged" through the owner's own token, which
    is the stronger check anyway.

## Alternatives considered

- **Fold the DB-integration tests into the existing `e2e` job** (reuse its
  already-running stack) — rejected: it couples the new layer's runtime to the
  e2e job's wall-clock, which ADR-0018 names as the one budget that must be
  protected. A slow DB test would then be indistinguishable from e2e slowness.
- **Keep mocking, lean on pgTAP** (`supabase/tests/*.sql`, already wired into
  the `e2e` job) — rejected as the primary path: pgTAP runs as `postgres`
  (superuser, `bypassrls`), so it cannot reproduce the "signed-in user B calls
  through PostgREST with B's JWT" path that the actor-bind bug lives in. pgTAP
  stays for pure in-database logic (the FRESCO-381 learning-trigger test); it is
  the wrong tool for an authorization spoof.
- **`@supabase/supabase-js` for the harness** instead of raw `fetch` — rejected:
  the client abstracts away the HTTP status and PostgREST error `code`
  (`P0001` vs `42501`) that the assertions hinge on, and it is a heavier
  dependency for no gain at this size.
- **A dedicated hosted CI database** — rejected for the same reasons as ADR-0017:
  cost, shared mutable state across concurrent runs, and a separate
  migration-deploy pipeline.

## References

- FRESCO-464 — this work (PR1: DB layer; PR2: edge-function HTTP contract)
- `.agents/skills/sprint-development/references/rpc-authorization.md` §5 — the doctrine this satisfies
- [ADR-0017](./ADR-0017-ci-e2e-local-supabase-stack.md) — the local-stack-in-CI pattern this reuses
- [ADR-0018](./ADR-0018-e2e-test-architecture-revisit-threshold.md) — e2e wall-clock is the binding constraint; why this is a separate job
- [ADR-0024](./ADR-0024-component-test-infra-happy-dom-rtl.md) — the happy-dom global registration the harness works around for `fetch`
- FRESCO-360 / FRESCO-361 / FRESCO-362 — audit-4 RLS / re-filter bypasses that motivate the layer
- `tests/db/README.md`, `tests/db/harness.ts`, `.github/workflows/pr-check.yml` (`db-integration` job)
