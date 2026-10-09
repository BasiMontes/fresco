import { assignRecipeToSlot as assignRecipeToSlotFor, copyMealPlanToCurrentWeek as copyMealPlanToCurrentWeekFor, deleteMealPlan as deleteMealPlanFor, swapMealPlanSlots as swapMealPlanSlotsFor } from '@/lib/api/meal-plan';
import { createClient } from '@/lib/supabase/client';

/** ADR-0041: the meal-plan writes of `lib/api/meal-plan`, bound to the signed-in browser session. */

export async function assignRecipeToSlot(args: Parameters<typeof assignRecipeToSlotFor>[1]) {
  return assignRecipeToSlotFor(createClient(), args);
}

export async function copyMealPlanToCurrentWeek(sourceMealPlanId: Parameters<typeof copyMealPlanToCurrentWeekFor>[1]) {
  return copyMealPlanToCurrentWeekFor(createClient(), sourceMealPlanId);
}

export async function deleteMealPlan(mealPlanId: Parameters<typeof deleteMealPlanFor>[1]) {
  return deleteMealPlanFor(createClient(), mealPlanId);
}

export async function swapMealPlanSlots(args: Parameters<typeof swapMealPlanSlotsFor>[1]) {
  return swapMealPlanSlotsFor(createClient(), args);
}
