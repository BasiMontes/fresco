import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export class AdminRecipesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminRecipesError';
  }
}

/** Minimal row shape the admin search list needs (FRESCO-237 PR2). */
export interface CatalogRecipeSearchResult {
  id: string
  slug: string
  nombre: string
  foto_url: string | null
}

/**
 * Admin catalog search (FRESCO-237 PR2, `/admin/recipes`) — `nombre`/`slug`
 * `ilike` match against the FULL `recipes` catalog, deliberately not the
 * food-safety-filtered `get_filtered_recipes()` RPC every reader in
 * `lib/api/recipes.ts` goes through: an admin managing the catalog needs to
 * find any recipe, including ones no household profile would ever see.
 *
 * Plain client select, not the `delete-catalog-recipe` Edge Function —
 * `20260729130000_allow_authenticated_read_recipes.sql` already grants every
 * authenticated user SELECT on `recipes`, so a read-only search doesn't need
 * the service-role write path that function exists for.
 *
 * An empty/whitespace-only query returns `[]` without a round trip — this
 * page has no "browse the whole 1000-row catalog" mode, only search.
 */
export async function searchCatalogRecipes(
  client: SupabaseClient<Database>,
  query: string,
): Promise<CatalogRecipeSearchResult[]> {
  const needle = query.trim();
  if (needle.length === 0) { return []; }

  // A4-L6 (audit-4): `.or()` parses `,` as a term separator and `.`/`()` as
  // operator syntax, so a raw needle like `x,id.eq.<uuid>` injects an extra
  // OR term. PostgREST's fix for reserved characters in a value is to wrap it
  // in double quotes, escaping any embedded `"`/`\` first (see
  // https://docs.postgrest.org/en/v14/references/api/url_grammar.html). The
  // `%` wildcards stay outside the quotes' influence — they reach the ilike
  // operator literally.
  const escaped = needle.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const { data, error } = await client
    .from('recipes')
    .select('id, slug, nombre, foto_url')
    .or(`nombre.ilike."%${escaped}%",slug.ilike."%${escaped}%"`)
    .order('nombre', { ascending: true })
    .limit(50);

  if (error) {
    throw new AdminRecipesError(`No se pudo buscar en el catálogo: ${error.message}`);
  }

  return data ?? [];
}

// PR3's delete call lives in `lib/api/edge-functions.ts`
// (`deleteCatalogRecipe`), not here — every other Edge Function caller in
// this codebase goes through that module's `callEdgeFunction()` helper
// (raw `fetch` + `EdgeFunctionError`), not `client.functions.invoke()`.
