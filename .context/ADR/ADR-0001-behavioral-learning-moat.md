# ADR-0001 — Behavioral-learning moat as the Free/Pro pricing boundary

- **Status:** Proposed
- **Date:** 2026-07-25
- **Deciders:** Founder (product + technical decision, drafted by AI workflow for approval)
- **Tags:** pricing-model, data-model, cross-cutting-invariant, personalization
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Fresco's core value proposition is that it generates a weekly menu and shopping list faster than doing nothing, and gets measurably better at it the longer a household uses it (`.context/business/business-model.md` — Value Propositions). The open question this ADR resolves: **what, technically, makes that improvement real rather than a marketing claim** — and how hard-to-reverse is that mechanism once it's chosen?

Two candidate mechanisms exist, and the founder's own framing (`.context/business/market-context.md` — Trends & Insights: "Behavioral personalization over declared preferences") explicitly rejects one of them:

1. **Declared-preference personalization** — the user tells the system what they like (cuisines, dislikes, spice level), and the system remembers it. This is what `user_profiles` already captures during onboarding, and it is trivially replicable: any generic AI chat tool can "remember" a saved prompt of stated preferences by having the user paste it back in, or via the chat tool's own memory feature. It is not a moat — it is table stakes, and the Constitution explicitly frames generic AI chat as Fresco's most credible competitive alternative (`market-context.md` — Competitive Landscape), precisely because a stateless chat session can already do this much.

2. **Behavioral-learning personalization** — the system observes what a household actually cooks versus discards (a lightweight `cocinada`/`descartada` toggle on the calendar) and adjusts future menus from that signal, without asking the user to re-declare anything. A generic chat tool cannot replicate this without the user manually re-entering a running log of what happened every single week — exactly the recurring cognitive labor Fresco exists to remove (`business-model.md` — Problem Statement). The signal is cheap to capture (one toggle) and compounds in value the longer it accumulates, the opposite of a chat session that resets to zero every time.

The founder's technical brief (`fresco-core-tecnico.md`, `fresco-aprendizaje.md`) already commits to option 2 at the schema level: every recipe carries an `aprendizaje` sub-object (`veces_cocinada`, `veces_descartada`, `rating_promedio`, `ultima_vez_en_menu`), and the pricing model (`business-model.md` — Revenue Streams) is explicitly built around gating *access to that signal in generation*, not gating menu generation itself:

| Plan | Price | What differs |
|---|---|---|
| Free | €0 | Full menu generation every week, but stateless — `historial_semanas` is never passed to the prompt. |
| Pro | €4.99/month | Same generation, plus the last 2 weeks of cooked/discarded history is passed to the prompt, driving avoidance of discarded recipes and prioritization of cooked/well-rated ones. |

This corrects a named flaw in a prior product iteration, where the Free tier already delivered the full core promise and removed any reason to upgrade (`business-model.md` — Revenue Streams, "Structural note"). Here, Free keeps the generation promise; Pro is sold specifically as "the product knows you better every week" — a genuine retention hook tied to a real mechanism, not an artificial usage cap.

## Decision

**We will build the product's defensibility on behavioral data, not declared preferences, and we will gate its *application* — not its *recording* — behind the Pro tier.**

Concretely:
- Every recipe's schema carries an `aprendizaje` sub-object (`veces_cocinada`, `veces_descartada`, `rating_promedio`, `ultima_vez_en_menu`), updated by a database trigger whenever a `meal_plan_recipes` slot transitions to `cocinada` or `descartada`.
- Cooked/discarded **recording** happens for every user, on every tier, unconditionally (FR-5.1) — the raw behavioral signal is always captured, because it costs nothing to capture and the option to expand its use later stays open.
- Cooked/discarded **application to future generation** is Pro-only: the menu-selection prompt only receives `historial_semanas` / recent-recipe-id history when the caller is a Pro user (FR-2.5, FR-5.4). Free-tier generation is, by construction, always stateless — not because the data doesn't exist, but because the prompt-building code never reads it in for that tier.
- The invariant every feature must uphold: **no code path may pass Free-tier history into a generation prompt.** If this invariant is ever violated (even for a "small UX improvement"), the Free/Pro value distinction collapses and the pricing model no longer has a technical basis.

## Consequences

