import type {
  GenerateMealPlanRequest,
  GenerateMealPlanResponse,
  TipoPlatoSlot,
} from '../../../api/schemas/api-contracts.types.ts'
import type { DiaSemana } from '../../../api/schemas/meal-plan.types.ts'
import type { Recipe } from '../../../api/schemas/recipe.types.ts'
import type { UserProfile } from '../../../api/schemas/user-profile.types.ts'

export type { GenerateMealPlanRequest, GenerateMealPlanResponse, TipoPlatoSlot, DiaSemana, Recipe, UserProfile }

/**
 * FR-8.2 / AC Scenario 4 (FRESCO-23): the sentinel value the model must put
 * in a slot's `recipe_id` when NO recipe in the filtered catalog satisfies
 * an absolute rule for that slot — never an unsafe real id, never an
 * ambiguous empty/missing field. Shared by `prompt.ts` (instructs the model)
 * and `validator.ts` (recognizes it) so the literal string can't drift
 * between the two.
 */
export const NO_SAFE_RECIPE_SENTINEL = 'SIN_RECETA_SEGURA'

/** The exact JSON schema Gemini must return — api-contracts.md §1a. */
export interface MenuSemanal {
  semana: string // 'YYYY-WXX'
  menu: Record<DiaSemana, Record<TipoPlatoSlot, string>> // recipe_id per slot
  advertencias: string[]
  /** FR-5.5, Pro + real history only. `null` otherwise — never a placeholder string. */
  explicacion_aprendizaje?: string | null
}
