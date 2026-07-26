# User Journeys — Fresco

> PRD output of `/project-foundation` Phase 2 (Architecture — Product side). Traces back to `.context/PRD/user-personas.md` (Laura) and `.context/PRD/mvp-scope.md` (epics referenced below). Vendor-agnostic — no schemas, API endpoints, prompts, or vendor names belong here. Source: founder-authored brief ("FRESCO — REDEFINICIÓN v3", 2026-07-25). All journeys below are hypothesized flows for an unbuilt MVP, not observed behavior — no usage data exists yet.

Only one persona exists at this stage (Laura — see `personas.md`); journeys below are organized by **access tier** (guest / registered Free / registered Pro), since tier — not a distinct persona — is what changes the flow.

## Journey 1 — Guest Happy Path

**Persona:** Laura, as a first-time, unauthenticated visitor.
**Scenario:** Laura has heard about Fresco and opens it without creating an account, wanting to see if it's worth her time before committing to anything.

**Step 1**
- User Action: Opens Fresco and starts using it without signing up (EPIC-FRESCO-6, Guest Mode).
- System Response: Lets her proceed directly into onboarding with no account required.
- Pain Point: If the no-signup path isn't obvious, she may assume registration is mandatory and bounce before trying the product at all.

**Step 2**
- User Action: Completes the 3-step onboarding (diet, favorite cuisines, household size) (EPIC-FRESCO-1).
- System Response: Captures her inputs as the basis for menu generation.
- Pain Point: If onboarding feels longer than "3 steps," she may abandon before reaching any value — this is the one interaction she has to trust before deciding to continue.

**Step 3**
- User Action: Waits for her weekly menu.
- System Response: Generates a full 21-meal weekly menu in under 30 seconds (EPIC-FRESCO-2).
- Pain Point: This is the central promise of the product. If generation is slow, or the result feels generic/unrealistic for her stated diet and cuisines, trust in the whole product breaks on the very first interaction.

**Step 4**
- User Action: Reviews the generated menu on an editable calendar and the aisle-grouped shopping list (EPIC-FRESCO-3, EPIC-FRESCO-4).
- System Response: Presents a plan she can rearrange via drag & drop, plus a shopping list grouped by supermarket aisle.
- Pain Point: As a guest she has no prior baseline to compare against — if the first menu doesn't feel realistic or likable, she has no reason yet to believe a second attempt (or Pro's learning) would be better.

**Step 5**
- User Action: Considers whether to keep the menu.
- System Response: Prompts her to sign up in order to save it (progressive signup, EPIC-FRESCO-7) — only now, after she has already seen the generated menu.
- Pain Point: If the signup prompt reads as a paywall/blocker rather than "keep what you just saw," she may abandon here instead of converting, even though she already experienced the value.

**Expected Outcome:** Laura experiences the full core promise (fast menu + editable calendar + shopping list) with zero upfront commitment, and creates an account because she has already seen the value rather than being asked to trust a promise.

**Alternative Paths / Edge Cases:**
- What if she doesn't sign up? `[PLACEHOLDER]` — the source brief does not specify what happens to an unsaved guest-generated menu (e.g., whether it's discarded, retained temporarily, or otherwise); not invented here.
- What if her stated diet/restriction can't be safely honored by a generated menu? See Edge Case 1 below (Food-Safety Guardrail).

## Journey 2 — Registered Free Happy Path

**Persona:** Laura, now a registered Free-tier user, returning in a later week.
**Scenario:** She has an account and comes back to plan the current week's meals.

**Step 1**
- User Action: Logs in.
- System Response: Authenticates her and returns her to the product.
- Pain Point: Any friction here undercuts the "faster than doing nothing" promise the product is built on.

**Step 2**
- User Action: Requests this week's menu.
- System Response: Generates a fresh 21-meal menu from scratch — the Free tier has no memory of prior weeks (`.context/business/business-model.md` — Revenue Streams).
- Pain Point: As a returning user, she may reasonably expect the product to already "know her" better than the first time. Free tier intentionally does not do this, which risks feeling like the product hasn't improved — a named business risk, addressed in Edge Case 2 below.

**Step 3**
- User Action: Adjusts the calendar via drag & drop (EPIC-FRESCO-3).
- System Response: Lets her rearrange or swap meals.
- Pain Point: None specific beyond ordinary usability friction.

**Step 4**
- User Action: Uses the aisle-grouped shopping list for her grocery trip (EPIC-FRESCO-4).
- System Response: Presents the list grouped by aisle.
- Pain Point: None specific — this is a low-friction step by design.

**Step 5**
- User Action: Marks recipes cooked or discarded through the week (EPIC-FRESCO-5).
- System Response: Records the toggle, but it does not feed back into next week's Free-tier generation.
- Pain Point: If she assumes marking recipes will make next week's menu better (a reasonable assumption from using the toggle at all), and it doesn't, she may conclude the feature doesn't work, rather than understanding it's a Pro-gated capability. See Edge Case 2.

