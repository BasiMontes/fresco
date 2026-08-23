# Comments for FRESCO-237

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-237)

---

### Basi Montes - 8/21/2026, 7:11:42 PM

## Spec Implementation Plan (Dev)

### Problem

The `recipes` catalog (1000 rows) has no DELETE path anywhere — not in the app, not in an Edge Function. A bad or duplicate recipe can only be fixed today via manual SQL through `service*role`. `supabase/migrations/20260726010000*drop*broken*admin*write*policy*on*recipes.sql` already removed a broken RLS policy that accidentally granted every authenticated user write access to `recipes`, and explicitly deferred "design a real admin check" for later. This ticket is that later — scoped deliberately small.

### Scope (decided, not open questions)

- Build BOTH a Supabase Edge Function (service_role, admin-gated DELETE) AND a minimal admin-only Next.js page to search + delete catalog recipes.
- Admin gating = env-var allowlist checked against the caller's JWT inside the Edge Function. No `role`/`is_admin` DB column — that is out of scope, deferred per the migration's own note.
- If the recipe is referenced by any `meal*plan*recipes` row, return a specific error instead of a raw FK violation. No cascade-delete.

### Technical Decisions

1. ***Admin gating is an allowlist, not a role system.*** `recipes.id` deletion authorization is decided by comparing the authenticated caller's `user.id` (or `user.email`) against an env var (`ADMIN*USER*ID`, comma-separated to allow >1 admin later) read inside the Edge Function with `Deno.env.get`. This mirrors the existing `Deno.env.get('SUPABASE*SERVICE*ROLE*KEY')` pattern in `supabase/functions/*shared/service-role-client.ts`. Rationale: single-founder app today — no `role` column on `user*profiles`, no admin table, no `is*admin()` function exists anywhere in the schema. `20260726010000*drop*broken*admin*write*policy*on_recipes.sql` explicitly says "if an actual admin panel needs authenticated-role write access later, design a real admin check then" — inventing a role system now would be scope creep beyond what this ticket asks for. The allowlist is the minimal real check; a role system is a separate future ticket if a second admin ever needs one.
2. ***The Edge Function must use the service-role client for the actual DELETE, not the caller's own client.*** `recipes` currently has zero authenticated-role write policy (that migration dropped the only one, which was broken). So even an allowlisted admin's own JWT-scoped client cannot DELETE the row under RLS — the write has to go through `createServiceRoleClient()` (`supabase/functions/_shared/service-role-client.ts`), exactly like the existing catalog-write path (seed scripts / admin tooling) already bypasses RLS per that migration's comment. The allowlist check IS the authorization gate; RLS enforces nothing extra here by design.
3. ***Client-side admin gating on the Next.js page is UX only, never the real gate.*** A non-admin who guesses the Edge Function URL and has a valid JWT still gets a 403 from the function itself. The page-level check just avoids showing the admin UI to non-admins; it must not be trusted as the security boundary.
4. ***FK-restrict is pre-checked, not caught.**** `meal*plan*recipes.recipe*id` has `ON DELETE RESTRICT` (`supabase/migrations/20260725120100*create*fresco*core*tables.sql:132`). The function runs `select count(**) from meal*plan*recipes where recipe*id = :id` before attempting the delete and returns 409 with a specific count-bearing message if > 0, instead of letting Postgres throw a raw FK-violation that would surface as an opaque 500.

### Task List

1. `supabase/functions/*shared/admin.ts` (new) — `requireAdminUser(user: User): void`, throws `HttpError(403, 'No autorizado')` unless `user.id` (or `user.email`) is in the `ADMIN*USER*ID` env allowlist (split on `,`, trimmed). Mirrors the fail-fast shape of `*shared/auth.ts:16-27`.
2. `supabase/functions/delete-catalog-recipe/index.ts` (new) — CORS preflight, `createRequestClient` + `requireAuthenticatedUser` (anon-key client, same shape as `update-recipe-status/index.ts:29-32`), then `requireAdminUser`, parse `{ recipe*id }` body (400 if missing), FK precheck (`meal*plan*recipes` count by `recipe*id`, 409 with count if > 0), then `createServiceRoleClient()` to perform the actual `.from('recipes').delete().eq('id', recipe_id)`, 404 if no row matched.
3. `supabase/functions/delete-catalog-recipe/types.ts` (new) — `DeleteCatalogRecipeRequest { recipe_id: string }`, `DeleteCatalogRecipeResponse { ok: true }`.
4. `.env.example` (modify) — add `ADMIN*USER*ID` with an inline comment (comma-separated Supabase Auth user IDs, checked by `delete-catalog-recipe`).
5. `lib/api/admin-recipes.ts` (new) — `searchCatalogRecipes(client, query)` (name/slug `ilike`, reuse the `getCatalogRecipes` shape at `lib/api/recipes.ts:127`) + `deleteCatalogRecipe(client, recipeId)` (calls the new Edge Function via `client.functions.invoke`, surfaces the FK 409 message).
6. `app/(app)/admin/recipes/page.tsx` (new) — search input, results list (name, slug, `veces_cocinada`), delete button per row.
7. `components/admin/delete-catalog-recipe-button.tsx` (new) — Cancel/Confirm `Dialog` copied from `components/recipes/delete-recipe-button.tsx:64-93`, calls `deleteCatalogRecipe`, renders the FK-conflict message inline on 409 instead of a generic error.
8. `app/(app)/admin/layout.tsx` (new) — client-side check redirecting non-admins away from `/admin/*`; UX convenience only per Decision 3, never the real gate.

### Acceptance / pass-fail criteria

- Allowlisted admin deletes a catalog recipe with zero `meal*plan*recipes` references → 200, row removed.
- Allowlisted admin attempts to delete a recipe referenced by ≥1 `meal*plan*recipes` row → 409 with a specific "used in N meal plans" message, not a raw Postgres FK error, not a 500.
- Authenticated but non-allowlisted caller → 403.
- Unauthenticated caller → 401.
- Admin page lets the founder search catalog recipes by name/slug and delete via confirm dialog, wired to the real Edge Function end to end.

---

## Review Workload Forecast

Estimated: 804 additions + 6 deletions = 810 total lines
400-line budget risk: High
Chain strategy: stacked-to-main
Decision needed before apply: No

Notes: Chain resolved at planning time (linear, clean split) rather than deferred to git-flow-master — PR1 = backend (`delete-catalog-recipe` function + `_shared/admin.ts` + `.env.example`, ~250 lines), PR2 = admin API client + search/list page (`lib/api/admin-recipes.ts` + `app/(app)/admin/recipes/page.tsx`, ~330 lines), PR3 = delete button + confirm dialog + client-side admin layout guard (`components/admin/delete-catalog-recipe-button.tsx` + `app/(app)/admin/layout.tsx`, ~230 lines). Each PR lands under the 400-line budget on its own.

---


_Synced from Jira by sync-jira-issues_
