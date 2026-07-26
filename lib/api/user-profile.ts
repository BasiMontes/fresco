import type { UserProfile } from '@schemas';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

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
 * `references/error-handling.md`. Assumes an authenticated Supabase session
 * exists (guest-mode onboarding is explicitly out of scope for FRESCO-5); if
 * none is found, this is a pre-existing gap shared with the untouched
 * guest-mode TODO in `app/onboarding/page.tsx`, not introduced by this story.
 */
export async function upsertUserProfile(
  client: SupabaseClient<Database>,
  profile: OnboardingProfilePayload,
): Promise<void> {
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