**Expected Outcome:** Laura gets a usable weekly menu and shopping list every week at zero cost, but does not experience the compounding "gets better over time" value proposition — she remains a candidate for upgrading to Pro or churning to a competing alternative if she never perceives that upside.

## Journey 3 — Registered Pro Happy Path

**Persona:** Laura, a paying Pro-tier subscriber, returning in a later week after at least one prior week of usage.
**Scenario:** She has been using Fresco long enough for the system to have behavioral data from her cooked/discarded toggles.

**Step 1**
- User Action: Logs in.
- System Response: Authenticates her and returns her to the product.
- Pain Point: Same as Free tier — friction here undercuts the core promise.

**Step 2**
- User Action: Requests this week's menu.
- System Response: Generates a menu informed by last week's cooked/discarded signals — avoiding discarded recipes, prioritizing cooked ones, adjusting quantities — and visibly explains the adjustment (e.g., "we adjusted your menu because…") (EPIC-FRESCO-5, US 5.2–5.3).
- Pain Point: If the visible explanation feels generic or unconvincing rather than specific to her actual behavior, the felt-improvement value proposition — the entire basis for the Pro price — fails to land. This is a named risk in `.context/business/market-context.md` (Risks — "the learning moat isn't perceived by users").

**Step 3**
- User Action: Adjusts the calendar via drag & drop.
- System Response: Lets her rearrange or swap meals, same as Free tier.
- Pain Point: None specific.

**Step 4**
- User Action: Uses the aisle-grouped shopping list.
- System Response: Same as Free tier.
- Pain Point: None specific.

**Step 5**
- User Action: Marks recipes cooked/discarded through the week.
- System Response: Records the toggle; this data feeds into next week's generation.
- Pain Point: None specific — this is the intended, working loop.

**Expected Outcome:** Next week's generation demonstrably improves versus this week's, Laura perceives the improvement, and she renews her subscription instead of churning back to a free alternative (e.g., a generic AI chat tool, per `market-context.md`'s Competitive Landscape).

## Edge Case 1 — Allergy / Dietary Restriction Enforcement

**Persona:** Laura (or any user/household), any tier.
**Scenario:** The household has a declared allergy or dietary restriction that must never be violated by a generated menu.

**Step 1**
- User Action: Declares an allergy or dietary restriction (most naturally during onboarding, EPIC-FRESCO-1).
- System Response: Must guarantee that no subsequent generated menu — this week or any future week — surfaces a recipe violating that restriction.
- Pain Point: At the current pre-code, concierge-validation stage, this guarantee is enforced by a manual founder checklist run before every menu delivery, not yet a systematic, code-level guarantee (`.context/business/business-model.md` — Key Activities; EPIC-FRESCO-8 in `mvp-scope.md`). A single human error during this manual phase is a real safety and trust risk, distinct from an ordinary UX bug.

**Expected Outcome:** The user's declared restriction is honored on every single menu, with no exceptions — this is treated as a hard, non-negotiable product-level requirement regardless of implementation stage. (How this is technically enforced once product code exists is intentionally not specified here — that belongs to the SRS phase, not the PRD.)

**Alternative Paths:** `[PLACEHOLDER]` — the brief does not specify what the product should do if a restriction cannot be safely satisfied at all (e.g., conflicting constraints leave no valid recipe) — not invented here.

## Edge Case 2 — Free User Expects Pro-Gated Learning

**Persona:** Laura, Free tier.
**Scenario:** She has been marking recipes cooked/discarded for a few weeks, expecting the menu to adapt, unaware that this behavior is Pro-only.

**Step 1**
- User Action: Marks several recipes cooked/discarded over consecutive weeks (EPIC-FRESCO-5, US 5.1).
- System Response: Records each toggle, but Free-tier generation continues to start from scratch every week with no memory of this data.
- Pain Point: If this limitation isn't communicated clearly at the point of interaction, she may interpret the lack of change as the feature being broken, rather than understanding it as a Pro-only capability — the exact risk named in `.context/business/market-context.md` (Risks — "the Free tier cannibalizes Pro conversion if learning isn't communicated").

**Step 2**
- User Action: Notices (or is shown) that her toggles aren't changing future menus.
- System Response: Should clearly signal — rather than fail silently — that adapting to cooked/discarded behavior is a Pro capability, framed as an upgrade opportunity rather than a defect.
- Pain Point: If this signal is missing or unclear, the product's own mitigation strategy for this named risk fails.

**Expected Outcome:** Laura understands that her cooked/discarded data is being captured, but that Pro is required for it to influence future menus — she experiences this as a legible upsell, not a bug report waiting to happen.
