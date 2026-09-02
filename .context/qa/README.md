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
| `@requiere-stripe-real` | Scenario calls Stripe's real API (creates a Checkout/Portal session, a Customer or a Subscription). **Excluded from `bun run test:e2e`** — the CI e2e job + local runs use the dummy Stripe creds in `.env.ci` (FRESCO-376), so these would fail or hit the shared test account. Still runs in `bun run test:e2e:stripe`, `test:e2e:staging`, `test:e2e:production`, and (via `--tags @smoke`) `post-deploy-smoke.yml` against real deploys. Any Customer such a scenario creates is torn down by the `suscripcionCtx` fixture. |
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

### Batch de automatización pendiente (FRESCO-399 / A4-L14)

The `@pendiente` triage of 2026-09-02 left exactly two:

- **`@calendario` "No se puede generar sobre una semana que ya tiene menú"** — XS. `seedFullWeekMenu(request, testUser)` → `/menu` → assert `generate_menu_button` absent. Next batch candidate.
- **`@notificaciones` "Las recomendaciones no excluyen recetas ya marcadas como favoritas"** — **not** an automation gap: an unresolved product question (should recs exclude favourites?). Needs a product-decision ticket, not a spec.

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

## Related

- Per-story AC (Jira-synced, one story at a time) → `.context/PBI/epics/EPIC-<KEY>-*/stories/STORY-<KEY>-*/comments.md`.
- Session narrative / why decisions were made → `.context/bitacora.md`.
- `/testability-guide` generates the in-app `/qa` page (credentials + testability guide for a human QA) — a different artifact, not a replacement for this scenario log.
- `.context/qa/bitacora-tests.md` — the AgileTest-import-ready compiled view of every scenario here plus its Playwright automation status, derived from this file + `tests/steps/*.ts`; append-only like this one, re-synced from `regression.feature` if they ever drift.
