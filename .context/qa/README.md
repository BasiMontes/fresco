# qa/ — Cross-Story Test Scenario Log

Single living document holding every test scenario for the app — manual today, automation candidates tomorrow. Complements, does not replace, the per-story acceptance criteria that already live in Jira (synced to `.context/PBI/epics/EPIC-<KEY>-*/stories/STORY-<KEY>-*/comments.md`, one story at a time). This folder is the one place a full user journey — spanning several stories/epics — lives together.

## Naming convention

`regression.feature` — one Gherkin file, one `Característica` (Feature), many `Escenario` (Scenario) blocks grouped by area via section comments and tags. Written in Spanish (`# language: es` directive) to match this project's existing Jira AC convention (Critical Rule #12's Jira-content override) and the fact that Gherkin scenario text is itself business/domain language, same genre as the AC it complements.

If the scope ever outgrows a single file, split by area (`login.feature`, `calendario.feature`, …) but keep the same tag convention below.

## Tag convention

| Tag | Meaning |
|---|---|
| `@verificado-manual-YYYY-MM-DD` | Exercised live (Playwright CLI or equivalent) on that date, passed. **Staleness (FRESCO-399 / A4-L15):** a label older than **6 weeks** no longer counts as a current guarantee for coverage reporting — re-verify (and re-date the tag) before relying on it. Recipe below. A scenario that is *also* `@automatizado` is exempt: the spec is the live guarantee, the date is just provenance. |
| `@pendiente` | Written, not yet manually verified nor automated — **a real TODO**. Every `@pendiente` carries a comment stating what closes it: which fixture/step to write, or which decision is blocked. Not a resting place: triage to `@automatizado`, `@solo-manual`, or `@no-implementado`. |
| `@solo-manual` | **Deliberately** manual-only, not a TODO (FRESCO-399 / A4-L14). Use when automating does not pay: setup is disproportionate to the risk, the logic is already covered by unit tests, or the structural test infra is missing (e.g. reading a real email inbox for an OTP). Carries a one-line reason in a comment. Re-check the reason each audit — infra gaps get filled. |
| `@no-implementado` | Describes desired behavior for a feature that does not exist in code yet (mock, TODO stub, or unbuilt) |
| `@edge-case` | Non-happy-path causística in addition to the golden path |
| `@requiere-stripe-real` | Scenario calls Stripe's real API (creates a Checkout/Portal session, a Customer or a Subscription). **Excluded from `bun run test:e2e`** — the CI e2e job + local runs use the dummy Stripe creds in `.env.ci` (FRESCO-376), so these would fail or hit the shared test account. Runs in `bun run test:e2e:stripe`, `test:e2e:staging`, `test:e2e:production`; wired into CI two ways: the one scenario also tagged `@smoke` runs on every Production deploy via `post-deploy-smoke.yml`, and all five run weekly against staging via `.github/workflows/stripe-e2e.yml` (FRESCO-735 — previously manual-only, last human run 2026-08-19). Any Customer such a scenario creates is torn down by the `suscripcionCtx` fixture. |
| `@automatizado` | Once wired to a real Playwright test, add this tag plus a comment pointing at the spec file that covers it |
| `@smoke` | A minimal subset of `@automatizado` happy paths, run after each **Production** deploy against that deployment's own URL by `.github/workflows/post-deploy-smoke.yml` (`bun run test:e2e:smoke`). It is a **liveness** check of the deployed artifact — NOT a performance guard and NOT an AI-flow test. Add only fast, self-contained, low-flake scenarios; the workflow warms the app + Edge Functions first, but a scenario that leans on a real Gemini call or a tight latency assertion does not belong here (FRESCO-322). Current set: `@login`, `@qa`, `@suscripcion` — `@aprendizaje` (marcar cocinado) was removed in FRESCO-329 after failing 2/2 real post-deploy runs: its reseed + mark + badge-render chain runs too long against freshly-published infra even with the warm-up. |

## What the file contains

