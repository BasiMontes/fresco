# ADR-0008 — `scoreRecipe()` personal engagement nudge, Pro/Family-only, sourced from `meal_plan_recipes.estado`

- **Status:** Accepted
- **Date:** 2026-08-23
- **Deciders:** Founder (approved live in-session, FRESCO-239)
- **Tags:** data-model, security-definer-function, pro-tier-differentiation, generation-pipeline
- **Supersedes:** —
- **Superseded by:** —

---

## Context

`scoreRecipe()` (`supabase/functions/generate-meal-plan/menu-selector.ts`) ranks every menu-generation candidate using columns aggregated across **all users** of the app: `recipes.rating_promedio`, `recipes.veces_cocinada`, `recipes.veces_descartada`. ADR-0006 deliberately left this untouched while fixing the Pro exclusion/`destacadas` mechanisms to read personal marks instead of the same aggregate columns, flagging it explicitly as a "Neutral / follow-up": *"If a future story wants the general quality score (`scoreRecipe`) to also be personalized per-user rather than global, that's a separate, larger change (would need per-user rating storage, not just the aggregate `recipes` columns) — out of scope here."*

FRESCO-239 (tech-debt, sourced from `master-implementation-plan.md` §3/§9) is that follow-up. Two design questions had to be settled before implementation, both decided live with the founder:

