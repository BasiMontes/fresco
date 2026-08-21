# Comments for FRESCO-236

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-236)

---

### Basi Montes - 8/21/2026, 5:14:45 PM

## Spec Implementation Plan (Dev)

### Goal

Let a user edit or delete a personal recipe (recetas_propias) they created, closing the gap documented as OOS in recipe-detail.tsx, so account deletion stops being the only path to remove a bad entry.

### Scope

- UPDATE/DELETE RLS policies + GRANT for public.recetas_propias, following the exact `own` pattern already used for SELECT/INSERT
- updateRecetaPropia() and deleteRecetaPropia() in lib/api/recipes.ts
- Edit affordance on /recipes/[id] for a `propia` recipe, reusing CreateRecipeForm's fields/validation in an edit mode
- Delete affordance on /recipes/[id] for a `propia` recipe, reusing delete-week-button.tsx's lightweight Cancel/Confirm Dialog pattern
- On delete, navigate back to /recipes

### Out of scope

- Edit/delete affordances on recipe-library.tsx cards or personal-recipe-card.tsx (confirmed with user: detail-page only for v1)
- Any change to catalog recipes (public.recipes)
- Zod schema introduction (matches existing convention — no schema exists for this table today)

### Implementation steps

1. supabase/migrations/<ts>*add*update*delete*policies*recetas*propias.sql — add `recetas*propias*update*own` and `recetas*propias*delete*own` policies, same `(select auth.uid()) = user_id` predicate as the existing two
2. supabase/migrations/<ts>*grant*update*delete*recetas*propias.sql — `grant update, delete on public.recetas*propias to authenticated;`
3. lib/api/recipes.ts — add `updateRecetaPropia(client, id, input)` and `deleteRecetaPropia(client, id)`, both scoped by `.eq('user_id', user.id)` defense-in-depth (mirrors deleteMealPlan)
4. components/recipes/create-recipe-form.tsx — generalize to accept an optional `receta` (edit mode: pre-fill fields, call updateRecetaPropia instead of createRecetaPropia, different dialog title/button text)
5. components/recipes/recipe-detail.tsx — convert PersonalRecipeDetail's action area into a small client wrapper adding an edit button (opens the generalized form) and a delete button (new component, step 6)
6. components/recipes/delete-recipe-button.tsx (new) — clone of delete-week-button.tsx's Dialog pattern, calling deleteRecetaPropia then router.push('/recipes')
7. lib/api/recipes.test.ts — unit tests for updateRecetaPropia/deleteRecetaPropia (success, not-authenticated, Supabase error paths)

### RLS changes needed

```sql
create policy "recetas*propias*update*own" on public.recetas*propias for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "recetas*propias*delete*own" on public.recetas*propias for delete
  to authenticated using ((select auth.uid()) = user_id);

-- plus GRANT (RLS alone is insufficient per existing migration comment):
grant update, delete on public.recetas_propias to authenticated;
```

### Technical Decisions

- Reuse CreateRecipeForm in edit mode rather than a separate EditRecipeForm — same fields/validation, DRY over duplication.
- Reuse delete-week-button.tsx's lightweight Dialog pattern, not DeleteAccountDialog's typed-confirmation gate — that gate is reserved for materially higher-stakes deletes; a single recipe doesn't meet that bar.
- Not ADR-worthy: follows an existing, already-reviewed RLS/GRANT pattern with no new architectural surface.
- Scope confirmed with user: detail-page only, no card-level affordances in this ticket.

### Review Workload Forecast

Estimated: ~320 additions + ~40 deletions = ~360 total lines
400-line budget risk: Medium
Chain strategy: feature-branch-chain
Decision needed before apply: No (resolved)

---

### Basi Montes - 8/21/2026, 5:38:58 PM

## QA Ready

- PR: https://github.com/BasiMontes/fresco/pull/112 (merged to staging)
- Branch: feat/FRESCO-236-editar-borrar-receta-propia (deleted post-merge)
- Staging: https://fresco-dev.vercel.app — deploy READY (commit fbc816a)
- Scope: edit/delete for personal recipes, detail page only (`/recipes/[id]`)
- Known good test path: log in, open a personal ("Tu receta") recipe detail, use "Editar esta receta" / "Eliminar esta receta"


---


_Synced from Jira by sync-jira-issues_
