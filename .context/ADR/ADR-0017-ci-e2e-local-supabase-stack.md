# ADR-0017 — CI e2e runs against an ephemeral local Supabase stack, not the prod project

- **Status:** Accepted <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-08-30
- **Deciders:** Basi Montes
- **Tags:** testing, e2e, ci, infrastructure, cross-cutting-invariant
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Until now the `e2e` job in `.github/workflows/pr-check.yml` ran the Playwright/BDD
suite against the **shared production Supabase project** (`jdqemhewjrjuopssdurn`),
fed in via `secrets.ENV_FILE`. Every pull request's e2e run therefore:

- **mutated production data** — `reseedCurrentWeekPlan()` deletes and regenerates
  the QA user's `meal_plans`; `@suscripcion` steps do service-role writes to
  `user_profiles.plan`; edge-function calls (`generate-meal-plan`,
  `generate-shopping-list`) wrote real rows;
- **could not run concurrently** — two overlapping PR runs raced on the same
  rows, so FRESCO-289 added a single fixed `concurrency` group
  (`e2e-shared-supabase-backend`) that forced every PR's e2e job to queue
  one-behind-another;
- **had no coverage that the migrations still apply from scratch** — prod was
  migrated once and never rebuilt, so a broken migration only surfaced at
  deploy time.

`public.recipes` (the 1000-row recipe catalog) was additionally never created by
a migration: it was stood up on prod by a hand-run `schema_supabase.sql` before
the tracked migration history began, and every later migration only `ALTER`s it.
`supabase db reset` against an empty database failed at migration #1.

FRESCO-307 / FRESCO-310 (the "CI writes to prod Supabase with real keys" tech
debt) called for isolating the suite. The Supabase CLI can stand up the whole
backend (Postgres + GoTrue + PostgREST + Edge Runtime) locally in a GitHub
Actions job — Docker is preinstalled on `ubuntu-latest`.

## Decision

We will **run the PR `e2e` job against an ephemeral local Supabase stack started
inside the job**, never against a hosted project.

The `e2e` job now, in order:

1. `supabase/setup-cli@v1` (pinned `version: 2.109.1`) → `supabase start`.
2. `supabase db reset` — rebuilds the database from every migration, then loads
   `supabase/seed.sql` (recipe catalog + rate-limit exemption rows). **Any
   migration or seed error fails the job here** — this is now also the repo's
   only automated "migrations still apply cleanly" gate.
3. Restore `secrets.ENV_FILE` to `.env`, then append the committed `.env.ci`
   overlay so its local-stack values (Supabase's public `supabase-demo` demo
   constants — no real project access) win over the production ones. The
   overlay has to land **in `.env`** because `bun run test:e2e` re-sources
   `.env` itself in a subshell that never sees `$GITHUB_ENV`.
4. `bun scripts/seed-e2e-users.ts` — creates the two fixed accounts the suite
   logs in as against the local GoTrue admin API. The script hard-refuses any
   non-localhost `SUPABASE_URL`.
5. An **outbound-isolation guard** step: sources the final `.env` and fails the
   job if any of `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` /
   `NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL` / the anon / service-role keys still
   contains `jdqemhewjrjuopssdurn`, `supabase.co` or `supabase.in`, or if
   `NEXT_PUBLIC_SUPABASE_URL` is not the `127.0.0.1:54321` local stack.
6. Existing build + `bun run start` + `bun run test:e2e`, unchanged.
7. `supabase stop` with `if: always()`.

Supporting pieces (landed on the same branch):

- **Two baseline migrations** — `20260725110000_baseline_recipes_catalog.sql`
  reconstructs `public.recipes` (14 pre-migration columns, both original RLS
  policies, the 6 original GIN indexes, the `updated_at` trigger, `pg_trgm`,
  **and the base `GRANT SELECT` to `anon` + `authenticated`** that the manual
  `schema_supabase.sql` had) and `20260725110001_baseline_rls_auto_enable.sql`.
  Both sort before every existing migration, are fully idempotent, and are
  **`migration repair --status applied`'d on prod so they never execute
  there** — prod's schema already exists.
