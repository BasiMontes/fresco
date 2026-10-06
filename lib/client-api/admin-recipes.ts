import { searchCatalogRecipes as searchCatalogRecipesFor } from '@/lib/api/admin-recipes';
import { createClient } from '@/lib/supabase/client';

/** ADR-0041: the admin catalog search of `lib/api/admin-recipes`, bound to the signed-in browser session. */

export async function searchCatalogRecipes(query: Parameters<typeof searchCatalogRecipesFor>[1]) {
  return searchCatalogRecipesFor(createClient(), query);
}
