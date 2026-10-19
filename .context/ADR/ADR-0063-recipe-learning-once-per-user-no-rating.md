# ADR-0063 — Recipe learning counts once per user and recipe, and the rating signal is retired

- **Status:** Accepted <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-10-19
- **Deciders:** Basi Montes (rating decision taken in conversation on 2026-10-19, option A)
- **Tags:** menu, learning, integrity, product
- **Supersedes:** — (narrows the aggregate-learning rules of ADR-0006 and ADR-0008; neither is rewritten, see the notes appended to each)
- **Superseded by:** —

---

## Context

Audit 7b (A7-AUTHZ-02, A7-LOGIC-05, A7-LOGIC-09, A7-LOGIC-10) found four problems around the menu score:

- The trigger `update_recipe_learning()` added 1 to `recipes.veces_cocinada` / `veces_descartada` on every state change of every slot, with no per-user dedupe. One account could copy a plan into hundreds of weeks (`copy_meal_plan_to_week` took any target week) and discard or cook the same recipe in each, moving a ranking that every household's menu is built from. Three discards already cost a recipe 4 points.
- The season used to score a recipe came from the server clock, so a week generated ahead across a season boundary was scored with the wrong season and the same user, seed and week gave two menus.
- With the Pro history exclusion, a narrow profile that marks its meals diligently could empty a type of dish, and the menu then said the person's allergies left no recipes.
- The heaviest term of the score, `rating_promedio * 2`, was 0 for every recipe: no screen ever sent a rating, and a `cocinada` slot cannot be patched again. Live: 0 of 538 active recipes had a rating; 4 of 252 slots were cooked.

The rating needed a product decision: add a rating step to "cocinada", or retire the weight and the path.

## Decision

1. **Learning counts once per (user, recipe).** `recipe_user_feedback(user_id, recipe_id, cocinada_at, descartada_at)` records the first time each user cooked or discarded each recipe; `update_recipe_learning()` moves `veces_cocinada` / `veces_descartada` only when it inserts that mark. It was backfilled from the existing marks; the counters themselves were not recomputed because the hosted values (211 cooked, 102 discarded) are mostly seed values no mark explains.
2. **`copy_meal_plan_to_week` only targets the current or the next ISO week** (Madrid), and `fecha_inicio` must be that week's Monday.
3. **The season is the planned week's**, read from `fecha_inicio` (`seasonOf`), not from the clock.
4. **History exclusion is a preference, not a dead end.** It stays hard while it leaves something to choose from (ADR-0001); when it empties a type, that type falls back to every safe candidate, and the "no recipe compatible with your allergies" warning is judged on those.
5. **The rating signal is retired (option A).** The selector has no rating term, `update-recipe-status` ignores a `rating` in the body, and the trigger no longer touches `rating_promedio` / `veces_calificada`. The columns stay as history; dropping them is destructive and buys nothing.

The invariant: **no single account moves a global ranking by repeating an action, and a menu is a function of (user, seed, planned week, catalogue), not of the day it is generated.**

## Consequences

- **Positive:** the global counters resist one-account manipulation; the same week gives the same menu whenever it is generated; a Pro user with a narrow profile gets a full week and an honest warning; no dead rating code path misleads the next reader.
- **Negative / trade-offs:**
  - The score loses a signal it never had data for. If the product wants ratings later, it needs a screen that sends them, a per-user table like `recipe_user_feedback` (a rating is per user too), and a weight chosen from real volume. That is a new decision, not a revert.
  - A user can still move a counter by 1 per recipe. With many throwaway accounts that is possible; the captcha-gated sign-up and the 60/hour limit on `update-recipe-status` bound it.
  - `copy_meal_plan_to_week` can no longer copy a menu into an arbitrary week. "Usar este menú" always targeted this week or the next; nothing in the app called it for anything else.
- **Neutral / follow-ups:** adding a recipe to the catalogue still reshuffles tie-breaks (the jitter is drawn per candidate in array order); the determinism holds for a frozen catalogue. Noted by the audit as INFO.

## Alternatives considered

- **Add a rating step to "cocinada" (option B).** More interface and one more question per cooked dish, with almost no cooked dishes to learn from, and the rating is the most manipulable global term. Rejected for now; the door stays open as described above.
- **Recompute the counters from `recipe_user_feedback`.** It would zero the seeded values the catalogue ranking currently relies on. Rejected.
- **Drop `rating_promedio` and `veces_calificada`.** Destructive, no benefit; the columns are inert. Rejected.
- **A hard cap on how many times a user can mark per day instead of a per-user table.** Bounds the damage but still lets one account move a counter by many. Rejected.
