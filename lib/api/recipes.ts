import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export class RecipesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipesError';
  }
}

/**
 * Counts recipes available to the CURRENTLY authenticated user's profile
 * (FRESCO-57, `/menu` "recetas disponibles" card). Reuses
 * `get_filtered_recipes()` — the same food-safety pre-filter FRESCO-9/
 * ADR-0001 already applies before generating a menu — so this count can
 * never overstate what the user could actually be served.
 *
 * `{ head: true, count: 'exact' }` asks PostgREST for the row count via the
 * `Content-Range` response header only; it never transfers the full
 * filtered recipe set just to measure its length.
 *
 * `userId` is the same optional escape hatch as `getUserNombre` — pages
 * that already resolved `auth.getUser()` can skip the redundant round trip.
 */
export async function getAvailableRecipesCount(
  client: SupabaseClient<Database>,
  userId?: string,
): Promise<number> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new RecipesError('No hay una sesión autenticada para contar las recetas disponibles.');
    }

    resolvedUserId = user.id;
  }

  const { count, error } = await client
    .rpc('get_filtered_recipes', { p_user_id: resolvedUserId }, { head: true, count: 'exact' });

  if (error) {
    throw new RecipesError(`No se pudo contar las recetas disponibles: ${error.message}`);
  }

  return count ?? 0;
}
