# `tests/db/` — DB-integration tests

`bun test` against a **real Postgres** (the Supabase CLI local stack), not e2e,
not mocked. This is the project's first test layer that executes the actual
database path.

It exists to satisfy
`.agents/skills/sprint-development/references/rpc-authorization.md` §5: a
`SECURITY DEFINER` function that takes a caller-supplied identity/scope
parameter needs a test that **attempts the spoof against the real database** — a
mocked `db.rpc` proves nothing about the function. Audit-4 found real RLS
bypasses of exactly this class (FRESCO-360, FRESCO-361, FRESCO-362).

## What's here

| File | Covers |
| --- | --- |
| `harness.ts` | Config, native-`fetch` PostgREST/GoTrue helpers, per-test auth-user factory with cascade cleanup. Talks **only** to `127.0.0.1:54321` — `assertLocalStack()` refuses any hosted host. `callFunction()` calls an Edge Function on the local Functions runtime over real HTTP, the same way `rpc()`/`rest()` call PostgREST. |
| `security-definer-spoof.test.ts` | Every `SECURITY DEFINER` function in `public` with an identity/scope param. User B, with B's own JWT, passes user A's id / row id and the test asserts the spoof is denied (raised exception, or a provably zero-row effect). Read functions also assert the legit call is scoped to B. |
| `rls-cross-user.test.ts` | Every user-data table. A seeds a row; B (own token, never service-role) attempts SELECT / UPDATE / DELETE / INSERT-for-A and a real denial is asserted. Verification of "row unchanged" is re-read through A's own token. |
| `supermarket-price-model.test.ts` | FRESCO-770. The supermarket price tables and `get_supermarket_prices` (`SECURITY INVOKER`, no identity parameter). Read for `authenticated`, writes denied to a real user token, anon denied on the RPC; the legal gate (`habilitada` needs a runnable permission with a cited reference) holds in the database; the chain seed matches `registroSupermercados`; the RPC never returns a pending or switched-off chain. |
| `supermarket-demand-rpc.test.ts` | FRESCO-770. `get_supermarket_demand`, the `SECURITY DEFINER` cross-user read behind the refresh's demand: refused to a signed-in user and to `anon`, returns slots still to buy per ingredient to `service_role`, aggregates only (no user, plan or slot id), no identity parameter. |
| `supermarket-price-store.test.ts` | FRESCO-770. The refresh runner's database side with a `service_role` client: initial load (idempotent, never overwrites a newer price), the write decision (date bump, history only on a change, older ignored), which products the plan may track, and the whole loop with a fake connector. |
| `meal-plan-recipes-integrity.test.ts` | FRESCO-776. The owner of a slot cannot PATCH `estado` / `rating` / `recipe_id` / `sustitucion_ingrediente` directly (`P0001`), and `apply_recipe_status_update` no longer exists for a client (404, row unchanged). The regression test audit-5 shipped without. |
| `meal-plan-insert-paths.test.ts` | FRESCO-777. `authenticated` cannot INSERT into `meal_plans` / `meal_plan_recipes` (permission denied, `42501`), including a forged slot (`estado: cocinada`, rating, substitution), and `shopping_lists` only accepts a `meal_plan_id` the caller owns on INSERT and UPDATE. Fixtures seed through the service-role path (`seedMealPlan`, `seedSlots`). |
| `push-subscriptions-validation.test.ts` | FRESCO-779. `push_subscriptions` only accepts https endpoints on real push services (FCM, Mozilla, Apple, WNS) and rejects look-alike hosts, userinfo, ports, plain http and over-long URLs; key material is bounded base64url; a user is capped at 10 subscriptions; a guest (anonymous) session cannot insert. The same vectors run through the TypeScript copy the weekly sender uses and the test fails if the two disagree. |
| `user-consents.test.ts` | FRESCO-794. `user_consents` (ADR-0040): the owner records `(kind, version)` and the database sets `user_id` and `accepted_at`; a caller cannot supply `user_id` (own or someone else's) or `accepted_at` (column-level INSERT grant, `42501`); no UPDATE, no DELETE, no reading another user's rows; CHECK on kind and version; unique `(user, kind, version)` is a no-op on `ignore-duplicates`; a guest records and reads their own; cascade on user delete. |
| `edge-functions/*.test.ts` | HTTP negative-contract tests (FRESCO-464 PR2) for all 8 Edge Functions (`generate-meal-plan`, `generate-shopping-list`, `reassign-guest-data`, `delete-account`, `update-recipe-status`, plus, from FRESCO-782, `delete-catalog-recipe`, `get-shopping-list-suggestions`, `send-weekly-reengagement-push`): 401 (missing/garbage token), 403 (`delete-catalog-recipe`, caller outside the admin allowlist), 429 (rate limit, pre-saturated via the same RPC the function calls), 400/404/409/422 body and ownership validation. `send-weekly-reengagement-push` only exercises its rejection paths (401 for anon key, garbage token and user JWT) because the happy path would send real notifications. Calls the real Functions runtime via `callFunction()` — never mocked. |

## Run it locally

```bash
supabase start          # if the stack isn't already up
supabase db reset        # fresh migrations + seed.sql (the 1000-recipe catalog)
bun run test:db          # = RUN_DB_INTEGRATION=1 bun test tests/db/
```

## Fail closed (FRESCO-781)

Skipping is only for a run that was never asked for. With `RUN_DB_INTEGRATION=1`
the harness retries the stack probe (5 attempts, 2 s apart) and then **throws**
(`refusing to skip the DB-integration suite silently`) instead of skipping, so a
stack that did not start can no longer turn the whole suite green with
`0 pass / N skip`. CI adds two more guards in the `test:db-integration` job: any
`skip` line in bun's summary fails it, and so does fewer than 147 passing tests
(raise the floor as tests are added). `tests/db/harness.unit.test.ts` pins the
policy without needing a stack.

## Isolation from the default `bun test`

Every file guards its `describe` with
`describe.skipIf(!(RUN_DB_INTEGRATION === '1' && stackReachable()))`. So:

- a bare `bun test` skips the whole suite;
- `bun run test:coverage` (the `unit` CI job) skips it — and `tests/` is already
  outside the coverage ratchet, so the floor is unaffected;
- only `bun run test:db` (which sets `RUN_DB_INTEGRATION=1`) runs it, and only
  when the local stack actually answers.

CI runs it in the dedicated **`db-integration`** job in
`.github/workflows/pr-check.yml` — parallel to `unit` / `deno`, never part of
`e2e` (ADR-0018: the e2e job's wall-clock is the binding constraint). No
secrets: local-stack demo keys only.

## Credentials

Supabase's public local-dev demo constants (`iss: supabase-demo`), read at
runtime from the committed `.env.ci`. No hosted-project keys, ever.

## Adding a test

- Get users from `createDbTestContext()` and wire `cleanupAll()` into `afterAll`.
- Seed A's data with A's own token (`rest(...)` / the `seed*` helpers). Deleting
  the auth user in teardown cascades everything away.
- For a spoof: call the function/table as B with A's identifier and assert the
  denial. If the guard raises, assert the code/message. If it silently filters,
  re-read as A and assert **nothing changed** — a 2xx with an empty body is not
  by itself proof.