- **`public.rate_limit_exempt_users`** (migration
  `20260830142702_rate_limit_exempt_via_config_table.sql`, supersedes the
  hardcoded-array `20260827215620`): the rate-limit exemption list is now
  **data**, not a UUID array baked into the `SECURITY DEFINER`
  `check_and_increment_rate_limit` body, so an ephemeral CI stack can register
  its own seeded user UUIDs. The 4 production test-account UUIDs are carried
  into the table as a guarded data insert (`where exists (… auth.users …)`),
  so prod `@smoke` keeps its exemption and the insert is a no-op on a fresh
  local database.

The `e2e-shared-supabase-backend` concurrency group is **retained on the PR job
for now** only because `post-deploy-smoke.yml` still shares it (that workflow
runs `@smoke` against the real prod backend and must not overlap a mutation).
Now that PR runs are isolated, dropping the group from the PR job is safe and is
tracked as a follow-up.

## Consequences

- **Positive:**
  - PRs never touch production Supabase again — no data churn, no shared-state
    races, no real API keys required for the suite's own backend.
  - `supabase db reset` in CI is a free regression gate that every migration
    still applies from an empty database and the seed still loads.
  - PR e2e runs are now independent; once the shared concurrency group is
    dropped they can run fully in parallel across PRs.
  - The rate-limit exemption is inspectable data in one table instead of a
    literal buried in a `SECURITY DEFINER` function.
- **Negative / trade-offs:**
  - The job is slower: `supabase start` pulls / boots ~10 container images
    (cold ≈ +3–4 min, warm ≈ +1–2 min) and `db reset` replays ~62 migrations.
  - `supabase/seed.sql` carries a ~1–3 MB generated recipe-catalog fixture in
    the repo.
  - Two schema realities to keep honest: the migration set (local truth) and
    the hand-built prod schema. The baseline migrations paper over the gap but
    must stay in sync with prod by inspection — they are `repair`'d, not run,
    on prod, so a divergence there is silent.
  - The demo `supabase-demo` JWTs are pinned in `.env.ci`; a future CLI upgrade
    that rotates them needs `.env.ci` refreshed (verify against
    `supabase status -o env`).
- **Neutral / follow-ups:**
  - **`package.json` `db:types` still targets `--project-id jdqemhewjrjuopssdurn`**
    (the hosted project). Switching it to `--local` against the CI stack, and
    gating "generated types are in sync" in CI, is a separate task.
  - **A second hosted Supabase project for a real staging environment** remains
    an open sub-task — this ADR isolates *CI*, not the `fresco-pre` deploy.
  - Drop `e2e-shared-supabase-backend` from the PR `e2e` job once
    `post-deploy-smoke.yml` no longer needs a shared serialization point.
  - ~~Post-merge manual step: `supabase migration repair --status applied
    20260725110000 20260725110001` and `supabase db push` for the rate-limit
    rework migration against prod~~ — done in FRESCO-310; the wider ledger
    reconciliation it exposed is done in FRESCO-325 (see "Update — 2026-08-30").
  - Two pre-existing defects had to be fixed for the suite to boot against the
    local Edge Runtime and local Postgres: an extensionless
    `./meal-plan.types` import in `api/schemas/shopping-list.types.ts` (Deno
    requires the `.ts` extension; every sibling import already had it), and the
    missing `GRANT SELECT` on `public.recipes` noted above. Neither changes
    prod behaviour.

## Alternatives considered