**Positive:**
- The moat is cheap to build (one boolean toggle per calendar slot, one trigger, one prompt-building conditional) and hard for a stateless competitor to replicate without asking the user to redo work every session — directly addressing the founder's stated differentiation thesis.
- The Free tier remains genuinely useful (full menu generation, every week, at zero cost), which keeps the top of the funnel wide, while the upgrade reason is concrete and mechanism-backed rather than an arbitrary cap.
- The pricing structure is enforced almost entirely in one place (the prompt-building function's `isPro` branch plus the SQL history-fetch call), which keeps the moat's implementation surface small and auditable.

**Negative / trade-offs:**
- This couples the pricing model directly to a specific schema shape. If the learning mechanism ever needs to change — e.g. moving from global recipe-level aggregation to true per-user personalization (already flagged as deferred "Fase 2" work in `fresco-schema-sql.md`, via a future `user_recipe_stats` table) — that is simultaneously a **schema migration** and a **pricing-page rewrite**, not an isolated backend change. The two are now structurally entangled.
- **Free-tier users cannot perceive product improvement over time, by design.** This is not an incidental limitation; it is the entire mechanism. It is already named as a two-edged risk in `market-context.md` (Risks: "The Free tier cannibalizes Pro conversion if learning isn't communicated") — if the Pro-only improvement is not made *visible* (the `card-insight` UI treatment in `DESIGN.md`, the `advertencias` explanation text in FR-5.5), Free users have no way to distinguish "the product doesn't remember me" from "the product is broken," and the intended upsell reads as a defect instead (Edge Case 2, `user-journeys.md`).
- The global (not per-user) aggregation of `veces_cocinada`/`veces_descartada`/`rating_promedio` means a household's *own* cooking pattern is not fully isolated from the aggregate — a deliberate, documented trade-off for small-N robustness at MVP scale, but one more reason a future move to true per-user stats will touch both schema and prompt-building code at once.

**Implementation status (confirmed 2026-07-25):** the live Supabase `recipes` table (`schema_supabase.sql`, executed, ~35 recipes seeded) does not yet contain the `aprendizaje` columns this decision depends on (`veces_cocinada`, `veces_descartada`, `rating_promedio`, `ultima_vez_en_menu`). This ADR is `Proposed` at the decision level; the schema migration that would make it operable has not been written yet — that is `/project-bootstrap` work, tracked in `architecture.md` §4, not a gap in this record.

**Neutral / follow-ups:**
- The week-3 follow-up interviews in the concierge validation plan (`market-context.md` — Validation Plan) are the direct test of whether this mechanism is actually felt by users — this ADR's core bet is falsifiable within the MVP's own validation loop, not a multi-year commitment made blind.
- If the concierge validation shows Free users churning specifically because they can't perceive any improvement (rather than because the base promise fails), that is evidence against this ADR's framing and should trigger a revisit — most likely a superseding ADR that either extends *some* lightweight signal to Free (eroding the moat) or invests further in making Pro's improvement more visible (reinforcing it) rather than changing the underlying mechanism itself.

## Alternatives considered

- **Declared-preference personalization as the paid tier** (remembering `cocinas_favoritas`/`ingredientes_odiados` across sessions, gated behind Pro). Rejected: this is the exact mechanism a generic AI chat tool can already replicate by having the user paste their own saved prompt back in every session — it fails the "hard for a stateless tool to replicate" test that is the entire point of charging for it (`market-context.md` — Competitive Landscape).
- **No tier gating at all — behavioral learning available to every user, monetize on volume/usage caps instead.** Rejected by the founder brief explicitly: this repeats the exact flaw named in a prior product iteration, where Free already delivered the full promise and removed any reason to upgrade (`business-model.md` — Revenue Streams, "Structural note").
- **Per-user (not global) learning aggregation from day one.** Considered and explicitly deferred, not rejected outright — `fresco-schema-sql.md` already earmarks a future `user_recipe_stats` table for this. Deferred because, at concierge-cohort scale (8–10 users), globally-aggregated statistics are a more robust signal than a handful of per-user data points would be; revisit once real usage volume exists.

## References

- `.context/business/business-model.md` — Value Propositions, Revenue Streams, Key Resources.
- `.context/business/market-context.md` — Trends & Insights, Competitive Landscape, Risks (specifically the Free-tier-cannibalization and learning-moat-perception risks this ADR's Consequences section cross-references directly).
- `.context/PRD/mvp-scope.md` — EPIC-FRESCO-5 (Cooked/Discarded Learning Toggle).
- `.context/PRD/user-journeys.md` — Journey 3 (Pro happy path), Edge Case 2 (Free user expects Pro-gated learning).
- `.context/SRS/functional-requirements.md` — FR-2.5, FR-5.1–FR-5.6.
- `.context/SRS/architecture.md` — §4 Data Model ("Learning fields"), §7.
- `fresco-aprendizaje.md`, `fresco-core-tecnico.md`, `fresco-schema-sql.md` (founder technical brief, source of the `aprendizaje` schema and the Free/Pro prompt-branching logic this ADR formalizes).
