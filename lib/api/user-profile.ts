import type { UserProfile } from '@schemas';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { cache } from 'react';
import { ALERGENO_VALUES, INGREDIENTE_ODIADO_VALUES } from '@/lib/constants/dietary-options';

/**
 * Onboarding-owned subset of `user_profiles` columns (FR-1.1). Fields the DB
 * defaults and this story never touches (`plan`, `plan_expires_at`,
 * `nivel_picante`, `contundencia_preferida`, `tiempo_max_*`,
 * `ingredientes_favoritos`) are intentionally excluded — see STORY-FRESCO-5's
 * implementation plan, "Types & Type Safety". `presupuesto_semana_euros`
 * joined the optional group below with FRESCO-134.
 */
export type OnboardingProfilePayload = Pick<
  UserProfile,
  | 'num_personas'
  | 'adultos'
  | 'ninos'
  | 'dieta_vegetariano'
  | 'dieta_vegano'
  | 'dieta_sin_gluten'
  | 'dieta_sin_lactosa'
  | 'dieta_sin_huevo'
  | 'dieta_keto'
  | 'dieta_halal'
  | 'alergenos'
  | 'ingredientes_odiados'
  | 'cocinas_favoritas'
// `nombre`/`sexo`/`objetivo` (FRESCO-132), the 4 `*_texto_libre` fields
// (FRESCO-133), and `presupuesto_semana_euros` (FRESCO-134) are optional
// here — `/profile`'s preferences editor (FRESCO-70) round-trips this same
// type through `getUserDietaryPreferences` without selecting these columns,
// and a save from there must NOT wipe them (an omitted key drops out of
// Supabase's upsert SET clause entirely, leaving the existing value
// untouched).
> & Partial<Pick<
  UserProfile,
  | 'nombre'
  | 'sexo'
  | 'objetivo'
  | 'dieta_texto_libre'
  | 'alergenos_texto_libre'
  | 'ingredientes_odiados_texto_libre'
  | 'cocinas_texto_libre'
  | 'presupuesto_semana_euros'
>>;

export class UserProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserProfileError';
  }
}

/**
 * Upserts the onboarding profile for the CURRENTLY authenticated user.
 *
 * Public method — fails fast (throws) rather than swallowing errors, per
 * `references/error-handling.md`. Assumes a Supabase session already exists
 * — real or anonymous guest (ADR-0003, FRESCO-17 guarantees one before this
 * is ever called from `app/onboarding/page.tsx`'s mount effect).
 *
 * `alergenos`/`ingredientes_odiados` are validated against the curated
 * option lists (not free text) before persisting — the DB columns are
 * unconstrained `text[]`, and a value outside the catalog's vocabulary would
 * silently fail to filter anything in `get_filtered_recipes()`, defeating
 * the food-safety guardrail without the user ever knowing.
 */
export async function upsertUserProfile(
  client: SupabaseClient<Database>,
  profile: OnboardingProfilePayload,
): Promise<void> {
  const invalidAlergenos = profile.alergenos.filter(value => !ALERGENO_VALUES.has(value));
  const invalidIngredientes = profile.ingredientes_odiados.filter(value => !INGREDIENTE_ODIADO_VALUES.has(value));

  if (invalidAlergenos.length > 0 || invalidIngredientes.length > 0) {
    throw new UserProfileError('Alérgeno o ingrediente no reconocido; usa las opciones disponibles.');
  }

  const { data: { user }, error: userError } = await client.auth.getUser();

  if (userError || !user) {
    throw new UserProfileError('No hay una sesión autenticada para guardar el perfil.');
  }

  const { error } = await client
    .from('user_profiles')
    .upsert({ id: user.id, ...profile });

  if (error) {
    throw new UserProfileError(`No se pudo guardar el perfil: ${error.message}`);
  }
}

/**
 * Onboarding defaults (mirrors `lib/store/onboarding-store.ts`'s
 * `initialState` for `adultos`/`ninos`) — used only as the fallback when no
 * `user_profiles` row exists yet, same conservative-default judgment call as
 * `getUserPlan`'s `'free'` fallback.
 */
const DEFAULT_ONBOARDING_PROFILE: OnboardingProfilePayload = {
  num_personas: 2,
  adultos: 2,
  ninos: 0,
  dieta_vegetariano: false,
  dieta_vegano: false,
  dieta_sin_gluten: false,
  dieta_sin_lactosa: false,
  dieta_sin_huevo: false,
  dieta_keto: false,
  dieta_halal: false,
  alergenos: [],
  ingredientes_odiados: [],
  cocinas_favoritas: [],
};

/**
 * Reads the CURRENTLY authenticated user's onboarding profile (`/profile`
 * preferences editor, FRESCO-70) — every field `upsertUserProfile` requires,
 * not just the dietary ones the editor's UI exposes. A save only lets the
 * user touch the dietary flags/`alergenos`, but it round-trips through
 * `upsertUserProfile`'s full `OnboardingProfilePayload` shape; reading back
 * only the dietary subset would force that save to submit fabricated
 * zero/empty values for `num_personas`/`adultos`/`ninos`/
 * `ingredientes_odiados`/`cocinas_favoritas`, silently wiping real onboarding
 * data the user never asked to change.
 *
 * Same defensive pattern as `getUserNombre`: a missing profile row is not an
 * error for this read, it falls back to `DEFAULT_ONBOARDING_PROFILE`. Same
 * `userId` escape hatch, for the same reason (`/profile` already resolved
 * `auth.getUser()` once at the top of the page).
 */
export async function getUserDietaryPreferences(
  client: SupabaseClient<Database>,
  userId?: string,
): Promise<OnboardingProfilePayload> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new UserProfileError('No hay una sesión autenticada para leer las preferencias.');
    }

    resolvedUserId = user.id;
  }

  const { data, error } = await client
    .from('user_profiles')
    .select('num_personas, adultos, ninos, dieta_vegetariano, dieta_vegano, dieta_sin_gluten, dieta_sin_lactosa, dieta_sin_huevo, dieta_keto, dieta_halal, alergenos, ingredientes_odiados, cocinas_favoritas')
    .eq('id', resolvedUserId)
    .maybeSingle();

  if (error) {
    throw new UserProfileError(`No se pudieron leer las preferencias: ${error.message}`);
  }

  return data ?? DEFAULT_ONBOARDING_PROFILE;
}

/**
 * Reads the CURRENTLY authenticated user's plan tier (FRESCO-15 — gates the
 * "esto es una función Pro" notice shown to Free users). Defaults to
 * `'free'` when no profile row exists yet (onboarding not completed) rather
 * than throwing — a missing profile isn't an error for this read, callers
 * that need the profile itself already fail fast via other paths.
 *
 * Wrapped in `React.cache()` so repeated calls with the *same* arguments
 * within a single render pass (e.g. `(app)/layout.tsx` and
 * `(app)/profile/page.tsx` both resolving the signed-in user's `plan`)
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
export const getUserPlan = cache(async (
  client: SupabaseClient<Database>,
  userId?: string,
): Promise<UserProfile['plan']> => {
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
    .select('plan')
    .eq('id', resolvedUserId)
    .maybeSingle();

  if (error) {
    throw new UserProfileError(`No se pudo leer el perfil: ${error.message}`);
  }

  return data?.plan ?? 'free';
});

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
