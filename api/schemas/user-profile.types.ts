import type { TipoCocina } from './recipe.types.ts';

// Row shape of `public.user_profiles` — typed-relational (fresco-schema-sql.md
// Block 3), one of the four newly-migrated tables (see migrations/20260725120100).

export type PlanUsuario = 'free' | 'pro' | 'family';
export type NivelPicante = 'ninguno' | 'suave' | 'medio' | 'fuerte';
export type NivelContundencia = 'ligero' | 'media' | 'contundente';

export interface UserProfile {
  id: string
  created_at: string
  updated_at: string
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
  ingredientes_odiados: string[]
  ingredientes_favoritos: string[]
  cocinas_favoritas: TipoCocina[]
  nivel_picante: NivelPicante
  contundencia_preferida: NivelContundencia
  tiempo_max_semana_min: number
  tiempo_max_finde_min: number
  presupuesto_semana_euros: number | null
}
