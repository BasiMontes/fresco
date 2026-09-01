import type {
  UpdateRecipeStatusRequest,
  UpdateRecipeStatusResponse,
} from '../../../api/schemas/api-contracts.types.ts'

export type { UpdateRecipeStatusRequest, UpdateRecipeStatusResponse }

/** Shape of the joined slot-ownership read in index.ts step 3. */
export interface SlotOwnershipRow {
  id: string
  estado: string
  meal_plan_id: string
  meal_plans: { user_id: string } | null
}
