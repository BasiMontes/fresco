# Business Model Canvas — Fresco

> Constitution output of `/project-foundation` Phase 1. Vendor-agnostic by design — no stack, framework, or provider names belong in this document (see SRS for technical architecture). Source: founder-authored brief ("FRESCO — REDEFINICIÓN v3", 2026-07-25). Where a claim is founder reasoning rather than validated user research, it is marked explicitly.

## Problem Statement

Every week, the person responsible for feeding a household faces the same low-grade but recurring dread: "what do I cook this week?" This is not a recipe-discovery problem — recipes are abundant and free everywhere. It is a **planning and decision-fatigue problem**: turning "what ingredients do I have, what does my household eat, what's realistic for a Tuesday night" into a full week of meals and a shopping list, repeated 52 times a year.

Existing coping mechanisms — phone notes, a family group chat, or plain memory — work but cost real mental effort every single week, with no improvement over time. Generic AI chat tools (e.g., asking a general-purpose assistant for a weekly menu) can produce a menu, but they are stateless: every session starts from zero, requires the user to re-explain preferences via a written prompt, and never learns from what the household actually ended up cooking versus what it discarded.

The critical pain is not "I don't know any recipes." It is "planning a week of realistic, likable meals is repetitive cognitive work, and nothing I currently use gets easier the more I use it."

## Customer Segments

**Primary segment — "Laura, the exhausted planner"**
_Founder hypothesis, unvalidated — see Validation Plan below (concierge MVP is the test)._

- 30–40 years old, cooks 5+ days a week, works outside the home, with or without children.
- Pain trigger: Sunday-afternoon dread about planning the coming week's meals.
- Current workaround: phone notes, a family messaging thread, or unaided memory.
- Willingness to pay is conditional: the new method must be faster than doing nothing (a full menu in under 60 seconds) and must save at least 30 minutes of planning per week.

**Explicit non-segments (out of scope for this product):**

- Users primarily seeking inventory/pantry control.
- Users primarily seeking price comparison across retailers.
These are different jobs-to-be-done and a different product; building for them would dilute the core promise to Laura.

## Value Propositions

**Core thesis:** Fresco generates a weekly menu and shopping list in 30 seconds, and gets it right more each week because it learns from what the household actually cooks — not from what they say they like.
_(Original founder phrasing, Spanish: "Fresco genera tu menú semanal y lista de compra en 30 segundos, y acierta más cada semana porque aprende de lo que realmente cocinas — no de lo que dices que te gusta.")_

The defensible mechanism is **behavioral learning**, not preference storage. Any generic AI chat tool can "remember" a saved prompt of declared preferences — that is not a moat. What a stateless chat tool cannot replicate without friction is tracking, week over week, which proposed recipes actually got marked "cooked" versus "discarded," and adjusting future menus accordingly. This signal is cheap to capture (a toggle on the calendar) and compounds in value the longer a household uses the product — the opposite of a generic chat session, which resets to zero every time.

**North-star KPI:** weekly menus generated **and used** — not money "saved," not receipts scanned. Usage of the generated plan, not adjacent proxy metrics, is the signal that the product is doing its job.

**Three non-negotiable pillars** (carried forward unchanged from a prior product iteration):

1. AI-generated weekly menu.
2. Reduction of mental load — solving the real pain of "what do I cook this week?", not a peripheral convenience.
3. Smart shopping list, grouped by supermarket aisle.

**What Fresco is NOT:** a recipe book, a pantry/inventory manager, or a price comparator.
**What Fresco IS:** a menu planner that improves with use, paired with a smart shopping list.

## Channels

_Scoped to the validation-stage go-to-market described in the Validation Plan below — no paid-acquisition or partnership channel strategy exists yet at MVP stage._

- Landing page + email waitlist (weeks 1–2 of validation).
- Direct, high-touch outreach to a small concierge cohort (weeks 3–6 of validation) — manual delivery, not yet a self-serve product channel.
- A single distribution channel at a time during validation, deliberately, rather than spreading thin across several in parallel.

`[PLACEHOLDER]` — post-validation, scaled acquisition channels (organic content, paid social, referral, App Store/Play Store discovery, partnerships) are not yet defined. The brief intentionally defers this decision until after the concierge MVP validates the value proposition; specifying channels now would be invented, not founder-sourced.

## Customer Relationships

- **Concierge-assisted, high-touch** during validation: the founder personally generates menus (manually plus AI-assisted) and delivers them as PDFs to a small cohort, with weekly follow-up over 3–4 consecutive weeks to observe real repeat usage.
- **Self-service, low-touch** at product stage: guest mode requires no signup for a first menu, and progressive signup is deferred to the end of onboarding — relationship starts frictionless and earns commitment only after value is demonstrated.
- Learning must be **visible to the user**, not just present in the backend — a stated mitigation for the risk that Free-tier users don't perceive the value of Pro (see Risks in `market-context.md`). The relationship model depends on the user being able to feel, not just be told, that the product is adapting to them.

## Revenue Streams

| Plan | Price | Includes |
|---|---|---|
| Free | €0 | 1 menu/week + shopping list. Every week generated from scratch — no memory of prior weeks. |
| Pro | €4.99/month | Everything in Free, plus: the system learns — avoids repeating discarded recipes, prioritizes recipes marked cooked, adjusts quantities. Each week costs less mental effort than the last. |

