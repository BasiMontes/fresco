import { notFound } from 'next/navigation';
import { AdminRecipeSearch } from '@/components/admin/admin-recipe-search';
import { isAdminUser } from '@/lib/auth/is-admin';
import { createClient } from '@/lib/supabase/server';

/**
 * `/admin/recipes` — FRESCO-237. Search the catalog by name or slug, delete
 * a recipe from it. No dedicated `admin/layout.tsx` — `(app)/layout.tsx`
 * already redirects to `/login` for every route under `(app)/` when there's
 * no session, so a second authenticated-gate layout here would be
 * redundant.
 *
 * FRESCO-738 (A5-H8): previously had no role gate at all — any authenticated
 * user could open this page and see the admin search UI + a delete button
 * that would only 403 once clicked (the real authorization boundary was
 * server-side inside `delete-catalog-recipe`'s `requireAdminUser()` check).
 * That left the admin surface's existence, and the ability to search the
 * full catalog through it, visible to any signed-in account. Now gated here
 * too, at the page's own render — `isAdminUser()` mirrors
 * `requireAdminUser()`'s allowlist exactly (same `ADMIN_USER_ID`, no
 * `is_admin` DB column exists), and a non-admin gets a plain `notFound()`
 * rather than a redirect or a 403 page, so the route's existence isn't
 * disclosed either. `delete-catalog-recipe`'s own check stays as-is — this
 * is a second, earlier gate, not a replacement for it.
 */
export default async function AdminRecipesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminUser(user.id)) {
    notFound();
  }

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
