# Comments for FRESCO-68

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-68)

---

### Basi Montes - 8/3/2026, 2:46:43 PM

## Scope

- Formulario para que Laura cargue una receta propia (nombre, ingredientes, pasos) a su biblioteca personal
- Sus recetas propias se ven junto al catálogo en la Biblioteca, distinguibles de las del catálogo

---

### Basi Montes - 8/3/2026, 2:46:44 PM

## Out Of Scope

- La receta propia participa en la generación de menú semanal por IA (confirmado explícitamente con el user: queda fuera)
- Compartir la receta propia con otras usuarias
- Foto o imagen para la receta propia
- Editar o eliminar una receta propia ya creada

---

### Basi Montes - 8/3/2026, 2:46:46 PM

## Acceptance Criteria

```gherkin
Scenario: Crear una receta propia
Given Laura está en la Biblioteca
When completa el formulario "Crear propia" con nombre, ingredientes y pasos, y confirma
Then su receta aparece en su Biblioteca personal

Scenario: Receta propia no participa en la generación
Given Laura tiene una receta propia guardada
When genera un menú semanal nuevo
Then esa receta propia nunca aparece en el menú generado por la IA

Scenario: Campos obligatorios
Given Laura abre el formulario de "Crear propia" sin completar el nombre
When intenta guardar
Then ve un mensaje claro pidiéndole completar el nombre antes de guardar
```

---

### Basi Montes - 8/3/2026, 2:46:47 PM

## Business Rules Specification

- Una receta propia es visible únicamente para la usuaria que la creó.
- Una receta propia no participa en la generación de menú semanal por IA — distinto del catálogo, confirmado explícitamente con el user.

---

### Basi Montes - 8/3/2026, 3:36:56 PM

## Spec Implementation Plan (Dev)

## Schema

New table `public.recetas*propias` (typed-relational, mirrors `user*profiles`/`meal*plans` convention from `20260725120100*create*fresco*core*tables.sql`, NOT the `recipes` jsonb shape — confirmed separate, out of `get*filtered_recipes()`'s reach):

```sql
create table public.recetas_propias (
  id           uuid primary key default gen*random*uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  user*id      uuid not null references public.user*profiles(id) on delete cascade,
  nombre       text not null check (char_length(trim(nombre)) > 0),
  ingredientes text[] not null default '{}',
  pasos        text[] not null default '{}'
);
```

No `dieta`/`alergenos`/`foto_url`/`clasificacion` — explicitly out of scope (Business Rules: never participates in AI generation; OOS: no photo).

RLS: `select*own` + `insert*own` only (row-ownership via `auth.uid() = user_id`). No `update`/`delete` policy — OOS explicitly excludes editing/deleting an already-created personal recipe, and Postgres RLS defaults to deny when no policy exists for an action, so omitting update/delete policies enforces that at the DB layer, not just in the UI.

`updated*at` trigger reuses existing `public.handle*updated_at()`.

## API layer (`lib/api/recipes.ts`)

- `getRecetasPropias(client, userId?)` — same `userId` optional-escape-hatch pattern as `getCatalogRecipes`. Plain `select * from recetas*propias where user*id = ...` (RLS also enforces this, belt-and-suspenders).
- `createRecetaPropia(client, input: { nombre: string; ingredientes: string[]; pasos: string[] })` — resolves `auth.getUser()`, inserts with `user_id` set explicitly (RLS `with check` requires the match).

New type `RecetaPropia` in `api/schemas/recipe.types.ts` (or co-located) — deliberately NOT reusing `Recipe` (would force nulls into every catalog-only field: `slug`, `meta`, `clasificacion`, `dieta`, etc.).

## UI

- `components/recipes/personal-recipe-card.tsx` — minimal card (name, ingredient count, "Tu receta" tag), no photo (icon placeholder, OOS).
- `components/recipes/create-recipe-form.tsx` — client form inside the existing `Dialog` primitive (`components/ui/dialog.tsx`, reused as-is). Fields: nombre (`Input`, required), ingredientes/pasos (native `<textarea>`, one item per line — no textarea primitive exists yet, styled to match `Input`, same reasoning as FRESCO-67's `FilterSelect`). Touched-gated required-nombre validation mirrors `nombre-form.tsx` exactly (disabled submit + inline error, silent until touched).
- `RecipeLibrary` gets a `recetasPropias` prop + a "Crear propia" button (mockup's "CREAR PROPIA") that opens the dialog; on successful create, appends the new row to local state (no full page refetch) and renders personal recipes in a distinct section/tag from the catalog grid — never merged into the same `Recipe[]` filter/predicate chain (personal recipes have no `clasificacion`/`dieta`/`alergenos` to filter by, and forcing them through those predicates would be wrong, not just incomplete).
- `app/(app)/recipes/page.tsx` fetches `getRecetasPropias()` alongside `getCatalogRecipes()`, passes both down.

## Verification

- Lint/types/tests green.
- New unit tests for `getRecetasPropias`/`createRecetaPropia` (mapping, empty, DB error, no-session error) — same shape as FRESCO-65's `getCatalogRecipes` tests.
- Live-UI (Playwright): create a personal recipe via the form, confirm it appears in the Biblioteca tagged as personal; confirm empty-nombre submit shows the inline validation message and does not save; confirm the created recipe does NOT appear in a freshly generated weekly menu (spot-check, not exhaustive — the DB-level guarantee is that `generate-meal-plan` never reads `recetas_propias` at all, since the table isn't in its query path).


---


_Synced from Jira by sync-jira-issues_
