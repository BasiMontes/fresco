# ADR-0071 — Pro adds soft menu preferences next to the behavioral-learning moat

- **Status:** Accepted
- **Date:** 2026-11-23
- **Deciders:** Founder (confirmed on card FRESCO-1272, audit 10 finding F2)
- **Tags:** pricing-model, personalization, menu-generation, amends-adr-0001
- **Supersedes:** — <!-- amends ADR-0001; does not replace it -->
- **Superseded by:** —

---

## Context

ADR-0001 draws the Free/Pro line at behavioral learning: recording the cooked and discarded signal is universal, applying it to the next menu is Pro. To justify that line it calls declared-preference personalization (the user says which cuisines, dislikes or spice level they like) "table stakes", because a generic AI chat can remember a pasted list of stated preferences. The moat it names is the compounding cooked/discarded signal.

Between 2026-11-17 and 2026-11-18 three cards shipped declared preferences as **Pro-only** inputs of menu generation:

- FRESCO-1226: favourite cuisines (`user_profiles.cocinas_favoritas`) as a soft score term, `supabase/functions/generate-meal-plan/cuisine.ts`. FR-5.4 already listed it as signal 7 ("prefer, never force").
- FRESCO-1227: the onboarding goal (`objetivo`) and cooking level (`nivel_experiencia`) as soft score terms, `supabase/functions/generate-meal-plan/goal-level.ts`.
- FRESCO-1232: the onboarding says that favourite cuisines personalize the menu in Pro, and `onboarding-step-identity.tsx` says "Con Pro, tu objetivo inclina el menú hacia lo que buscas."

The audit of 2026-11-23 (finding F2) noticed that the product now sells part of Pro on exactly the kind of personalization ADR-0001 called table stakes, and that no decision record, SRS row or glossary entry said so. `domain-glossary.md` still banned calling hard filtering "personalization" without saying which kind. The founder confirmed on 2026-11-23 that this is a deliberate repositioning, not a slip.

## Decision

**We will keep ADR-0001's moat as the main reason to pay for Pro and add declared soft preferences to Pro as a second, smaller one.**

Concretely:

- Pro and Family users get three declared inputs nudging the menu: favourite cuisines, goal and cooking level. Free users keep exactly the menu they had: `index.ts` passes the three values only when `isPro`, the same gate as the history.
- They are **soft**: a score nudge, never an exclusion. The combined sum of every Pro-only soft term is clamped to `[-SOFT_CAP, +SOFT_CAP]` (`SOFT_CAP = 0.5`, a span of 1.0), so allergens, disliked ingredients, the discard and history rules, the season and the category repeats all outrank them (FR-5.4 priority table).
- Where the data does not exist, the term does nothing and says so: `perder_peso` and `ganar_masa_muscular` change nothing because the catalog has no calories or protein. The product must not promise what no data backs.
- ADR-0001's invariant is untouched: no code path may pass Free-tier cooked/discarded history into a generation prompt. This ADR adds no new Free-tier history.
- The two Pro mechanisms stay separate in the language: "behavioral learning" is the moat; "soft preference" is a declared nudge. Neither is called "personalization" without saying which (glossary §4).

## Consequences

- **Positive:** Pro has a benefit a new subscriber can feel in the first menu, before any cooked/discarded history exists. ADR-0001 leaves that first week empty by design, and the founder's risk list (`market-context.md`) names a Free tier that cannot perceive improvement.
- **Negative / trade-offs:** a user can read "Pro personalizes the menu" and conclude that Pro is only stated preferences, which a chat tool can imitate. The defensible part is still the learning signal, so the copy has to keep pointing at it. Free users also see a notice in the onboarding that favourite cuisines personalize the menu in Pro (`COCINAS_PRO_AVISO`): an upsell in the spirit of FR-5.6, whose wording has to stay honest about what the nudge can and cannot do.
- **Negative / trade-offs:** the soft terms add scoring surface that is easy to over-tune. The cap and the golden tests (`favourite-cuisines.golden.json`, `goal-level.golden.json`) are what keep a Free menu byte-identical.
- **Neutral / follow-ups:** the SRS priority table (FR-5.4) lists goal and level next to favourite cuisines; the glossary has a "soft preference" row. If the concierge validation shows these inputs are the reason people upgrade, revisit whether the learning signal is still the main one.

## Alternatives considered

- **Keep ADR-0001 literally and remove the soft preferences from Pro.** Rejected: the three terms are cheap, safe (capped, never exclude) and already shipped; removing them would take a visible benefit away to protect a framing the founder no longer holds.
- **Give soft preferences to Free as well.** Rejected: it would erode the Pro boundary further, and the founder's pricing structure gates personalization of the menu, not menu generation itself.
- **Supersede ADR-0001 with a new pricing ADR.** Rejected: the moat, the recording-is-universal rule and the invariant still hold. This ADR adds to them, so ADR-0001 stays Accepted and points here.

## References

- `.context/ADR/ADR-0001-behavioral-learning-moat.md` (amended by this ADR), `.context/ADR/ADR-0008-scorerecipe-personal-engagement-nudge-pro-only.md` for the personal-cook weighting.
- `supabase/functions/generate-meal-plan/cuisine.ts`, `goal-level.ts`, `index.ts` (the `isPro` gate).
- `.context/SRS/functional-requirements.md` FR-5.4 and FR-5.6; `.context/business/domain-glossary.md` §4 and §2.5.
- FRESCO-1226, FRESCO-1227, FRESCO-1232, audit 10 finding F2, FRESCO-1272.
