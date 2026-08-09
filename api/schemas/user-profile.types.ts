import type { TipoCocina } from './recipe.types.ts';

// Row shape of `public.user_profiles` — typed-relational (fresco-schema-sql.md
// Block 3), one of the four newly-migrated tables (see migrations/20260725120100).

export type PlanUsuario = 'free' | 'pro' | 'family';
export type NivelPicante = 'ninguno' | 'suave' | 'medio' | 'fuerte';
export type NivelContundencia = 'ligero' | 'media' | 'contundente';
export type SexoUsuario = 'mujer' | 'hombre' | 'otro' | 'prefiero_no_decir';
export type ObjetivoUsuario
  = | 'perder_peso'
    | 'comer_sano'
    | 'ahorrar_dinero'
    | 'ganar_masa_muscular'
    | 'comer_variado'
    | 'reducir_desperdicio';

export interface UserProfile {
  id: string
  created_at: string
  updated_at: string
  /** Display name for the `/menu` greeting (FRESCO-55). Nullable — falls back to a generic greeting when unset. */
  nombre: string | null
  /** Onboarding step 1 (FRESCO-132). Nullable — optional signal for recipe recommendations. */
  sexo: SexoUsuario | null
  /** Onboarding step 1 (FRESCO-132). Nullable — used to focus recipe recommendations. */
  objetivo: ObjetivoUsuario | null
  plan: PlanUsuario
  plan_expires_at: string | null
  num_personas: number
  adultos: number
  ninos: number
  dieta_vegetariano: boolean
  dieta_vegano: boolean
  dieta_sin_gluten: boolean
  dieta_sin_lactosa: boolean
  dieta_sin_huevo: boolean
  dieta_keto: boolean
  dieta_halal: boolean
  /** See recipe.types.ts `Alergeno` for the 13-vs-14 EU allergen list note. */
  alergenos: string[]
  /** Onboarding step 2 (FRESCO-133). Free-text note for diet/restrictions not covered by the predefined chips. */
  dieta_texto_libre: string | null
  /** Onboarding step 2 (FRESCO-133). Free-text note for allergens not covered by the predefined chips. */
  alergenos_texto_libre: string | null
  ingredientes_odiados: string[]
  /** Onboarding step 2 (FRESCO-133). Free-text note for disliked ingredients not covered by the predefined chips. */
  ingredientes_odiados_texto_libre: string | null
  ingredientes_favoritos: string[]
  cocinas_favoritas: TipoCocina[]
  /** Onboarding step 3 (FRESCO-133). Free-text note for favorite cuisines not covered by the predefined chips. */
  cocinas_texto_libre: string | null
  nivel_picante: NivelPicante
  contundencia_preferida: NivelContundencia
  tiempo_max_semana_min: number
  tiempo_max_finde_min: number
  presupuesto_semana_euros: number | null
}