**Framing:** the upgrade is sold as "the product knows you better every week" — a genuine retention hook built on the behavioral-learning moat, not an artificial usage cap on the Free tier.

**Pricing rules (carried forward, non-negotiable):**

- Never price below €4.99/month.
- 7-day free trial, no payment card required upfront.

**Structural note:** this pricing model is a deliberate fix to a flaw in a prior iteration, where the Free tier already delivered the full core promise, removing any reason to upgrade. Here, Free delivers the menu-generation promise every week, but the learning/improvement promise — the actual differentiator — is Pro-only.

## Key Resources

- The behavioral dataset per household: which recipes were marked cooked vs. discarded, over time. This is the resource the moat is built on.
- Menu- and recipe-generation capability (AI-assisted), including a manual founder review step for safety and sanity at this stage — not yet a curated, photographed recipe library (explicitly cut from scope, see MVP Scope below).
- Founder time and attention, currently the primary constraint — validation plan is explicitly scaled to a solo, part-time founder with no budget.

`[PLACEHOLDER]` — brand assets, proprietary content licenses, or other IP resources are not addressed in the source brief.

## Key Activities

- Generating accurate, realistic weekly menus fast (sub-30-second target).
- Capturing and acting on the cooked/discarded signal — the core learning loop.
- Producing an aisle-grouped shopping list from the generated menu.
- Manual food-safety review of every menu (allergies/dietary restrictions) — a checklist activity from the very first concierge delivery, deliberately not deferred to "once we have code for it."
- Running the validation loop itself: landing page, waitlist, concierge delivery, weekly follow-up interviews.

## Key Partners

`[PLACEHOLDER]` — the source brief does not name specific partners (e.g., retailers, nutrition/dietitian bodies, content providers). At this validation stage the product is being built and tested by a solo founder with no named external partners; this section should be revisited once the concierge MVP results are in and any real estate for partnership (e.g., aisle-mapping data by supermarket chain) becomes concrete.

## Cost Structure

`[PLACEHOLDER]` — the source brief does not provide a cost breakdown (infrastructure, AI generation cost per menu, founder time valuation, etc.). What is explicit is a **cost-conscious constraint on scope**: a curated, photographed library of 50–100 recipes was cut from the P1 backlog specifically because "with a solo, part-time founder and no budget, curating/photographing 100 recipes isn't affordable in phase 0–1." This constraint should be read as a proxy signal that cost discipline drives scope decisions, even though no numeric cost structure exists yet.

## MVP Hypotheses

1. **Speed-and-friction hypothesis:** a sub-30-second, AI-generated weekly menu plus an aisle-grouped shopping list is enough perceived value for a household planner to adopt the product over "doing nothing," even though doing nothing costs zero effort in the moment.
2. **Behavioral-learning-is-felt hypothesis:** households will perceive and value week-over-week improvement driven by the cooked/discarded signal, distinguishing Fresco from a stateless AI chat session — and this perceived improvement is strong enough to justify paying €4.99/month rather than re-prompting a free chat tool each week.
3. **Repeat-usage hypothesis:** a meaningful fraction of a concierge test cohort (target: at least 3 of 10 users) will both pay and keep using the product for 3+ consecutive weeks, evidence that the pain is real and recurring rather than a one-time novelty.

## Scope Anchor — MVP (P0), in priority order

1. 3-step onboarding (diet, favorite cuisines, household size) — the minimum input needed to generate a first menu.
2. AI weekly menu generator (21 meals, under 30 seconds) — the central promise.
3. Editable calendar (drag & drop) — without this the menu is rigid and won't actually get used.
4. Shopping list grouped by aisle — second non-negotiable pillar.
5. "Cooked / discarded" toggle per recipe — the learning mechanism; this is the moat, not a nice-to-have.
6. Guest mode (one menu, no signup) — reduces entry friction.
7. Progressive signup at the end of onboarding.

**Explicitly cut from P1 (not P0):** a curated library of 50–100 recipes with photography. Rationale: unaffordable for a solo, part-time founder with no budget in phase 0–1. The MVP relies on AI-generated recipes plus a manual founder safety/sanity review instead.

## Out-of-Scope Blacklist

Explicitly excluded until two conditions are both met: **MRR > €5,000** and **30-day retention > 50%**:

Receipt scanning, price comparison, pantry/inventory management, aggressive "morning briefing" notifications, voice operations, background/wake-lock-style device APIs, complex local-first architecture, JSON/CSV export, price learning, leftover-ingredient AI, batch-cooking mode, expiration alerts, supermarket integrations, complex glassmorphism UI, gamification, community/social features, a recipe marketplace, a native app before 1,000 paying users, and B2B before B2C is validated.

**Explicit exception — not blacklisted, P0 from day one:** the food-safety guardrail (allergies/dietary restrictions). This is a manual checklist from the very first concierge delivery; it does not wait for code.

## Validation Plan Summary

See `market-context.md` for the full go-to-market and risk framing. In brief: a lightweight, founder-scaled validation loop (landing page → concierge MVP → paid, repeat-usage test) precedes any further product investment, gated on real households paying and returning for 3+ consecutive weeks.