- One scenario per meaningful behavior or failure mode ("causística") discovered either by design (from a story's AC) or by live testing (bugs found while manually exercising the app).
- A trailing plain-comment section, "Notas de infraestructura", for regression checklist items that aren't expressible as user-facing Gherkin (e.g. "new RLS policy needs a matching table GRANT") — real root causes hit during live testing, kept here so they aren't rediscovered from scratch next time.

## Lifecycle

| Stage | Trigger | Actor |
|-------|---------|-------|
| **Created** | 2026-07-29, first live end-to-end testing session (login → onboarding → menu → calendar) | Dev + AI pairing session |
| **Updated** | Any time a new scenario is tested live, a new edge case is found, or a previously `@no-implementado` scenario ships | Whoever runs the test |
| **Promoted** | When a scenario gets a real Playwright spec, tag it `@automatizado` and reference the spec file — never delete the Gherkin scenario, it stays as the human-readable source of truth | Whoever wires the automation |
| **Promoted (same-PR rule)** | A scenario added here **as a Story's AC** is automated in the **same PR** that ships the story — `@automatizado` + a `tests/steps/*.ts` step file, `bun run test:e2e` green. Deferring is allowed only under the ADR-0014 budget clause and must be stated in the PR's Spec Compliance Matrix (`manual:<reason — ADR-0014 budget>`). See `/sprint-development` SKILL Gotcha 16 + S19 (FRESCO-321). | Story dev in `/sprint-development` Stage 3 |
| **Retained** | Never deleted — append-only in spirit, same as `.context/bitacora.md` | — |

## Automation ratchet (FRESCO-321)

Baseline 2026-08-30: **~31 / 139 scenarios `@automatizado` (~23%)**. The audit's eje Verificación (4,0) traced the score to this gap — a change that breaks a non-automated core flow is invisible to CI.

Policy — incremental, not a big-bang backfill:

1. **New work pays as it goes.** Every new Story with Gherkin AC automates those scenarios in the same PR (same-PR rule above). This alone stops the ratio decaying.
2. **Backlog ratchet.** Each development sprint, automate a batch of the existing manual-only scenarios, prioritising happy paths of the core flows: `@login`, `@onboarding`, `@generacion-menu`, `@calendario`, `@lista-compra`, `@aprendizaje`, `@suscripcion`, `@invitado`, `@biblioteca`, `@panel-inicio`, `@favoritos`, `@perfil`. Target is **core-flow happy paths at 100% automated**, not the whole 142. Batches so far: FRESCO-352 (→40), FRESCO-353 (→52), FRESCO-355 (→~70), FRESCO-399 (notificaciones payment-failed + bell-badge trio).
3. **Test-architecture trigger (ADR-0018, supersedes ADR-0014).** The scenario-count number is retired; the binding trigger is the CI `test:e2e` job wall-clock. The early-warning (~6m30s) fired at 75 scenarios / 6m40s and the parallelism migration **landed** (FRESCO-356): the four racer step files (`aprendizaje`, `entrega-parcial`, `generacion-determinista`, `aislamiento-datos`) now use `testUserFactory` per scenario, `regression.feature` carries `@mode:parallel`, and `playwright.config.ts` runs `workers` 4 (CI) / 2 (local). **Every new automated scenario MUST use `testUserFactory` and seed its own data** — never reuse a fixed shared account (`DEV_USER`/`PRO_USER`) for a scenario that writes, or it will race under parallel execution.
4. **`@smoke` set** is governed separately (this file's tag table + FRESCO-322 / FRESCO-329), not by this ratchet.

Progress is read live: `rg -c '@automatizado' .context/qa/regression.feature` vs `rg -c '^\s*Escenario:' .context/qa/regression.feature`.

### Batch de automatización pendiente (FRESCO-399 / A4-L14) — CERRADO

The `@pendiente` triage of 2026-09-02 left two; both closed by 2026-09-03. **Cero `@pendiente` en `regression.feature`.**

- ~~**`@calendario` "No se puede generar sobre una semana que ya tiene menú"**~~ — AUTOMATIZADO 2026-09-03 (FRESCO-321 ratchet): `tests/steps/calendario-semana.steps.ts`, `seedFullWeekMenu` → `/calendar` → assert `generate_week_button` absent + `delete_week_button` visible.
- ~~**`@notificaciones` "Las recomendaciones no excluyen recetas ya marcadas como favoritas"**~~ — RESUELTO FRESCO-405 (2026-09-03): decisión de producto Opción A (las recomendaciones NO excluyen favoritas, coherente con `/menu`). Escenario re-tag `@pendiente` → `@solo-manual`.

Everything else `@pendiente` was either automated in FRESCO-399 (the notificaciones trio) or reclassified `@solo-manual` with a documented reason.

### Staleness recipe (`@verificado-manual` > 6 weeks — A4-L15)

```sh
# manual-only scenarios whose last live check is now stale (>6 weeks):
CUTOFF=$(date -v-6w +%Y-%m-%d 2>/dev/null || date -d '-6 weeks' +%Y-%m-%d)
rg -o '@verificado-manual-[0-9-]+' .context/qa/regression.feature \
  | sed 's/@verificado-manual-//' | sort -u \
  | awk -v c="$CUTOFF" '$0 < c { print $0 "  ← re-verify" }'
```

A hit is not a failure — it means "the last human check of this manual-only path predates the cutoff; re-run it (or automate it) before quoting it as covered." `@automatizado` scenarios are exempt.

## How to consume

- Before manually re-testing a flow, check here first for known edge cases already documented (`@edge-case`) so nothing gets tested twice from scratch.
- Before automating, this file is the spec — one Playwright test per `Escenario`, ideally via `playwright-bdd`/`cucumber-js` so the Gherkin text and the executable test stay the same artifact (not a separate hand-translated spec that can drift).
- `@no-implementado` scenarios double as a lightweight backlog signal: if a story ships that closes one, flip its tag and note the date.

## Test surfaces (what runs where)

| Surface | Runner | Backend | CI job | Covers |
|---|---|---|---|---|
| Unit | `bun test` (`test:coverage`, ratchet floor) | fully mocked | `unit` | pure logic, wrappers, component render |
| **DB-integration** (FRESCO-464, ADR-0026) | `bun run test:db` (`RUN_DB_INTEGRATION=1`) | **real Postgres — Supabase CLI local stack only** | `db-integration` (separate from `e2e`) | cross-user RLS denial per user-data table; `SECURITY DEFINER` actor-bind spoofs. `tests/db/README.md`. |
| Unit, random order (FRESCO-796) | `bun run test:random [--seed=N]` (`bun test --parallel --randomize`) | fully mocked | `test-randomized.yml` (nightly cron + manual dispatch, seed printed) | order-independence of the unit suite |
| pgTAP | `supabase test db` | real Postgres as superuser | inside `e2e` | pure in-database logic (learning trigger) — cannot test JWT-scoped authz |
| e2e | `bun run test:e2e` (`playwright-bdd`) | ephemeral local stack (ADR-0017) | `e2e` | full user journeys — this file's `regression.feature` |
| e2e — `@requiere-stripe-real` (FRESCO-735) | `bun run test:e2e:stripe` | real Supabase project + real Stripe test-mode API, against staging | `stripe-e2e.yml` (weekly cron + manual dispatch) | Stripe Checkout/Portal redirects, trial-without-card session, checkout.session.completed → Pro activation |

### Unit tests must not depend on order (FRESCO-796)

The default `bun test` order hides order dependence: audit 6 measured 15 to 102 failures under `--randomize` while every file passed alone. Two causes, and what to do about each:

- **`mock.module` is process-wide and `mock.restore()` does not undo it.** A mock registered in one file (`@/lib/stripe`, `@/lib/supabase/server`, `@/lib/posthog/server`...) answers for the real module in every file that runs after it. `--parallel` implies `--isolate` (fresh global per file), which is why `test:random` uses it. Re-registering the real module in `afterAll` was tried and is NOT an option: each re-registration invalidates the module graph and the suite went from 25 s to 547 s.
- **State that outlives a test.** `spyOn` without `mock.restore()` keeps counting calls; `process.env` is shared by every file a worker runs, so set what a test needs in `beforeEach` and restore it in `afterEach`, never while the `describe` is collected; module-level state (`let initialized`) needs a fresh module per test (`await import('./x?fresh=' + n)`).

Plain `bun test --randomize` (no `--isolate`) is still red because of the first cause. Use `bun run test:random`. `test:coverage` stays sequential: its numbers move under `--parallel` (loaded lines 87.6 to 84.9), so the floors in `coverage-ratchet.md` are calibrated on the sequential run.

## Related

- Per-story AC (Jira-synced, one story at a time) → `.context/PBI/epics/EPIC-<KEY>-*/stories/STORY-<KEY>-*/comments.md`.
- Session narrative / why decisions were made → `.context/bitacora.md`.
- `/testability-guide` generates the in-app `/qa` page (credentials + testability guide for a human QA) — a different artifact, not a replacement for this scenario log.
- `.context/qa/bitacora-tests.md` — the AgileTest-import-ready compiled view of every scenario here plus its Playwright automation status, derived from this file + `tests/steps/*.ts`; append-only like this one, re-synced from `regression.feature` if they ever drift.
