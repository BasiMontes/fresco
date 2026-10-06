import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { cache } from 'react';
import { UserProfileError } from './errors';

/**
 * Updates the CURRENTLY authenticated user's display name (FRESCO-55, `/menu`
 * greeting). Public method — fails fast (throws) rather than swallowing
 * errors, per `references/error-handling.md`, mirroring `upsertUserProfile`.
 *
 * Rejects an empty-after-trim value here rather than relying solely on the
 * caller's UI validation — a defensive guard against a stored value that
 * would only ever render as a broken "¡Hola, !" greeting.
 */
export async function updateNombre(
  client: SupabaseClient<Database>,
  nombre: string,
): Promise<void> {
  const trimmed = nombre.trim();

  if (trimmed.length === 0) {
    throw new UserProfileError('El nombre no puede estar vacío.');
  }

  const { data: { user }, error: userError } = await client.auth.getUser();

  if (userError || !user) {
    throw new UserProfileError('No hay una sesión autenticada para guardar el nombre.');
  }

  const { error } = await client
    .from('user_profiles')
    .update({ nombre: trimmed })
    .eq('id', user.id);

  if (error) {
    throw new UserProfileError(`No se pudo guardar el nombre: ${error.message}`);
  }
}

/**
 * Reads the CURRENTLY authenticated user's display name (FRESCO-55, `/menu`
 * greeting). Same defensive pattern as `getUserPlan`: a missing profile row
 * (onboarding not completed) or a not-yet-set `nombre` is not an error for
 * this read — both simply return `null`, letting the caller fall back to a
 * generic greeting rather than crashing the page.
 *
 * `userId` is an optional escape hatch for callers (`/menu`, `/profile`)
 * that already resolved `auth.getUser()` once at the top of the page — when
 * passed, the internal `auth.getUser()` call is skipped so the page doesn't
 * pay for a third redundant round trip on top of its own call plus the one
 * inside `getMealPlanForWeek`/`getUserPlan`. Omitting it keeps the function
 * safely callable on its own (e.g. in isolation, in tests).
 *
 * Wrapped in `React.cache()` so repeated calls with the *same* arguments
 * within a single render pass (e.g. `(app)/layout.tsx` and
 * `(app)/profile/page.tsx` both resolving the signed-in user's `nombre`)
 * dedupe to one underlying read. Note: this only dedupes when the `client`
 * argument is reference-equal across call sites — today each caller builds
 * its own client via `createClient()`, so the two calls still miss this
 * cache in practice. Making `createClient()` itself request-memoized would
 * close that gap, but it's called from Route Handlers too
 * (`app/api/profile/export/route.ts`, `app/auth/confirm/route.ts`), which
 * sit outside the React render tree — `React.cache()` there would not reset
 * per-request and could leak one request's client into another. Left as-is;
 * the safe half of this fix (memoizing this function's own work per
 * matching arguments) still ships.
 */
export const getUserNombre = cache(async (
  client: SupabaseClient<Database>,
  userId?: string,
): Promise<string | null> => {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new UserProfileError('No hay una sesión autenticada para leer el nombre.');
    }

    resolvedUserId = user.id;
  }

  const { data, error } = await client
    .from('user_profiles')
    .select('nombre')
    .eq('id', resolvedUserId)
    .maybeSingle();

  if (error) {
    throw new UserProfileError(`No se pudo leer el nombre: ${error.message}`);
  }

  return data?.nombre ?? null;
});
