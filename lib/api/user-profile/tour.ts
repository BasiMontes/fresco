import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { UserProfileError } from './errors';

/**
 * Whether the person has already seen (or skipped, or closed) the first-visit tour (FRESCO-1197).
 * Read by the authenticated layout, which already holds the user id, so there is no auth round trip
 * here.
 *
 * A missing profile row (onboarding not finished) answers `true`: there is nothing to show yet, and
 * the layout sends that person to `/onboarding` anyway. A read failure THROWS instead of answering
 * "not seen", so the caller picks the fallback. The layout treats it as seen: a tour that does not
 * appear is harmless, one that appears to everyone because of a database blip is not.
 */
export async function getHasSeenTour(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('user_profiles')
    .select('recorrido_visto')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new UserProfileError(`No se pudo leer el perfil: ${error.message}`);
  }

  return data ? data.recorrido_visto : true;
}

/**
 * Records that the person has seen the tour. Called when they skip, close or finish it. The row is the
 * owner's own, written under their session like the other notice flags (`markRoutesNoticeDismissed`).
 */
export async function markTourSeen(
  client: SupabaseClient<Database>,
  userId?: string,
): Promise<void> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new UserProfileError('No hay una sesión autenticada para guardar el perfil.');
    }

    resolvedUserId = user.id;
  }

  const { error } = await client
    .from('user_profiles')
    .update({ recorrido_visto: true })
    .eq('id', resolvedUserId);

  if (error) {
    throw new UserProfileError(`No se pudo guardar el perfil: ${error.message}`);
  }
}
