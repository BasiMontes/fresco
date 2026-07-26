# Executive Summary — Fresco

> PRD output of `/project-foundation` Phase 2 (Architecture — Product side). Traces back to the Constitution phase: `.context/business/business-model.md` and `.context/business/market-context.md`. Vendor-agnostic by design — no stack, framework, or provider names belong in this document (see SRS for technical architecture). Source: founder-authored brief ("FRESCO — REDEFINICIÓN v3", 2026-07-25). Where a claim is founder reasoning rather than validated user research, it is marked explicitly — no user interviews or usage data exist yet.

## Problem Statement

Every week, the person responsible for feeding a household faces the same low-grade but recurring dread: "what do I cook this week?" This is not a recipe-discovery problem — recipes are abundant and free everywhere. It is a **planning and decision-fatigue problem**: turning "what does my household eat, what's realistic for a Tuesday night" into a full week of meals and a shopping list, repeated 52 times a year.

Current coping mechanisms — phone notes, a family group chat, plain memory, or a stateless generic AI chat session — all cost real mental effort every single week and never get easier the more they're used. The critical pain is not "I don't know any recipes." It is "planning a week of realistic, likable meals is repetitive cognitive work, and nothing currently in use gets easier over time." (Full framing: `.context/business/business-model.md` — Problem Statement.)

## Solution Overview

Fresco generates a full weekly menu and an aisle-grouped shopping list in under 30 seconds, and improves week over week by learning from what a household actually cooks — not from what they say they like.

Core MVP capabilities:

- **Fast AI-generated weekly menu** — 21 meals (7 days × breakfast/lunch/dinner) produced in under 30 seconds from a 3-step onboarding (diet, favorite cuisines, household size).
- **Editable, not rigid** — a drag-and-drop calendar so the generated plan can be adjusted to fit real life instead of being discarded whole.
- **Zero-maintenance shopping list** — grouped by supermarket aisle so the plan converts directly into a fast grocery trip.
- **Behavioral learning as the moat** — a "cooked / discarded" toggle per recipe that lets the system get measurably better at proposing meals a specific household will actually cook, distinguishing Fresco from a stateless AI chat session that resets to zero every session (Pro tier — see `.context/business/business-model.md` Revenue Streams).
- **Frictionless entry** — a guest mode that generates one full menu with no signup, converting to an account only after value has already been demonstrated (progressive signup).

## Why Now / Why Us

Fresco does not compete on recipe volume, inventory accuracy, or price optimization. It competes on removing the weekly planning decision itself, with an improving-over-time mechanism a stateless tool cannot match without asking the user to redo work every session. Comparison is founder-authored, not a researched competitor teardown (full table: `.context/business/market-context.md` — Competitive Landscape):

| Alternative | Why Fresco wins | Real risk |
|---|---|---|
| Doing nothing (memory / ad hoc) | Saves roughly 30 minutes of planning per week, reduces impulse buying | A very passive user may still find a 30-second interaction "too much effort" |
| Generic AI chat | Learns from real behavior (cooked/discarded), not a re-typed declared preference; single-purpose UX beats chat UX for a recurring task | If week-over-week improvement isn't perceived, the chat tool remains "good enough" |
| Notes / spreadsheets | Full menu + aisle-grouped list with zero ongoing maintenance | Switching friction if the user's ad hoc system "already works for them" |

## Success Metrics

**North-star KPI:** weekly menus generated **and used** — not money "saved," not receipts scanned. Usage of the generated plan, not an adjacent proxy metric, is the signal the product is doing its job.

**MVP success metric (concierge validation — distinct from the product's eventual north-star):** at least **3 of 10** paying concierge users repeat usage for **3+ consecutive weeks**. This is the MVP's own bar for whether the pain is real and recurring rather than a one-time novelty; it gates further product investment before any further code is written if it isn't met. (Source: `.context/business/market-context.md` — Validation Plan.)

Supporting metrics stated in the source brief:

- Generation speed: full weekly menu + shopping list produced in under 30 seconds.
- Willingness-to-pay threshold: the product must beat "doing nothing" — under 60 seconds to a usable menu, saving at least 30 minutes of weekly planning time.
- Perceived-improvement signal (Pro tier): whether users notice week-over-week improvement, tested qualitatively via week-3 follow-up interviews — not yet a quantified target.
- Scope-expansion gate (not an MVP target, but a stated business threshold): MRR > €5,000 **and** 30-day retention > 50% before any blacklisted feature is reconsidered.

`[PLACEHOLDER]` — no numeric adoption/engagement targets (e.g., week-1 activation rate, DAU/WAU, feature-level adoption %) are specified in the source brief beyond the concierge validation bar above. Fabricating targets here would misrepresent an unvalidated hypothesis as a researched forecast; these should be set once concierge validation data exists.

## Target Users

Only one persona is defined in this phase — the source brief does not describe a second segment, and inventing additional personas to satisfy a template count would violate this phase's no-fabrication rule. Full detail: `.context/PRD/user-personas.md`.

- **Laura, the exhausted planner** — 30–40, cooks 5+ days/week, works outside the home, with or without kids. Primary pain: Sunday-afternoon dread about planning the week's meals, currently solved with phone notes, a family group chat, or memory. **This persona is an explicit, unvalidated founder hypothesis** pending the concierge-MVP validation described in `.context/business/market-context.md` — no interviews or usage data back it yet.

Fresco is explicitly **not** built for users whose primary job-to-be-done is inventory/pantry control or price comparison across retailers — that is a different product (`.context/business/business-model.md` — Customer Segments, explicit non-segments).
