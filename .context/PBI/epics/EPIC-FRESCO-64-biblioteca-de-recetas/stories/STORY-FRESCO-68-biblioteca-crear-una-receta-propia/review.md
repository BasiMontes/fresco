# Review — FRESCO-68

Solo mode, self-review (fresh-eyes pass over the diff before commit).

## Diff

- New migration `20260803000000_create_recetas_propias_table.sql`: typed-relational table `recetas_propias` (mirrors `user_profiles`/`meal_plans` convention, not `recipes`' jsonb shape). RLS: `select_own` + `insert_own` only, `(select auth.uid())` scalar-subquery form per the project's own RLS-optimization convention. No update/delete policy — RLS denies by default, enforcing the OOS "no editar/eliminar" at the DB layer.
- New migration `20260803010000_grant_authenticated_recetas_propias.sql`: table-level GRANT for `authenticated` (select, insert) — RLS restricts rows but never substitutes for the base GRANT; same gap the project already hit once for the other 4 typed tables (`20260729120000_grant_authenticated_table_privileges.sql`).
- `api/schemas/recipe.types.ts`: new `RecetaPropia` type, deliberately separate from `Recipe`.
- `lib/api/recipes.ts`: `getRecetasPropias()` (plain `select` scoped by RLS) + `createRecetaPropia()` (resolves `auth.getUser()`, sets `user_id` explicitly since RLS `with check` requires the match).
- `components/recipes/personal-recipe-card.tsx`: minimal card, "Tu receta" tag, no photo (icon placeholder).
- `components/recipes/create-recipe-form.tsx`: dialog form (reuses the existing `Dialog` primitive from FRESCO-51), touched-gated required-nombre validation mirroring `nombre-form.tsx` exactly. Native `<textarea>` for ingredientes/pasos (one item per line) — no textarea primitive exists yet, same gap `FilterSelect` hit for `<select>` in FRESCO-67.
- `components/recipes/recipe-library.tsx`: "Crear propia" button next to the search bar, opens the dialog; a new "Tus recetas" section renders personal recipes, appended to local state on create (no refetch).
- `app/(app)/recipes/page.tsx`: fetches `getRecetasPropias()` alongside `getCatalogRecipes()`.

## Findings

None legitimate. Considered and dismissed:

- **Merge personal recipes into the same `Recipe[]` filter/predicate chain as the catalog (search/tabs/cocina/dieta/alérgeno)?** Dismissed — a personal recipe has no `clasificacion`/`dieta`/`alergenos` to filter by; forcing it through those predicates would be wrong, not just incomplete. Kept as a separate, unconditional "Tus recetas" section instead — matches the Scope's own wording ("distinguibles de las del catálogo"), nothing more.
- **Textarea primitive.** Same judgment call as FRESCO-67's `FilterSelect`: no primitive exists, a native element minimally styled to match `Input` is proportionate for one story, not a reason to design a new design-system component.
- **No update/delete UI.** Explicitly out of scope (confirmed with the user) — enforced at the DB layer (no RLS policy for those actions), not just withheld in the component tree.

## Real bug found + fixed during live-UI verification

First load of `/recipes` after the schema migration threw `permission denied for table recetas_propias` server-side (caught by the page's own try/catch, degraded to an empty personal-recipes list rather than crashing — same defensive pattern as `getCatalogRecipes`). Root cause: the RLS policies were correct, but Postgres still requires the base table-level `GRANT` for the `authenticated` role, and the `create table` migration never granted it — an exact repeat of the gap `20260729120000_grant_authenticated_table_privileges.sql` fixed for the other 4 typed tables in this project (documented in that migration's own header). Fixed with a dedicated GRANT migration (`20260803010000_...`), re-verified live: the error is gone and `getRecetasPropias()` reads/writes correctly.

## Live-UI verification

Ran against the real dev server + the shared QA test account:

- Empty-nombre submit ("Campos obligatorios" AC): clicking "Guardar receta" with no nombre shows the inline validation message, does not save, dialog stays open.
- Full submit (nombre + ingredientes + pasos): recipe appears immediately under "Tus recetas", tagged "Tu receta", correct ingredient count; dialog closes; no page refetch (optimistic local append).
- Confirmed in DB directly (`select * from recetas_propias`): row persisted with the exact `nombre`/`ingredientes`/`pasos` typed in the form, `user_id` correctly resolved from the session.
- Did not run a full menu-generation cycle to confirm the personal recipe never appears in an AI-generated menu — the DB-level guarantee is structural, not behavioral: `get_filtered_recipes()` and `generate-meal-plan`'s query path only ever reference `public.recipes`, never `public.recetas_propias` (confirmed by reading both, not by exclusion testing). Documented here rather than silently assumed.
