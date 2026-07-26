# Market Context — Fresco

> Constitution output of `/project-foundation` Phase 1. Vendor-agnostic by design — no stack, framework, or provider names belong in this document (see SRS for technical architecture). Source: founder-authored brief ("FRESCO — REDEFINICIÓN v3", 2026-07-25). Speculative or unvalidated claims are marked explicitly rather than presented as researched fact.

## Market Positioning

Fresco is **not** a recipe app, and **not** a pantry/inventory app. It is a **weekly menu-planning app with a behavioral-learning moat**: the product's differentiation is not the breadth of its recipe content but its ability to get measurably better, week over week, at proposing meals a specific household will actually cook — learned from real cooked/discarded behavior rather than from declared preferences the user has to type in.

This positioning deliberately narrows the competitive set. Fresco does not compete on recipe volume (against recipe blogs/apps), on inventory accuracy (against pantry-management apps), or on price optimization (against grocery price-comparison tools). It competes on **removing the weekly planning decision itself**, with an improving-over-time mechanism a stateless tool cannot match without asking the user to redo work every session.

## Competitive Landscape

_Honest, founder-authored comparison — not a researched competitor teardown. No named commercial competitors are assessed; the comparison set is "alternatives a household planner actually uses today."_

| Alternative | Why Fresco wins | Real risk |
|---|---|---|
| Doing nothing (memory / ad hoc) | Saves roughly 30 minutes of planning per week and reduces impulse buying at the store | If the user is very passive, even a 30-second interaction can feel like "too much effort" |
| Generic AI chat (e.g., asking a general-purpose assistant) | Learns from real behavior (cooked/discarded), not a declared preference the user has to re-type; single-purpose UX beats a chat-interface UX for this recurring task | If the user doesn't perceive week-over-week improvement, the differentiated value isn't felt, and the chat tool remains "good enough" |
| Notes / spreadsheets | Delivers a full menu plus an aisle-grouped shopping list with zero ongoing maintenance effort | Switching friction if the user's existing ad hoc system "already works for them" |

**Nothing in this table should be read as market-share or feature-parity research** — it reflects the founder's assessment of realistic substitutes for the target user, to be tested directly in the validation plan below (specifically the interview question "If this disappeared tomorrow, what would you use instead?").

## Market Opportunity

`[PLACEHOLDER]` — TAM/SAM/SOM sizing is not available. The source brief does not include market-sizing data, and none should be fabricated here (per this phase's rule against inventing figures). Market-sizing work, if pursued, should be commissioned as a dedicated research task rather than backfilled speculatively into this document.

`[PLACEHOLDER]` — barriers to entry are not addressed in the source brief.

**What the brief does provide as a growth-trend proxy** is the explicit choice of what to defer until traction is proven: multiple categories that a broader "smart kitchen" or "food-tech" product might chase early (receipt scanning, supermarket integrations, native app, B2B) are deliberately blacklisted until **MRR > €5,000 and 30-day retention > 50%** — see `business-model.md` for the full list. This reflects a founder strategy of proving a single narrow wedge before expanding into adjacent, larger markets, rather than a market-size claim in itself.

## Trends & Insights

_Framed as validation hypotheses to be tested, not as established market research._

- **Behavioral personalization over declared preferences:** the founder's working thesis is that generic AI assistants have made "the AI can generate a menu" table stakes, and the differentiation has shifted to *how* a system learns — from passive behavioral signal versus active user re-prompting. This is treated as an open bet, tested directly by the week-3 follow-up interviews described below (does the user notice improvement vs. week 1?).
- **Decision fatigue as a recurring, not one-time, pain:** the target pain (Sunday-afternoon planning dread) recurs weekly rather than being solved once, which is why the validation plan measures **repeat** usage over 3–4 consecutive weeks rather than a single successful session.
- **Visible learning as a monetization lever:** the founder hypothesizes that a Free tier can safely deliver the full "generate a menu" promise without cannibalizing paid conversion, provided the *improvement* (the Pro-only behavioral learning) is made visible in-product (e.g., surfacing "this week we adjusted your menu because…"). This is a mitigation for a specific named risk (below), not a proven trend.

## Validation Plan (Go-to-Market)

Deliberately scaled to a solo, part-time founder with no budget — this is a sequencing and rigor plan, not a literal execution runbook (implementation steps belong to later phases / `/product-management`).

1. **Weeks 1–2 — Landing page + waitlist.** A single distribution channel at a time (not several in parallel), targeting 50–100 signed-up emails.
2. **Weeks 3–6 — Manual concierge MVP with 8–10 people** (deliberately capped below 20 so genuine one-on-one follow-up stays possible).
   - Founder generates menus manually, assisted by AI, and delivers them as PDFs.
   - Real payment charges (not simulated/PayPal one-offs) to genuinely test subscription willingness-to-pay behavior.
   - 3–4 consecutive weeks of follow-up (not 2) to observe whether people actually repeat, not just try once.
   - A manual food-safety checklist runs before every menu sent — this does not wait for product code.
3. **Key interview question:** *"If this disappeared tomorrow, what would you use instead?"* — designed to reveal whether Fresco is genuinely competing with a free AI chat tool or is filling a gap those alternatives don't address.
4. **Success metric:** at least 3 of the 10 concierge users both pay **and** repeat for 3+ consecutive weeks. If this bar isn't met, the plan is to pivot or adjust the value proposition **before** writing further product code — not to press forward on an unvalidated thesis.

## Risks

| Risk | Mitigation |
|---|---|
| The "learning moat" isn't perceived by users within the first few weeks | Explicitly measured in week-3 follow-up interviews — does the user notice improvement versus week 1? |
| The Free tier cannibalizes Pro conversion if learning isn't communicated | Make learning visible in-product (e.g., "this week we adjusted your menu because…") rather than relying on a hidden backend improvement |
| Limited founder time stretches the validation timeline | Accept that the 6-week plan may extend to 8–10 weeks; do not compress the timeline at the cost of genuine follow-up |
| Food-safety risk (allergies / dietary restrictions handled incorrectly) | Manual checklist enforced from the very first concierge MVP delivery onward — does not wait for product code |
