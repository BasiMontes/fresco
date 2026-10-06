import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { UserProfileError } from './errors';
import { isPaymentFailedAlertActive } from './plan';

/**
 * Whether the CURRENTLY authenticated user has any unseen Centro de Avisos
 * notice (FRESCO-234, `/menu`'s bell-icon badge) — a binary dot indicator,
 * not a count, so this only ever needs a boolean OR across the same
 * booleans that already gate each notice section on `/notifications`:
 * the welcome notice (`aviso_bienvenida_visto`), the routes notice
 * (`aviso_rutas_descartado`), and the payment-failed alert (`plan === 'pro'`
 * with a non-null `payment_failed_at`, same gate as `/profile`'s card).
 * Deliberately excludes `recommendedRecipes` — that section has no "seen"
 * state at all (no column backs it), so it can't participate in an
 * unseen/seen distinction without inventing new persistence, out of scope
 * here. Same conservative-default pattern as `getShouldShowWelcomeNotice`: a
 * missing profile row just means nothing is unseen.
 */
export async function getHasUnseenNotifications(
  client: SupabaseClient<Database>,
  userId?: string,
): Promise<boolean> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new UserProfileError('No hay una sesión autenticada para leer el perfil.');
    }

    resolvedUserId = user.id;
  }

  const { data, error } = await client
    .from('user_profiles')
    .select('aviso_bienvenida_visto, aviso_rutas_descartado, payment_failed_at, plan')
    .eq('id', resolvedUserId)
    .maybeSingle();

  if (error) {
    throw new UserProfileError(`No se pudo leer el perfil: ${error.message}`);
  }

  if (!data) {
    return false;
  }

  return !data.aviso_bienvenida_visto
    || !data.aviso_rutas_descartado
    || isPaymentFailedAlertActive(data.plan, data.payment_failed_at);
}

/**
 * Whether the Centro de Avisos welcome notice (FRESCO-224) should be shown to
 * the CURRENTLY authenticated user. Same conservative-default pattern as
 * `getUserPlan`/`getUserNombre`: a missing profile row (onboarding not
 * completed) is not an error — it just means the notice stays hidden, same as
 * a row that already has it marked seen.
 */
export async function getShouldShowWelcomeNotice(
  client: SupabaseClient<Database>,
  userId?: string,
): Promise<boolean> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new UserProfileError('No hay una sesión autenticada para leer el perfil.');
    }

    resolvedUserId = user.id;
  }

  const { data, error } = await client
    .from('user_profiles')
    .select('aviso_bienvenida_visto')
    .eq('id', resolvedUserId)
    .maybeSingle();

  if (error) {
    throw new UserProfileError(`No se pudo leer el perfil: ${error.message}`);
  }

  return data !== null && !data.aviso_bienvenida_visto;
}

/**
 * Marks the Centro de Avisos welcome notice (FRESCO-224) as seen for the
 * CURRENTLY authenticated user, so it never shows again. Public method —
 * fails fast (throws) rather than swallowing errors, per
 * `references/error-handling.md`, mirroring `updateNombre`.
 */
export async function markWelcomeNoticeSeen(
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
    .update({ aviso_bienvenida_visto: true })
    .eq('id', resolvedUserId);

  if (error) {
    throw new UserProfileError(`No se pudo guardar el perfil: ${error.message}`);
  }
}

/**
 * Whether the Centro de Avisos main-routes notice (FRESCO-225) should be
 * shown to the CURRENTLY authenticated user. Same conservative-default
 * pattern as `getShouldShowWelcomeNotice`: a missing profile row (onboarding
 * not completed) is not an error — it just means the notice stays hidden,
 * same as a row that already has it marked dismissed.
 */
export async function getShouldShowRoutesNotice(
  client: SupabaseClient<Database>,
  userId?: string,
): Promise<boolean> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new UserProfileError('No hay una sesión autenticada para leer el perfil.');
    }

    resolvedUserId = user.id;
  }

  const { data, error } = await client
    .from('user_profiles')
    .select('aviso_rutas_descartado')
    .eq('id', resolvedUserId)
    .maybeSingle();

  if (error) {
    throw new UserProfileError(`No se pudo leer el perfil: ${error.message}`);
  }

  return data !== null && !data.aviso_rutas_descartado;
}

/**
 * Marks the Centro de Avisos main-routes notice (FRESCO-225) as dismissed
 * for the CURRENTLY authenticated user, so it never shows again. Public
 * method — fails fast (throws) rather than swallowing errors, per
 * `references/error-handling.md`, mirroring `markWelcomeNoticeSeen`. Called
 * from the client (`RoutesNotice`'s dismiss button) via a browser Supabase
 * client, same pattern `NombreForm` already uses for `updateNombre`.
 */
export async function markRoutesNoticeDismissed(
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
    .update({ aviso_rutas_descartado: true })
    .eq('id', resolvedUserId);

  if (error) {
    throw new UserProfileError(`No se pudo guardar el perfil: ${error.message}`);
  }
}
