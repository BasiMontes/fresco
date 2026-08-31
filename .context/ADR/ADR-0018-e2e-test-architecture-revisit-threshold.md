# ADR-0018 — E2E test architecture revisit: wall-clock is the binding trigger, not scenario count

- **Status:** Accepted <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-08-31
- **Deciders:** Basi Montes
- **Tags:** testing, e2e, cross-cutting-invariant
- **Supersedes:** ADR-0014
- **Superseded by:** —

---

## Context

ADR-0014 (2026-08-26) kept `playwright-bdd` + Spanish Gherkin + single-worker execution (`workers: 1`, `fullyParallel: false`) as this repo's E2E architecture, and declined a KATA migration, for as long as `fresco-app` stays the sole owner and consumer of its own test suite. It attached an expiry condition — **revisit signal #2**: open a new ADR that supersedes it when *"the count of `@automatizado` scenarios crosses ~60, **or** single-worker wall-clock CI time for the e2e job crosses ~8 minutes (whichever comes first)"*.

The FRESCO-321 automation ratchet has since driven the count up:

- FRESCO-352 → 40 `@automatizado`.
- FRESCO-353 → 52 `@automatizado`.
- The planned 3rd batch (FRESCO-355: `@panel-inicio` ×9, `@favoritos` ×4, `@perfil` ×3, `@landing` ×2) → **~70**, which crosses the count trigger.

Measured cost, however, has not moved anywhere near the ceiling:

| Point in time | `@automatizado` | CI `test:e2e` job wall-clock |
|---|---|---|
| FRESCO-352 (PR #205) | 40 | 4m25s |
| FRESCO-353 (PR #206) | 52 | 5m27s |
| Projected at ~70 (linear) | ~70 | ~7m15s |

The suite is still ~1s–3s per scenario against a warm local Supabase stack (FRESCO-310) with a pre-built production server (FRESCO-266). The Stripe scenarios — the bulk of the recent additions — run in 300–400ms each (synthetic signed webhooks, no browser round trip).

`playwright-bdd`'s `@mode:parallel` / `@mode:serial` tag is **feature-level, not per-scenario**. `regression.feature` is a single Feature with 142 scenarios and is deliberately the single human-readable source of truth (`.context/qa/README.md`, ADR-0014). So partial parallelism is not available without either fragmenting that file or first migrating every shared-mutable-state step file to `testUserFactory` (FRESCO-308). As of 2026-08-31 the still-shared-state racer step files are: `aprendizaje.steps.ts`, `entrega-parcial.steps.ts`, `generacion-determinista.steps.ts`, `aislamiento-datos.steps.ts` (read-only shared-account files like `login.steps.ts` / `qa-page.steps.ts` are not racers).

## Decision

We will **keep everything ADR-0014 decided** — `playwright-bdd` + Spanish Gherkin, `regression.feature` as the single source of truth, single-worker execution, no KATA migration — and change only the revisit trigger:

1. **The scenario-count number (`~60`) is retired as a hard trigger.** It was a proxy for cost; the real cost is CI wall-clock. Scenario count stays useful only as a rough forward estimate.

2. **The binding revisit trigger is now the `test:e2e` job wall-clock:**
   - **Early-warning at ~6m30s sustained** (two consecutive `main`-bound runs): begin the parallelism migration described below — do not wait for pain.
   - **Hard trigger at ~8m sustained**: the migration must land before any further `@automatizado` additions.

3. **The 3rd ratchet batch (FRESCO-355, → ~70 scenarios) is explicitly sanctioned** under this revised trigger, because measured CI time stays ~7 minutes.

4. **The committed response when the early-warning fires is a bounded, in-repo change, not a KATA migration:**
   migrate the four remaining racer step files to `testUserFactory` (the FRESCO-308 pattern, already used by ~half the suite), add `@mode:parallel` to the `regression.feature` Feature line, and set `workers` to a small number (2–4) with `fullyParallel: true`. Estimated at ~1–1.5 days. KATA's other two pillars (ATC atomic units, structured `@atc('FRESCO-XXX')` traceability) and a second repo/team consumer remain unjustified — ADR-0014's core reasoning holds.

## Consequences

- **Positive:** the ratchet (FRESCO-321) can continue closing real core-flow coverage gaps without an architecture project blocking each batch; the revisit trigger is now tied to the metric that actually hurts (CI wall-clock developers wait on), not a headcount; the parallelism migration is pre-planned and scoped, so when it is needed it is execution, not design.
- **Negative / trade-offs:** we are deliberately accepting a suite that will eventually need the parallelism work — this ADR defers it, it does not remove it; scenario count and wall-clock will keep climbing and the early-warning **will** fire within a batch or two; traceability from scenario → Jira ticket stays informal (`@verificado-manual-YYYY-MM-DD` + `# Automatizado: <file> (FRESCO-XXX)` comments), not structured.
- **Neutral / follow-ups:** `playwright.config.ts`'s `workers: 1` rationale comment and `.context/qa/README.md`'s ratchet section are updated to point here; the parallelism migration is pre-filed intent, to be ticketed when the early-warning fires; the four racer step files are named above so the migration scope is not re-discovered.

## Alternatives considered

- **Do the parallelism migration now, as the revisit response.** Rejected for timing, not merit: it is ~1–1.5 days of work whose only benefit (faster CI) is not yet needed — CI is ~5.5min. Doing it now front-loads cost for a benefit ~2 batches away, and risks regressions in a suite that is currently green and being actively extended. It is the right move the moment wall-clock justifies it — hence the pre-scoped commitment above.
- **Split `regression.feature` into per-domain feature files, `@mode:parallel` on the isolated ones.** Rejected: directly fragments the single-source-of-truth that `.context/qa/README.md` and ADR-0014 protect ("a scenario is promoted by tagging `@automatizado`, never duplicated"), for a parallelism gain we can get later without fragmentation by migrating the four racer files.
- **Migrate to KATA now.** Rejected — unchanged from ADR-0014: no second repo/team consumer, and factory-driven parallelism (KATA's one pillar that would help) is achievable in-repo without the ATC/traceability layers.
- **Keep ADR-0014's count trigger and just raise the number.** Rejected: picking a new arbitrary number (80? 100?) repeats the original mistake. Wall-clock is measurable, developer-felt, and already the "whichever comes first" half of ADR-0014's own trigger — promote it to the sole trigger.

## References

- ADR-0014 — the decision this supersedes (test architecture stays `playwright-bdd`; do not migrate to KATA)
- FRESCO-321 — the automation ratchet driving the scenario count up
- FRESCO-352 / FRESCO-353 — ratchet batches 1 and 2 (count 31→40→52, CI 4m25s→5m27s)
- FRESCO-354 — this ADR
- FRESCO-355 — ratchet batch 3, sanctioned by this ADR (→ ~70 scenarios)
- FRESCO-308 — per-test data factories (`tests/test-user-factory.ts`) — the migration path for the four racer step files
- FRESCO-310 / FRESCO-266 — warm local Supabase stack + pre-built prod server, why per-scenario cost is 1–3s
- `playwright.config.ts` — `workers: 1` / `fullyParallel: false` rationale (inline comment, updated to point here)
- `.context/qa/README.md` — ratchet section (updated with the revised trigger)
