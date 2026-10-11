# User Journeys — Fresco

> PRD output of `/project-foundation` Phase 2 (Architecture — Product side). Traces back to `.context/PRD/user-personas.md` (Laura) and `.context/PRD/mvp-scope.md` (epics referenced below). Vendor-agnostic — no schemas, API endpoints, prompts, or vendor names belong here. Source: founder-authored brief ("FRESCO — REDEFINICIÓN v3", 2026-07-25).

> **Last reviewed**: 2026-10-11 (FRESCO-848), against the shipped product (`.context/business/business-feature-map.md` and the app code). The steps describe what the product does today; the **pain points are still hypotheses** — no usage data exists yet. What this review changed is in "Review log" at the end.

Only one persona exists at this stage (Laura — see `personas.md`); journeys below are organized by **access tier** (guest / registered Free / registered Pro), since tier — not a distinct persona — is what changes the flow.

## Journey 1 — Guest Happy Path

**Persona:** Laura, as a first-time, unauthenticated visitor.
**Scenario:** Laura has heard about Fresco and opens it without creating an account, wanting to see if it's worth her time before committing to anything.

**Step 1**
- User Action: Opens Fresco and starts using it without signing up (EPIC-FRESCO-6, Guest Mode).
- System Response: Lets her proceed directly into onboarding with no account required.
- Pain Point: If the no-signup path isn't obvious, she may assume registration is mandatory and bounce before trying the product at all.

**Step 2**
- User Action: Confirms she is at least 14 and accepts the terms and the privacy policy, then completes the 3-step onboarding (diet, favorite cuisines, household size) (EPIC-FRESCO-1). In the diet step she gives her explicit consent for the health data she declares (allergies and restrictions). See Journey 5.
- System Response: Captures her inputs as the basis for menu generation, and records each consent with the version of the text she was shown.
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
- User Action: Uses the aisle-grouped shopping list for her grocery trip (EPIC-FRESCO-4). See Journey 4 for the supermarket links, prices and weekly cost.
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

## Journey 4 — Shopping List With Supermarket Links and Estimated Cost

**Persona:** Laura, registered (Free or Pro) or guest, with a weekly menu and its shopping list.
**Scenario:** She is about to do the weekly grocery shop and wants to know what it will cost and where to find each product, without comparing shelves by hand.

**Step 1**
- User Action: Opens the weekly menu and looks at the estimated weekly spend.
- System Response: Shows one figure for the week, built from the whole week's ingredients bought once (an ingredient used in three recipes counts once for the total). It uses the real price of the matched supermarket product where there is one and an average price for the ingredient type where there is not. It is always an estimate, never a guaranteed price. When earlier weeks have a figure, a line compares this week with their average.
- Pain Point: If the figure feels invented or differs from the one on the shopping list, she stops trusting every number in the product. Both screens must show the same figure for the same week.

**Step 2**
- User Action: Opens the shopping list.
- System Response: Shows the aisle-grouped list. Each line not yet bought can link to the matching product page at a supported supermarket (two chains today) and shows that product's price for the packs needed; with no matched product it falls back to the stored estimate. Products that conflict with her diet or allergens are not offered or priced. The summary shows the estimated total of the week from today onwards.
- Pain Point: A link to the wrong product, or a price for a pack size she would not buy, is worse than no link. Ingredients with no match show no link, which can look like a gap.

**Step 3**
- User Action: Ticks lines off as she shops, or copies the list or downloads it as a spreadsheet to use elsewhere.
- System Response: Ticked lines stop showing the link; the export includes every line, bought or pending.
- Pain Point: None specific. The export is a plain text or CSV file, not a PDF (a deliberate scope decision).

**Expected Outcome:** Laura knows roughly what the week will cost before she shops and can jump straight to the product, instead of re-searching each ingredient. Prices come from an internal catalog refreshed periodically; no price is bought, reserved or checked out through Fresco.

**Alternative Paths / Edge Cases:**
- What if a supermarket stops being offered? Its links and prices disappear from the list, which falls back to the stored estimates; nothing else changes.
- Live shop-by-shop price comparison is not part of this journey: the product shows one linked price per line, not a comparison across chains.

## Journey 5 — Consents Along the Way

**Persona:** Laura, from her first visit to her upgrade to Pro.
**Scenario:** Fresco handles her health data (allergies) and may charge her, so the law asks for explicit, recorded agreement at specific moments. This journey is those moments, not a separate feature she goes looking for.

**Step 1**
- User Action: Visits for the first time.
- System Response: Shows a cookie banner and lets her accept or refuse analytics cookies; the product only measures her visit if she accepts. She can reopen the choice later from the landing page footer.
- Pain Point: A banner that covers the page controls (especially on a small phone) blocks her before she has seen anything.

**Step 2**
- User Action: Starts onboarding, as a guest or by creating an account.
- System Response: Asks her to confirm she is at least 14 years old and to accept the terms and the privacy policy before going on. The agreement is recorded with the version of the text she saw. A guest can give it too, and it stays with her if she later creates an account.
- Pain Point: If this gate reads as bureaucracy before any value, she may leave. It is a legal requirement, so the lever is wording and brevity, not removing it.

**Step 3**
- User Action: Declares allergies or dietary restrictions in the diet step.
- System Response: Asks for her explicit consent to the use of that health data, and records it.
- Pain Point: She may not see why a recipe app needs this. The reason (the safety guarantee in Edge Case 1) should be stated where she is asked.

