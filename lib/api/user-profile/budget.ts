import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { UserProfileError } from './errors';

/**
 * The CURRENTLY authenticated user's weekly budget in euros, or `null` when they set none (or have no profile
 * row yet). FRESCO-1269: `/menu` compares it with the cost the "Gasto semanal estimado" tile shows, so the budget
 * warning and the tile are one estimate. Its own read, not a column of `getUserDietaryPreferences`: that one
 * round-trips through the `/profile` editor's save and is deliberately limited to what the editor owns.
 *
 * `userId` is required (the page has already resolved it). Throws `UserProfileError` on a read failure; the
 * caller decides what to show, and `/menu` falls back to no warning.
 */
export async function getUserPresupuestoSemana(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<number | null> {
  const { data, error } = await client
    .from('user_profiles')
    .select('presupuesto_semana_euros')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new UserProfileError(`No se pudo leer el presupuesto semanal: ${error.message}`);
  }

  return data?.presupuesto_semana_euros ?? null;
}
