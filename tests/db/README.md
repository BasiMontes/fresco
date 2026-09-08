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
| `harness.ts` | Config, native-`fetch` PostgREST/GoTrue helpers, per-test auth-user factory with cascade cleanup. Talks **only** to `127.0.0.1:54321` — `assertLocalStack()` refuses any hosted host. |
| `security-definer-spoof.test.ts` | Every `SECURITY DEFINER` function in `public` with an identity/scope param. User B, with B's own JWT, passes user A's id / row id and the test asserts the spoof is denied (raised exception, or a provably zero-row effect). Read functions also assert the legit call is scoped to B. |
| `rls-cross-user.test.ts` | Every user-data table. A seeds a row; B (own token, never service-role) attempts SELECT / UPDATE / DELETE / INSERT-for-A and a real denial is asserted. Verification of "row unchanged" is re-read through A's own token. |

## Run it locally

```bash
supabase start          # if the stack isn't already up
supabase db reset        # fresh migrations + seed.sql (the 1000-recipe catalog)
bun run test:db          # = RUN_DB_INTEGRATION=1 bun test tests/db/
```

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
