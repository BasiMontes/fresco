import type { UserProfile } from '@schemas';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { ALERGENO_VALUES, INGREDIENTE_ODIADO_VALUES } from '@/lib/constants/dietary-options';
import { UserProfileError } from './errors';

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
// `nombre`/`sexo`/`objetivo` (FRESCO-132), the 3 remaining `*_texto_libre`
// fields (FRESCO-133; `alergenos_texto_libre` was dropped from the flow in
// FRESCO-361 — it invited allergens nothing read; the column is kept but
// unused), `presupuesto_semana_euros` (FRESCO-134),
// `planning_selection` (FRESCO-135/136/199), and
// `nivel_experiencia` (FRESCO-137) are optional here — `/profile`'s
// preferences editor (FRESCO-70) round-trips this same type through
// `getUserDietaryPreferences` without selecting these columns, and a save
// from there must NOT wipe them (an omitted key drops out of Supabase's
// upsert SET clause entirely, leaving the existing value untouched; a
// missing key on INSERT falls back to the column's DB default).
> & Partial<Pick<
  UserProfile,
  | 'nombre'
  | 'sexo'
  | 'objetivo'
  | 'dieta_texto_libre'
  | 'ingredientes_odiados_texto_libre'
  | 'cocinas_texto_libre'
  | 'presupuesto_semana_euros'
  | 'planning_selection'
  | 'nivel_experiencia'
>>;

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
 * Whether the CURRENTLY authenticated user has completed onboarding — i.e. a
 * `user_profiles` row exists for them (FRESCO-250). Row-existence is the only
 * reliable signal: `upsertUserProfile()` is the sole writer, and every column
 * it writes is legitimately nullable even on a fully-onboarded row (see
 * `getUserNombre`'s `nombre` and `getUserPlan`'s DB-defaulted `plan`), so
 * neither of those reads can distinguish "no row" from "row with a null/
 * default field" — a dedicated existence check is required.
 */
export async function hasUserProfile(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('user_profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new UserProfileError(`No se pudo comprobar el perfil: ${error.message}`);
  }

  return data !== null;
}

/**
 * FRESCO-806 (audit-6 A6-L5) — every column the onboarding wizard edits, as the
 * database holds them. `/onboarding` pre-fills the wizard from this for a user
 * who already has a profile: without it the wizard started empty and "Empezar"
 * upserted that emptiness over their allergens and diet.
 */
export type SavedOnboardingProfile = Pick<
  UserProfile,
  | 'nombre'
  | 'sexo'
  | 'objetivo'
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
  | 'dieta_texto_libre'
  | 'ingredientes_odiados_texto_libre'
  | 'cocinas_texto_libre'
  | 'presupuesto_semana_euros'
  | 'planning_selection'
  | 'nivel_experiencia'
>;

/**
 * The CURRENTLY authenticated user's saved onboarding profile, or `null` when
 * no `user_profiles` row exists yet (a first-time visitor). Throws on a read
 * failure: the caller must not fall back to an empty wizard, because "Empezar"
 * would then overwrite a profile it could not read.
 */
export async function getUserOnboardingProfile(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<SavedOnboardingProfile | null> {
  const { data, error } = await client
    .from('user_profiles')
    .select('nombre, sexo, objetivo, adultos, ninos, dieta_vegetariano, dieta_vegano, dieta_sin_gluten, dieta_sin_lactosa, dieta_sin_huevo, dieta_keto, dieta_halal, alergenos, ingredientes_odiados, cocinas_favoritas, dieta_texto_libre, ingredientes_odiados_texto_libre, cocinas_texto_libre, presupuesto_semana_euros, planning_selection, nivel_experiencia')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new UserProfileError(`No se pudo leer el perfil guardado: ${error.message}`);
  }

  return data as SavedOnboardingProfile | null;
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
    .select('num_personas, adultos, ninos, dieta_vegetariano, dieta_vegano, dieta_sin_gluten, dieta_sin_lactosa, dieta_sin_huevo, dieta_keto, dieta_halal, alergenos, ingredientes_odiados, cocinas_favoritas, planning_selection')
    .eq('id', resolvedUserId)
    .maybeSingle();

  if (error) {
    throw new UserProfileError(`No se pudieron leer las preferencias: ${error.message}`);
  }

  // FRESCO-153: the underlying `tipo_plato` DB enum also allows `'snack'`,
  // same gap `lib/api/meal-plan.ts` already documents — narrowed here rather
  // than widening `OnboardingProfilePayload`, since the only writers of
  // `planning_selection` (onboarding, this preferences form) offer just
  // desayuno/comida/cena.
  return (data as OnboardingProfilePayload | null) ?? DEFAULT_ONBOARDING_PROFILE;
}
