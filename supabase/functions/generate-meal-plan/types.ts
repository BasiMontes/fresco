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
 * FR-8.2 / AC Scenario 4 (FRESCO-23): the value `menu-selector.ts` assigns
 * to a slot's `recipe_id` when NO recipe in the filtered catalog satisfies
 * an absolute rule for that slot — never an unsafe real id, never an
 * ambiguous empty/missing field. Pre-dates ADR-0005 (when a Gemini prompt
 * had to be instructed to emit this literal string itself); now assigned
 * directly by the deterministic selector, but kept as the same sentinel so
 * `index.ts`'s persistence/enrichment logic didn't need to change.
 */
export const NO_SAFE_RECIPE_SENTINEL = 'SIN_RECETA_SEGURA'
