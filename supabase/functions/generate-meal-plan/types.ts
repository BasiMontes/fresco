import type {
  GenerateMealPlanRequest,
  GenerateMealPlanResponse,
  TipoPlatoSlot,
} from '../../../api/schemas/api-contracts.types.ts'
import type { DiaSemana } from '../../../api/schemas/meal-plan.types.ts'
import type { Recipe } from '../../../api/schemas/recipe.types.ts'
import type { UserProfile } from '../../../api/schemas/user-profile.types.ts'

export type { GenerateMealPlanRequest, GenerateMealPlanResponse, TipoPlatoSlot, DiaSemana, Recipe, UserProfile }

/** The exact JSON schema Gemini must return — api-contracts.md §1a. */
export interface MenuSemanal {
  semana: string // 'YYYY-WXX'
  menu: Record<DiaSemana, Record<TipoPlatoSlot, string>> // recipe_id per slot
  advertencias: string[]
}