- **A dedicated second hosted Supabase project for CI** — rejected for now:
  recurring cost, still a shared mutable backend across concurrent PR runs
  (the FRESCO-289 problem moves, it doesn't disappear), and it needs its own
  migration-deploy pipeline. Still the right answer for a real *staging*
  environment, tracked separately.
- **Supabase Branching** (per-PR ephemeral hosted databases) — rejected:
  requires the Supabase Pro plan (from $25/mo) and only covers the database,
  not the Edge Runtime the suite exercises over HTTP.
- **Keep the shared prod backend, lean harder on per-test data factories**
  (FRESCO-308 direction) — rejected as the primary fix: factories give
  per-test *data* isolation but PRs would still write to production and still
  need the serialization group; it does not address "CI mutates prod".

## Update — 2026-08-30 (FRESCO-325): prod ledger reconciled

The "two schema realities" trade-off above surfaced as real drift the moment
FRESCO-310's rate-limit migration was applied to prod:
`supabase migration list --linked` showed **54 local-only / 49 remote-only / 8
synced**. The prod *schema* was correct (`supabase db diff --linked` →
`No schema changes found`, and the full 62-migration chain replays to an
identical schema) — only the ledger was fiction, because local files use round
timestamps (`20260725120000`) and the remote `schema_migrations` rows use real
apply timestamps (`20260726083124`). `supabase db push` was unusable: it would
try to replay ~54 migrations already present in prod.

FRESCO-325 reconciled it, ledger-only, no DDL:

- **52 local-only files → `supabase migration repair --linked --status applied`**
  (the 51 pre-`20260830142702` files whose effect the empty `db diff` proves is
  already in prod, plus `20260830142702` itself — its ledger entry had been
  written by MCP `apply_migration` under the real timestamp `20260830152350`, so
  the file was orphaned like the rest).
- **50 remote-only entries → `supabase migration repair --linked --status
  reverted`.** These are the real-timestamp duplicates of local migrations plus
  a handful of genuinely file-less historical applies. Their schema effect stays
  in prod; they are **accepted as lost history** and deliberately marked
  reverted so `db push` ignores them (it hard-errors on unknown remote entries,
  it does not skip them).

After reconciliation: `migration list --linked` = **0 / 0 / 62**, and
`supabase db push --linked --dry-run` = `Remote database is up to date`.
**`supabase db push` is the supported path for prod schema changes again** —
MCP `apply_migration` / `execute_sql` against prod should be a last resort, and
each use re-introduces a remote-only ledger entry.

Prevention: `scripts/check-migration-drift.ts` +
`.github/workflows/migration-drift-check.yml` — a weekly scheduled job (not in
the PR pipeline, to keep prod credentials off that path) that fails and opens a
`migration-drift` issue if `migration list --linked` shows any local-only or
remote-only entry.

## References

- FRESCO-307 / FRESCO-310 — "CI e2e writes to prod Supabase with real keys" tech debt
- FRESCO-325 — prod migration ledger reconciliation (see "Update — 2026-08-30" above); `scripts/check-migration-drift.ts`, `.github/workflows/migration-drift-check.yml`
- FRESCO-289 — the `e2e-shared-supabase-backend` concurrency group (stop-gap this supersedes for PR runs)
- FRESCO-308 — per-test Supabase Auth user factories (`tests/test-user-factory.ts`)
- FRESCO-311 — why the `e2e` job stays PR-only (`push`-trigger gate)
- [ADR-0014](./ADR-0014-testing-architecture-playwright-bdd.md) — testing architecture stays `playwright-bdd`; this ADR changes the *backend* the suite runs against, not the suite's architecture
- [ADR-0005](./ADR-0005-deterministic-menu-slot-selection.md) — deterministic menu selection (no Gemini in the e2e path, so no AI key needed locally)
- [ADR-0010](./ADR-0010-postgres-atomic-counter-rate-limiting.md) — the rate-limit table this reworks the exemption list for
- `.github/workflows/pr-check.yml` — the rewritten `e2e` job
- `.github/workflows/post-deploy-smoke.yml` — shares the retained concurrency group
- `supabase/config.toml`, `supabase/seed.sql`, `.env.ci`, `scripts/seed-e2e-users.ts`
- `supabase/migrations/20260725110000_baseline_recipes_catalog.sql`, `20260725110001_baseline_rls_auto_enable.sql`, `20260830142702_rate_limit_exempt_via_config_table.sql`
