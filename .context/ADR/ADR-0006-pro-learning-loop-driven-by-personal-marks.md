# ADR-0006 — Pro learning loop keyed off personal cocinada/descartada marks, not raw calendar presence

- **Status:** Accepted
- **Date:** 2026-08-08
- **Deciders:** Founder (approved live in-session, choosing between "real mechanism" and "copy-only" fix — see FRESCO-120)
- **Tags:** data-model, security-definer-function, pro-tier-differentiation, generation-pipeline
- **Supersedes:** —
- **Superseded by:** —

---

## Context

A QA sweep (2026-08-08, `.context/business/business-feature-map.md` regeneration + 3-agent parallel test pass) found that `get_recent_recipe_ids()` — the SQL function backing the Pro-tier "no-repeat" exclusion (ADR-0001) — excluded every recipe that appeared in a user's calendar in the last 2 weeks, regardless of `meal_plan_recipes.estado` (`pendiente`/`cocinada`/`descartada`/`sustituida`). A Pro user who never marked anything cocinado/descartado got the exact same exclusion behavior as one who diligently marked every meal.

This directly contradicted the product's own copy in three places (`components/profile/ayuda-section.tsx`'s FAQ, the Pro-upsell card, FRESCO-103's "aprenda de esos marcados" fix from the previous day), all of which promise the mechanism reacts to the user's cooked/discarded marks specifically. ADR-0005 had already flagged this exact risk as a known, accepted trade-off ("this framing should be revisited before any public-facing copy is written that implies the whole menu is LLM-selected") — the QA sweep is that revisit.

A second, related gap: `explicacion_aprendizaje`'s `destacadas` ("recetas que ya te funcionaron bien") was computed from `recipes.veces_cocinada`/`rating_promedio` — columns aggregated across **every user of the app**, incremented by a shared `AFTER UPDATE` trigger, not scoped to the individual Pro user reading the explanation. A brand-new Pro account with zero personal history could be told a recipe "already worked well for you" purely because other users cooked it.

`estado` was already tracked per-slot, per-user, indexed (`idx_mpr_estado`) — the data needed for a real per-user mechanism already existed; it just wasn't being read.

## Decision

**The Pro-tier learning loop now reads `meal_plan_recipes.estado`, scoped to the calling user, for both the exclusion filter and the "destacada" signal — no aggregate/cross-user columns are used for personalization.**

Concretely:
- `get_recent_recipe_ids(p_user_id, p_weeks)` (uuid[]) is replaced by `get_recent_recipe_marks(p_user_id, p_weeks)`, returning `(recipe_id, estado)` per recipe (collapsed to the most decisive mark when a recipe appears more than once in the window: `descartada` > `cocinada` > anything else). Both keep the `mp.user_id = auth.uid()` ownership check the 2026-08-01 hardening pass added to the function being replaced — SECURITY DEFINER bypasses RLS, so this check is the only thing stopping a caller from reading another user's meal history (ADR-0001).
- `generate-meal-plan/index.ts` only pushes `cocinada`/`descartada` marks into the exclusion set passed to `menu-selector.ts`. `pendiente` (never touched) and `sustituida` (swapped, not an explicit signal) are no longer excluded — a user who hasn't interacted with a slot yet no longer loses access to that recipe next week.
- A new function, `get_user_cooked_recipe_ids(p_user_id)`, returns every recipe this specific user has ever marked `cocinada` (no time window — a returning favorite from before the 2-week exclusion window still counts). `destacadas` is now `thisWeek'sChosenRecipes ∩ personalCookedIds`, replacing the old global-column threshold check.
- `buildLearningExplanation` (`prompt.ts`) takes `cocinadasEvitadas`/`descartadasEvitadas` as two separate counts instead of one folded `recientesEvitadas`, and phrases them in two distinct sentences ("evitamos N que ya cocinaste" / "dejamos fuera M que descartaste") — the old single sentence said "ya cocinaste" even when the real reason a recipe was avoided was that the user had discarded it.

## Consequences

**Positive:**
- The Pro "learn from your marks" promise is now literally true for both halves of the mechanism (exclusion and destacadas), not just the copy.
- A Pro user who never marks anything now gets a materially different (weaker) experience than one who does — the tier's core loop finally depends on user engagement with cocinado/descartado, closing the gap the QA sweep found.
- `destacadas` can no longer surface a stranger's cooking history as "something that worked for you."
- `pendiente` recipes are eligible again next week — a user is no longer penalized for recipes she simply hasn't gotten to yet.

**Negative / trade-offs:**
- Two SQL round-trips instead of one in the Pro path (`get_recent_recipe_marks` + `get_user_cooked_recipe_ids`) — both `stable security definer`, cheap, but a real (small) latency addition over the single old call.
- `scoreRecipe()` (`menu-selector.ts`) still uses the global `rating_promedio`/`veces_cocinada`/`veces_descartada` columns as a general quality heuristic applied to **every** user (Free included) — this ADR deliberately does not touch that. It's a legitimate "generally well-rated recipes get a small nudge" signal, not something the product copy claims is personal or Pro-exclusive; conflating it with the `destacadas` fix here would have expanded scope well beyond what FRESCO-120 reported.
- `get_recent_recipe_ids` is dropped, not deprecated-and-kept — any external caller relying on its old uuid[]-only shape (none exist in this codebase, confirmed via `rg`) would break.

**Neutral / follow-ups:**
- If a future story wants the general quality score (`scoreRecipe`) to also be personalized per-user rather than global, that's a separate, larger change (would need per-user rating storage, not just the aggregate `recipes` columns) — out of scope here.
- `p_weeks = 2` (the exclusion window) and "ever" (the destacada window) are asymmetric on purpose — a discard should age out (2 weeks), a personal favorite shouldn't. Worth revisiting if user feedback suggests otherwise.

## Alternatives considered

- **Copy-only fix**: rewrite the FAQ/upsell text to describe the actual mechanism ("Pro doesn't repeat your recent calendar") instead of changing the mechanism. Rejected by the founder in-session — the coarse-grained no-repeat is real, but `destacadas` reading global columns would have remained a data-integrity issue (showing other users' history as personal), and the tier's differentiator would stay non-responsive to the specific marks it's marketed around.
- **Keep one function, add an `estado` array parameter to filter server-side.** Rejected: splitting into `get_recent_recipe_marks` (exclusion) and `get_user_cooked_recipe_ids` (destacadas, different time window and different `estado` value entirely) is simpler than one function trying to serve two different queries with different windows via parameters.

## References

- `.context/ADR/ADR-0001-behavioral-learning-moat.md` — the invariant this ADR's exclusion mechanism must continue upholding.
- `.context/ADR/ADR-0005-deterministic-menu-slot-selection.md` — already flagged this exact gap as an accepted trade-off to revisit (Consequences, "Negative" section, last bullet).
- `supabase/migrations/20260801010000_harden_security_definer_functions.sql` — the `auth.uid()` ownership check both new functions preserve.
- `.context/business/business-feature-map.md` (2026-08-08 regeneration) + the 3-agent QA sweep that found this — FRESCO-120.
