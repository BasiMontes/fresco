# Review — FRESCO-57

Solo mode, self-review (fresh-eyes pass over the diff before commit).

## Diff

- `lib/api/recipes.ts` (new): `getAvailableRecipesCount()`.
- `lib/api/recipes.test.ts` (new): 6 unit tests.
- `components/menu/available-recipes-card.tsx` (new): tappable count card.
- `app/(app)/menu/page.tsx`: fetches the count, renders the card in both branches.

## Findings

None legitimate. Considered and dismissed:

- **Duplicate a `count(*)` SQL query instead of reusing `get_filtered_recipes()`?** Dismissed — the RPC already encodes the exact food-safety rule set (allergens, diet flags, disliked ingredients) that ADR-0001 requires; a second hand-rolled count query would be a second place that logic has to stay in sync, and could silently drift (the exact bug class FRESCO-9's own migration history already hit once with `dieta_keto`/`dieta_halal`).
- **Transfer the full filtered recipe set client-side and take `.length`?** Dismissed — `{ head: true, count: 'exact' }` gets the same number via the `Content-Range` header without shipping ~448 full recipe rows over the wire just to display one integer.
- **Show `0` on a read failure instead of hiding the card?** Dismissed — a real transient DB/network error would then read as "the catalog is empty," which is materially misleading; hiding the card degrades gracefully instead (same philosophy as this page's existing `getMealPlanForWeek`/`getUserNombre` fallbacks).

## Live-UI verification

Ran against the real dev server + the shared QA test account:

- Empty state (no active plan): the card renders "448 recetas disponibles para ti" — the real, profile-filtered count for that account, not a placeholder.
- Click-through: tapping the card navigated to `/recipes`.
- Screenshot taken to confirm layout (icon + number + label, no overlap, consistent card styling with the rest of `/menu`).
- Happy-path render not independently re-verified live for the same reason as FRESCO-56 (no active plan on the test account at the time) — same component instance in both branches, so this is direct evidence for both.
