# Comments for FRESCO-69

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-69)

---

### Basi Montes - 8/3/2026, 4:00:22 PM

## Scope

- Laura can open any recipe card in the Biblioteca (catalog or personal) and see its full detail
- A catalog recipe's detail shows its ingredients, preparation steps, estimated time, difficulty, and diet/allergen tags
- A personal recipe's detail shows its name, ingredients, and preparation steps
- Laura can return to the Biblioteca from the detail view

---

### Basi Montes - 8/3/2026, 4:00:26 PM

## Out Of Scope

- Editing or deleting a recipe from the detail view
- Rating or reviewing a recipe
- Adding a recipe directly to the weekly menu from this view
- Sharing the recipe detail with others

---

### Basi Montes - 8/3/2026, 4:00:33 PM

## Acceptance Criteria

```gherkin
Scenario: View catalog recipe detail
Given Laura is browsing the Biblioteca
When she opens a catalog recipe
Then she sees its name, ingredients, preparation steps, estimated time, difficulty, and diet/allergen tags

Scenario: View personal recipe detail
Given Laura has a personal recipe in her Biblioteca
When she opens it
Then she sees its name, ingredients, and preparation steps, distinguishable as her own recipe

Scenario: Return to the Biblioteca
Given Laura is viewing a recipe's detail
When she chooses to go back
Then she returns to the Biblioteca where she was browsing
```


---

### Basi Montes - 8/3/2026, 4:00:38 PM

## Business Rules Specification

- A personal recipe's detail is visible only to the user who created it (same as its Biblioteca card, FRESCO-68).
- A catalog recipe's detail only shows a recipe within Laura's food-safety profile (same scoping as the Biblioteca grid, FRESCO-9/FRESCO-65).

---

### Basi Montes - 8/3/2026, 4:04:12 PM

## Spec Implementation Plan (Dev)

## Route + data

New route `app/(app)/recipes/[id]/page.tsx` (Server Component). No `master-design-plan.md` exists in this project — per Critical Rule #14 "no plan at all" branch, build against `DESIGN.md` tokens only, reusing live components (same precedent as FRESCO-65/66/67/68).

`lib/api/recipes.ts` gets `getRecipeDetail(client, id, userId?)`:
1. Resolve `userId` (same optional escape hatch as every sibling in this file).
2. Try `recetas_propias` first (`select('*').eq('id', id).maybeSingle()` — RLS already scopes to the caller's own rows, cheap PK lookup). Found → `{ kind: 'propia', receta }`.
3. Else try the catalog: `.rpc('get*filtered*recipes', { p*user*id }).eq('id', id).maybeSingle()` — same food-safety RPC every sibling reuses, chained with `.eq()` the same way `getLatestAvailableRecipes` chains `.order()/.limit()` onto it. A recipe outside Laura's profile (or nonexistent) simply returns no row here, same as an allergen-filtered recipe never appearing in the grid. Found → `{ kind: 'catalogo', receta: toRecipe(row) }`.
4. Neither → `null` → page renders a not-found state.

## UI

`components/recipes/recipe-detail.tsx` — one component, two render branches (`kind === 'propia'` vs `'catalogo'`), not two separate components: the OOS list is identical (no edit/delete/rate/menu-add/share) and the shell (back link, name, ingredients, steps) is shared; only the metadata block differs (catalog shows time/difficulty/cost/tags, personal doesn't have those fields to show).

- Back navigation: plain `next/link` to `/recipes` — satisfies AC's "returns to the Biblioteca where she was browsing" literally; does not attempt to restore client-side filter/search state (out of scope, not asked for).
- Cards become click-through: wrap `RecipeCard`/`PersonalRecipeCard` renders in `recipe-library.tsx` with `next/link` to `/recipes/${id}`.

## Verification

- Unit tests for `getRecipeDetail` (personal hit, catalog hit, neither, DB error, no-session error) mirroring the existing test shapes in `recipes.test.ts`.
- Live-UI: open a catalog recipe from the grid, confirm ingredients/steps/time/difficulty/tags render; open a personal recipe, confirm name/ingredients/steps render with the "Tu receta" tag; click back, confirm return to `/recipes`.


---


_Synced from Jira by sync-jira-issues_
