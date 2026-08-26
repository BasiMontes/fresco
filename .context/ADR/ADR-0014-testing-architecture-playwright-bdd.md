# ADR-0014 — Testing architecture stays `playwright-bdd`; do not migrate to KATA

- **Status:** Accepted
- **Date:** 2026-08-26
- **Deciders:** Basi Montes
- **Tags:** testing, e2e, cross-cutting-invariant
- **Supersedes:** —
- **Superseded by:** —

---

## Context

The external Dojo audit (Ely, 2026-08-14) compared this repo's current test architecture — `playwright-bdd` generating real Playwright specs from Spanish-language Gherkin (`.context/qa/regression.feature`), single-worker execution (`workers: 1`, `fullyParallel: false` in `playwright.config.ts`) — against KATA, the layered architecture used by the separate QA boilerplate repo (`upex-galaxy/agentic-qa-boilerplate`): the ATC (Automated Test Case) as the atomic unit, data factories that enable real parallelism, and `@atc('FRESCO-XXX')`-style traceability tags.

The audit's own conclusion was explicit: **do not migrate now**. The current BDD setup is the right fit while this repo (`fresco-app`) is the only home its tests have — `tests/fixtures.ts` and `tests/steps/*.ts` live in-repo, generated directly from the single `.feature` file at Playwright config-load time (see `playwright.config.ts` comments). `workers: 1` is a deliberate trade-off, not an oversight: `@aprendizaje`'s scenarios mutate the same shared, finite backend test-plan state, and a prior attempt at parallel execution raced two scenarios onto the same slot.

As of 2026-08-26 none of this repo's 13 existing ADRs recorded this decision — it lived only in institutional memory and the audit finding, at risk of being silently re-litigated or violated by a future migration attempt.

## Decision

We will **keep `playwright-bdd` + Gherkin (Spanish) as this repo's E2E test architecture**, with single-worker execution, for as long as `fresco-app` remains the sole owner and sole consumer of its own test suite.

We will **not** adopt the KATA layered architecture (ATC units, data-factory-driven parallelism, `@atc` traceability) inside this repo while that condition holds.

## Consequences

- **Positive:** no migration cost or churn while the current setup already works; `regression.feature` stays the single human-readable source of truth (`.context/qa/README.md`'s own convention — a scenario is "promoted" by tagging `@automatizado`, never duplicated into a hand-translated spec); `workers: 1` sidesteps the shared-mutable-state race condition without needing data factories to fix it.
- **Negative / trade-offs:** test suite cannot run scenarios in parallel, so wall-clock CI time grows linearly with scenario count; no per-test data isolation, so new scenarios must keep sharing the same finite backend fixtures carefully; traceability from a scenario back to its Jira ticket is informal (tag conventions like `@verificado-manual-YYYY-MM-DD`), not the structured `@atc('FRESCO-XXX')` KATA provides.
- **Neutral / follow-ups:** this decision has an expiry condition, not a permanent one — see below.

## Alternatives considered

- **Migrate to KATA now** — rejected per the audit's own recommendation: the layered ATC/factory architecture pays for itself once multiple repos or teams consume the same test suite, or once true parallel execution is needed. Neither is true today; migrating now would be paying a cost for a benefit this repo can't yet realize.
- **Hybrid (KATA for new scenarios, BDD for existing)** — rejected: running two test architectures side by side doubles maintenance surface for no parallelism gain until the whole suite moves, and fragments `regression.feature` as the single source of truth `.context/qa/README.md` already establishes.

**Signals that would justify revisiting this decision** (open a new ADR that supersedes this one if any of these become true):

1. A second repo or team starts consuming/owning `fresco-app`'s E2E scenarios (KATA's traceability and factory isolation start paying for themselves across repo boundaries).
2. Scenario count grows enough that single-worker wall-clock CI time becomes a real bottleneck (data factories would unlock real parallelism).
3. The `@aprendizaje` shared-state problem needs solving anyway for an unrelated reason (data factories would already be half-built).

## References

- FRESCO-270 (this ticket) — Dojo audit finding, 2026-08-14
- `.context/qa/regression.feature` — the Gherkin source of truth + tagging convention
- `.context/qa/README.md` — scenario lifecycle and tag conventions
- `playwright.config.ts` — `workers: 1` / `fullyParallel: false` rationale (inline comment)
- `docs/methodology/kata-fundamentals.md` (external, `upex-galaxy/agentic-qa-boilerplate`) — KATA framework philosophy