1. **Storage.** `meal_plan_recipes.estado` (`pendiente`/`cocinada`/`descartada`/`sustituida`) is already tracked per-slot, per-user, and already backs the ADR-0006 mechanism (`get_recent_recipe_marks`, `get_user_cooked_recipe_ids`) — no new table needed. A brand-new `user_recipe_ratings` table (explicit star/thumbs rating) was considered and rejected: bigger scope (new table, RLS, rating UI) for a signal the product doesn't currently ask users to give explicitly.
2. **Tier scope.** ADR-0001 established the behavioral-learning loop (exclusion + `destacadas`) as the Free/Pro pricing boundary — a paid differentiator. Extending personal-marks-driven scoring to Free (which also has `meal_plan_recipes.estado` data, since meal tracking itself isn't Pro-gated) would dilute that boundary. Founder confirmed: Pro/Family only, reusing the same `isPro` gate `generate-meal-plan/index.ts` already applies to `recentRecipeIds` and `explicacionAprendizaje`.

## Decision

**`scoreRecipe()` gains an optional personal-engagement nudge, computed from the calling Pro/Family user's own `meal_plan_recipes.estado` history (all-time, no storage beyond the existing table), added on top of — never replacing — the existing global aggregate heuristic.**

Concretely:
- A new SQL function `get_user_recipe_engagement(p_user_id uuid)` returns `(recipe_id uuid, veces_cocinada_usuario integer, veces_descartada_usuario integer)`, grouped per recipe, all-time (no `p_weeks` window — mirrors `get_user_cooked_recipe_ids`'s reasoning: a personal quality signal shouldn't age out the way the 2-week no-repeat exclusion does). `stable security definer set search_path = public`, keeping the same `mp.user_id = p_user_id and mp.user_id = auth.uid()` ownership check every ADR-0006 function uses — SECURITY DEFINER bypasses RLS, so this check is the only thing stopping cross-user reads (ADR-0001).
- `generate-meal-plan/index.ts` calls this **once** per generation, inside the existing `if (isPro)` block (Free never calls it, `userEngagement` stays `undefined` for Free) — same call-once-not-per-candidate discipline as `get_recent_recipe_marks`/`get_user_cooked_recipe_ids`.
- `scoreRecipe()` takes an optional `userEngagement?: Map<string, { cocinada: number; descartada: number }>` parameter. When present for a candidate: `+= Math.min(cocinada, 5) * 1.0` (personal signal weighted higher than the global `veces_cocinada * 0.3` nudge already in place) and `-= descartada > 0 ? 6 : 0` (a personal discard is a stronger negative than the global `veces_descartada > 2 ? -4` threshold). The existing global heuristic (lines computing from `recipe.rating_promedio`/`recipe.veces_cocinada`/`recipe.veces_descartada`) is **not removed** — it keeps applying to every user including Free, per ADR-0006's explicit "legitimate general quality signal" framing.

## Consequences

**Positive:**
- Closes the exact gap ADR-0006 flagged as future work — `scoreRecipe()` now reflects what a specific Pro/Family user personally cooked or discarded, not just what the whole userbase did.
- Reuses the ADR-0006 pattern end-to-end (table, security-definer shape, ownership check, call-once discipline) — no new architectural surface, just one more function in the same family.
- No new table, no migration of existing data, no new UI — smallest storage footprint that satisfies the ticket.
- Preserves the ADR-0001 Free/Pro boundary: Free's menu quality signal is unchanged (still pure global aggregate).

**Negative / trade-offs:**
- One more SQL round-trip in the Pro path per generation (now three: `get_recent_recipe_marks`, `get_user_cooked_recipe_ids`, `get_user_recipe_engagement`) — same "cheap but real" latency trade-off ADR-0006 already accepted for the first two.
- `veces_cocinada`/`veces_descartada` per-user are recomputed from `meal_plan_recipes` on every generation (no cached/denormalized column) — acceptable at current scale (`stable`, indexed via `idx_mpr_estado` + the `meal_plan_id` join), but a candidate for a materialized view if the user base grows enough to matter.
- The two magic weights (`+1.0` per personal cocinada capped at 5, `-6` for any personal descartada) are a judgment call, not derived from data — same category of hand-tuned constant as the pre-existing global weights (`*2`, `*0.3`, `-4`). Worth revisiting with real usage data once enough Pro users have engagement history.

**Neutral / follow-ups:**
- If the product later wants an explicit rating signal (stars, thumbs), that is still the bigger, separate change ADR-0006 originally deferred — this ADR does not attempt it, it only personalizes the *implicit* cocinada/descartada signal already collected.
- If Free tier is ever opened up to personal-marks-driven scoring, that is a product/pricing decision revisiting ADR-0001's boundary, not a follow-on of this ADR.

## Alternatives considered

- **New `user_recipe_ratings` table with an explicit rating (1–5 or like/dislike).** Rejected for this ticket: bigger scope (new table + RLS policies + a rating UI surface the product doesn't have today) for a signal `meal_plan_recipes.estado` already captures implicitly. Revisit if the product decides it wants explicit ratings for reasons beyond `scoreRecipe()`.
- **Extend the nudge to all tiers (Free included).** Rejected: ADR-0001 frames the behavioral-learning loop as the Free/Pro pricing boundary; scoring Free menus off personal marks would give away part of that differentiator without a pricing/product decision to back it.
- **Fold `get_user_recipe_engagement` into the existing `get_recent_recipe_marks` call by removing its `p_weeks` filter.** Rejected: `get_recent_recipe_marks` intentionally collapses each recipe to its single most-decisive mark within a *window*, for exclusion purposes; the scoring nudge needs *counts, all-time*, a different shape and semantics — mirrors why ADR-0006 itself split exclusion and `destacadas` into two functions rather than one parameterized one.

## References

- `.context/ADR/ADR-0001-behavioral-learning-moat.md` — the Free/Pro boundary this ADR keeps intact.
- `.context/ADR/ADR-0006-pro-learning-loop-driven-by-personal-marks.md` — the ADR whose "Neutral / follow-ups" note this ticket resolves; the function/pattern this ADR extends.
- `supabase/functions/generate-meal-plan/menu-selector.ts` — `scoreRecipe()`, the function being extended.
- `supabase/functions/generate-meal-plan/index.ts` — the `isPro` gate this ADR reuses for the new engagement call.
- `.context/PBI/tech-debts/TECHDEBT-FRESCO-239-personalizar-scorerecipe-por-usuario-no-solo-agreg/tech-debt.md` — FRESCO-239.
- `.context/master-implementation-plan.md` §3/§9 — origin of the tech-debt entry.
