import type { SupabaseClient } from '@supabase/supabase-js';
import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';
import type { OnboardingProfilePayload } from '@/lib/api/user-profile';
import type { Database } from '@/lib/supabase/types';
import { getIsoWeek } from '@/lib/date/iso-week';
import { perfilCompraDesde } from '@/lib/grocery/product-compatibility';
import { costeSemanalEstimado } from '@/lib/grocery/weekly-cost';
import { advertenciasConPresupuesto, avisoPresupuesto } from '@/lib/menu/budget-warning';
import { snapshotBudgetWarning } from '@/lib/menu/snapshot-budget-warning';

interface RefreshBudgetWarningArgs {
  /** ISO week of the plan, `YYYY-Www`. */
  semanaIso: string
  plan: Pick<MenuSemanalPersistido, 'mealPlanId' | 'menu' | 'advertencias'>
  userId: string | undefined
  dietaryPreferences: OnboardingProfilePayload | null
  presupuestoSemanaEuros: number | null
}

/**
 * The weekly cost of a menu and its warnings with the budget one brought up to date (FRESCO-1269, FRESCO-1320).
 * One estimate for every screen: `/menu` shows the cost in its spend tile, `/calendar` shows the warning of
 * the week on screen, and the stored `meal_plans.advertencias` is written back so it never holds a stale amount.
 * A past week keeps what it had and is not written: today's prices and budget say nothing about it.
 */
export function refreshBudgetWarning(
  supabase: SupabaseClient<Database>,
  { semanaIso, plan, userId, dietaryPreferences, presupuestoSemanaEuros }: RefreshBudgetWarningArgs,
): { costeEstimado: number | undefined, advertencias: string[] } {
  const stored = plan.advertencias ?? [];
  if (semanaIso < getIsoWeek()) {
    return { costeEstimado: undefined, advertencias: stored };
  }
  const costeEstimado = costeSemanalEstimado(plan.menu, {
    numPersonas: dietaryPreferences?.num_personas,
    perfil: perfilCompraDesde(dietaryPreferences),
  });
  const advertencias = advertenciasConPresupuesto(stored, avisoPresupuesto(costeEstimado, presupuestoSemanaEuros));
  snapshotBudgetWarning(supabase, { mealPlanId: plan.mealPlanId, userId, stored, shown: advertencias });

  return { costeEstimado, advertencias };
}