**Step 4**
- User Action: Chooses to upgrade to Pro (Journey 6) and ticks the waiver of her right to withdraw.
- System Response: Records that waiver before sending her to payment.
- Pain Point: Not ticking it blocks the upgrade, which can feel like an obstacle at the moment of highest intent.

**Expected Outcome:** Every agreement that matters is given by her, at the moment it applies, and kept as an append-only record: she cannot be shown one version of a text and recorded as accepting another, and a record cannot be changed or withdrawn from the app. The texts are provisional until a lawyer reviews them.

**Alternative Paths / Edge Cases:**
- What if the recording fails? She cannot go past the step that needs it, and is asked to try again; nothing is assumed accepted.
- Withdrawing a consent from inside the app is not part of this journey (there is no such flow today).

## Journey 6 — Upgrading to Pro, Monthly or Annual

**Persona:** Laura, a registered Free-tier user who has decided to try Pro. Guests must create an account first.
**Scenario:** She opens her profile and wants to know exactly what she will pay before she is sent to the payment page.

**Step 1**
- User Action: Taps the upgrade option on her profile.
- System Response: Shows a summary before payment: the price the payment provider will actually charge, the billing period, whether the free trial applies to her (a trial is offered once per person), and whether the price includes tax only when the provider says so. When an annual price is configured she can switch between monthly and annual, and the price and renewal change with her choice.
- Pain Point: If the summary and the amount charged ever differ, the trust the whole upgrade rests on breaks. The price is read from the provider, never typed into the screen.

**Step 2**
- User Action: Ticks the waiver of her right to withdraw (Journey 5) and confirms.
- System Response: Records the waiver and sends her to the payment page in Spanish.
- Pain Point: See Journey 5, Step 4.

**Step 3**
- User Action: Pays (or starts the trial) and returns to Fresco.
- System Response: Her plan becomes Pro after the payment provider confirms it; the profile never sets the plan by itself. A daily check corrects any confirmation that was lost on the way.
- Pain Point: A short delay between paying and seeing Pro can read as "it didn't work". She manages or cancels from the same profile through the provider's portal.

**Expected Outcome:** She upgrades knowing the price, period and trial terms, on either plan, and lands in Journey 3 as a Pro user.

**Alternative Paths / Edge Cases:**
- What if the price cannot be loaded? She sees an error and is not offered the checkout from that summary.
- What if an environment has no annual price? Only monthly is offered; nothing breaks.

## Edge Case 1 — Allergy / Dietary Restriction Enforcement

**Persona:** Laura (or any user/household), any tier.
**Scenario:** The household has a declared allergy or dietary restriction that must never be violated by a generated menu.

**Step 1**
- User Action: Declares an allergy or dietary restriction (most naturally during onboarding, EPIC-FRESCO-1).
- System Response: Must guarantee that no subsequent generated menu — this week or any future week — surfaces a recipe violating that restriction.
- Pain Point: This guarantee is now enforced in code, not by a manual founder checklist: recipes that conflict with a declared allergen, diet or disliked ingredient are excluded before any selection happens, and the menu is not generated at all if too few safe recipes remain (`.context/business/business-api-map.md` — Food-safety guardrail; EPIC-FRESCO-8 in `mvp-scope.md`). The residual risk is a recipe whose allergens or ingredients are recorded wrongly in the catalog, which the exclusion cannot see — a safety and trust risk, distinct from an ordinary UX bug.

**Expected Outcome:** The user's declared restriction is honored on every single menu, with no exceptions — this is treated as a hard, non-negotiable product-level requirement regardless of implementation stage. (How this is technically enforced once product code exists is intentionally not specified here — that belongs to the SRS phase, not the PRD.)

**Alternative Paths:** If her restrictions leave too few safe recipes for a full week, the product does not generate a degraded menu. If only one slot has no safe recipe, that slot is marked with a visible warning instead of being filled with an unsafe one (`.context/business/business-api-map.md` — Food-safety guardrail).

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

## Review log

**2026-10-11 (FRESCO-848)**, against the shipped product (`.context/business/business-feature-map.md` and the app code; each new step was checked in the code that implements it).

- **Added**: Journey 4 (shopping list with supermarket links and estimated cost), Journey 5 (consents along the way) and Journey 6 (upgrading to Pro, monthly or annual).
- **Changed**: the header (journeys now describe the shipped product; pain points stay hypotheses), Journey 1 Step 2 (age, terms, privacy and health-data consent), Journey 2 Step 4 (pointer to Journey 4), Edge Case 1 (the food-safety guarantee is enforced in code, and what happens when too few safe recipes remain).
- **Not re-verified, left as written**: the onboarding step contents and the "under 30 seconds" and "21 meals" promises in Journey 1; the calendar, the cooked/discarded loop and the Free-versus-Pro learning split in Journeys 2, 3 and Edge Case 2; the placeholder in Journey 1 about an unsaved guest menu.
- **Out of scope here**: any comparison of prices across supermarkets (the product shows one linked price per line), withdrawing a consent from inside the app (no such flow exists), and the family plan.
- **Path**: the ticket names `.context/business/user-journeys.md`; the file lives at `.context/PRD/user-journeys.md`.
