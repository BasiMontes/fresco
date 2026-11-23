import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { after } from 'next/server';

interface SnapshotBudgetWarningArgs {
  mealPlanId: string
  userId: string | undefined
  /** `meal_plans.advertencias` as stored. */
  stored: readonly string[]
  /** What `/menu` shows now: the stored warnings with the budget warning of the tile's own estimate. */
  shown: readonly string[]
}

/** The `meal_plans_advertencias_bounds` CHECK: at most 20 entries and 4000 bytes of joined text. */
const MAX_ENTRIES = 20;
const MAX_BYTES = 4000;

/**
 * FRESCO-1269: keep `meal_plans.advertencias` in step with the budget warning `/menu` shows, so what is stored
 * is what the user saw. It writes only when the two lists differ: a menu that has not changed costs no write after
 * the first render. Same posture as `snapshotWeeklyCost`: `after()` runs it once the response is on its way, and a
 * failed write is logged and never reaches the page. A list the table would reject is not sent at all.
 */
export function snapshotBudgetWarning(supabase: SupabaseClient<Database>, { mealPlanId, userId, stored, shown }: SnapshotBudgetWarningArgs): void {
  const unchanged = stored.length === shown.length && stored.every((aviso, i) => aviso === shown[i]);
  const withinBounds = shown.length <= MAX_ENTRIES && new TextEncoder().encode(shown.join(' ')).length <= MAX_BYTES;

  if (!userId || unchanged || !withinBounds) {
    return;
  }

  after(async () => {
    const { error } = await supabase
      .from('meal_plans')
      .update({ advertencias: [...shown] })
      .eq('id', mealPlanId)
      .eq('user_id', userId);

    if (error) {
      console.error('[/menu] failed to persist the budget warning in advertencias', error);
    }
  });
}
