import { AdminRecipeSearch } from '@/components/admin/admin-recipe-search';

/**
 * `/admin/recipes` — FRESCO-237 PR2. Search-only catalog admin page: finds a
 * recipe by name or slug ahead of the delete action PR3 adds. No dedicated
 * `admin/layout.tsx` — `(app)/layout.tsx` already redirects to `/login` for
 * every route under `(app)/` when there's no session, so a second
 * authenticated-gate layout here would be redundant.
 *
 * No client-side admin check either (comments.md Decision 3): the real
 * authorization boundary is server-side inside the `delete-catalog-recipe`
 * Edge Function's `requireAdminUser()` allowlist check, which reads
 * `ADMIN_USER_ID` — a server-only env var with no client-safe way to read
 * it. A non-admin can open this page and search; PR3's delete action is
 * what actually enforces admin-only, via a 403 from the function itself.
 */
export default function AdminRecipesPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-h2">Catálogo de recetas (admin)</h1>
      <p className="mt-1 text-body-md text-tertiary">
        Busca una receta del catálogo por nombre o slug.
      </p>
      <AdminRecipeSearch />
    </div>
  );
}
