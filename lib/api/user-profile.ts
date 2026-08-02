import type { UserProfile } from '@schemas';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { ALERGENO_VALUES, INGREDIENTE_ODIADO_VALUES } from '@/lib/constants/dietary-options';

/**
 * Onboarding-owned subset of `user_profiles` columns (FR-1.1). Fields the DB
 * defaults and this story never touches (`plan`, `plan_expires_at`,
 * `nivel_picante`, `contundencia_preferida`, `tiempo_max_*`,
 * `presupuesto_semana_euros`, `ingredientes_favoritos`) are intentionally
 * excluded — see STORY-FRESCO-5's implementation plan, "Types & Type Safety".
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
>;

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
 * Reads the CURRENTLY authenticated user's plan tier (FRESCO-15 — gates the
 * "esto es una función Pro" notice shown to Free users). Defaults to
 * `'free'` when no profile row exists yet (onboarding not completed) rather
 * than throwing — a missing profile isn't an error for this read, callers
 * that need the profile itself already fail fast via other paths.
 */
export async function getUserPlan(
  client: SupabaseClient<Database>,
): Promise<UserProfile['plan']> {
  const { data: { user }, error: userError } = await client.auth.getUser();

  if (userError || !user) {
    throw new UserProfileError('No hay una sesión autenticada para leer el perfil.');
  }

  const { data, error } = await client
    .from('user_profiles')
    .select('plan')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw new UserProfileError(`No se pudo leer el perfil: ${error.message}`);
  }

  return data?.plan ?? 'free';
}

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
 */
export async function getUserNombre(
  client: SupabaseClient<Database>,
): Promise<string | null> {
  const { data: { user }, error: userError } = await client.auth.getUser();

  if (userError || !user) {
    throw new UserProfileError('No hay una sesión autenticada para leer el nombre.');
  }

  const { data, error } = await client
    .from('user_profiles')
    .select('nombre')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw new UserProfileError(`No se pudo leer el nombre: ${error.message}`);
  }

  return data?.nombre ?? null;
}
