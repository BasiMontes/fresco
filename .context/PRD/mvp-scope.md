# MVP Scope — Fresco

> PRD output of `/project-foundation` Phase 2 (Architecture — Product side). Directly mirrors the Constitution's Scope Anchor and Out-of-Scope Blacklist: `.context/business/business-model.md` — see "Scope Anchor — MVP (P0), in priority order" and "Out-of-Scope Blacklist" sections. Vendor-agnostic — no schemas, API endpoints, prompts, or vendor names belong here (SRS phase's job). Source: founder-authored brief ("FRESCO — REDEFINICIÓN v3", 2026-07-25).

## In Scope (Must Have — P0)

Epics below are listed **in the founder's stated priority order**, matching `business-model.md`'s Scope Anchor 1:1 — this order is not re-prioritized here. An 8th, cross-cutting epic (Food-Safety Guardrail) is added because it is explicitly P0 despite not appearing in the numbered priority list.

### EPIC-FRESCO-1: Onboarding

- US 1.1: As a new user, I want to complete a 3-step onboarding (diet, favorite cuisines, household size) so the system has enough information to generate my first menu.
- US 1.2: As a new user, I want onboarding to be short (3 steps only) so I don't abandon before reaching any value.

### EPIC-FRESCO-2: AI Weekly Menu Generation

- US 2.1: As a user, I want a full week of meals (21 meals: 7 days × breakfast/lunch/dinner) generated automatically so I don't have to plan each meal myself.
- US 2.2: As a user, I want my menu generated in under 30 seconds so the experience feels effortless rather than like more work than doing it myself.

### EPIC-FRESCO-3: Editable Calendar

- US 3.1: As a user, I want to rearrange meals on my weekly calendar via drag & drop so the plan fits my actual week instead of being rigid.
- US 3.2: As a user, I want to change a meal I don't like so the menu still feels like mine, not an AI output I have to accept as-is.

### EPIC-FRESCO-4: Shopping List

- US 4.1: As a user, I want a shopping list generated automatically from my weekly menu so I don't have to build it by hand.
- US 4.2: As a user, I want the shopping list grouped by supermarket aisle so my grocery trip is fast and I don't backtrack through the store.

### EPIC-FRESCO-5: Cooked / Discarded Learning Toggle (Pro-gated)

- US 5.1: As a user, I want to mark each recipe as cooked or discarded during the week so the system captures what my household actually ate.
- US 5.2: As a Pro user, I want next week's menu to avoid recipes I discarded and prioritize ones I cooked, so planning gets easier the longer I use the product.
- US 5.3: As a Pro user, I want to see a visible explanation when my menu changes (e.g., "we adjusted your menu because…") so I trust the system is genuinely learning, not just varying output randomly.

This is the product's core learning mechanism and its real moat — not a nice-to-have (`.context/business/business-model.md` — Key Resources, Value Propositions).

### EPIC-FRESCO-6: Guest Mode

- US 6.1: As a first-time visitor, I want to generate one full menu without creating an account so I can evaluate the product before committing to anything.

### EPIC-FRESCO-7: Progressive Signup

- US 7.1: As a guest who has already seen a generated menu, I want to be asked to sign up only after I've seen the value, so I'm not asked to commit before I know the product works for me.

### EPIC-FRESCO-8: Food-Safety Guardrail (cross-cutting, P0)

- US 8.1: As a user with a declared allergy or dietary restriction, I want every generated menu to guarantee it never includes a recipe that violates that restriction, so the product is safe for my household to use.

**This epic is explicitly excluded from the Out-of-Scope Blacklist below despite sharing surface similarity with blacklisted "AI/automation" features.** At the current, pre-code, concierge-validation stage it is enforced as a manual founder checklist run before every menu delivery — it does not wait for product code to exist (`.context/business/business-model.md` — Key Activities; `.context/business/market-context.md` — Risks). This document intentionally does not specify how the guarantee is technically enforced once code exists — that mechanism belongs to the SRS phase.

## Scope reversal (2026-08, EPIC-FRESCO-227): self-serve Pro payment is now in MVP scope

This document — and the "Success Criteria" section below — originally assumed Pro payment was collected **manually by the founder** during concierge validation, with self-serve payment deferred. That deferral has been **explicitly reversed** by the founder (confirmed in-session; not un-approved scope creep). EPIC-FRESCO-227 delivers a self-serve upgrade-to-Pro subscription flow from the profile screen, replacing the disabled "Próximamente" CTA that previously lived there. The binding architectural decision behind it is `ADR-0007` (hosted checkout + webhook-driven subscription state — the payment vendor is named there, not here, per this document's vendor-agnostic convention). Pricing is unchanged from `.context/business/business-model.md` — Free €0 vs Pro €4.99/mes, 7-day trial with **no card required at signup**, never below €4.99/mes. No P0 epic above changes; this replaces the manual-invoice step, not the product scope.

## Deferred to P1 (Not in MVP)

- **Curated recipe library (50–100 recipes with photography).** Cut from the MVP for cost reasons, not product-priority reasons: with a solo, part-time founder and no budget, curating and photographing 100 recipes is not affordable in phase 0–1. MVP recipes instead come from AI generation plus the manual founder safety/sanity review described in EPIC-FRESCO-8. (`.context/business/business-model.md` — Scope Anchor, Cost Structure.)

## Out of Scope (Blacklist)

The following are **explicitly excluded from the MVP and from all near-term roadmap consideration**, not merely deprioritized. They remain out of scope until **both** conditions are met: **MRR > €5,000 AND 30-day retention > 50%** (`.context/business/business-model.md` — Out-of-Scope Blacklist):

- Receipt scanning
- Price comparison
- Pantry / inventory management
- Aggressive push notifications (e.g., "morning briefing" style)
- Voice operations
- Wake Lock API / background device APIs
- Complex local-first architecture
- JSON / CSV export
- Price learning
- Leftover-ingredient AI
- Batch-cooking mode
- Expiration alerts
- Supermarket integrations
- Complex glassmorphism UI
- Gamification
- Community / social features
- Recipe marketplace
- Native app before 1,000 paying users
- B2B before B2C is validated

**Do not read the Food-Safety Guardrail (EPIC-FRESCO-8) as part of this list** — it is the one explicit, named exception, P0 from day one regardless of the MRR/retention gate.

## Success Criteria

The MVP is considered successful when the concierge-validation bar defined in the Constitution phase is met, not by an internal feature-completeness checklist:

- **Primary bar:** at least **3 of 10** concierge cohort users both **pay** and **repeat usage for 3+ consecutive weeks** (`.context/business/market-context.md` — Validation Plan, step 4).
- **Payment mechanism (updated 2026-08, `ADR-0007` / EPIC-FRESCO-227):** "pay" in the primary bar is now satisfied by a real self-serve subscription (hosted checkout, 7-day no-card trial, €4.99/mes), not by the founder invoicing each concierge user by hand. The bar itself — 3 of 10 converting and repeating for 3+ weeks — is unchanged.
- **Failure condition:** if this bar is not met, the explicit plan is to pivot or adjust the value proposition **before** writing further product code — not to press forward on an unvalidated thesis.
- **Non-negotiable gate within the loop:** the food-safety checklist (EPIC-FRESCO-8) runs before every single menu delivered during validation, with no exceptions, regardless of cohort size or timeline pressure.

`[PLACEHOLDER]` — feature-level acceptance criteria (e.g., precise generation-latency percentile beyond "under 30 seconds," specific UI acceptance thresholds) are not defined in the source brief and are left for `/product-management` story refinement rather than invented here.
