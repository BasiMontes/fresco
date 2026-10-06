import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { after } from 'next/server';

interface SnapshotWeeklyCostArgs {
  userId: string | undefined
  semanaIso: string
  costeEstimado: number | undefined
  /** `getSpendTrend`'s result: its last point IS this week. */
  spendTrend: { costeEstimado: number | null }[]
}

/**
 * FRESCO-535: persist this week's cost the first time it's computed, so
 * the spend comparison has a real historical point for this week going
 * forward. `coste_estimado is null` makes the DB write itself idempotent —
 * a later render of the same week never overwrites the first value it
 * wrote, per the story's own AC (a snapshot reflects what was estimated AT
 * THE TIME, not a live-updating figure). `spendTrend`'s last point IS this
 * week (see `getSpendTrend`'s expected-week ordering) and was already
 * fetched in the same `Promise.all` — checking it here skips the
 * network round trip entirely for every render after the first one this
 * week, instead of sending a write that would just match 0 rows.
 */
export function snapshotWeeklyCost(supabase: SupabaseClient<Database>, { userId, semanaIso, costeEstimado, spendTrend }: SnapshotWeeklyCostArgs): void {
  const currentWeekAlreadyPersisted = spendTrend.at(-1)?.costeEstimado != null;
  if (costeEstimado === undefined || !userId || currentWeekAlreadyPersisted) {
    return;
  }
  // `after()` (not fire-and-forget `void promise`): on Vercel's serverless
  // runtime, an unawaited promise is not guaranteed to keep running once
  // the response has been sent — `after()` is Next's documented mechanism
  // for exactly this "side effect that shouldn't block the response" case
  // (`node_modules/next/dist/docs/.../after.md`), via `waitUntil` under
  // the hood. A write failure still must never affect this page's render
  // (this callback runs after the response is already on its way), same
  // fail-soft posture as every other side-effect-free read.
  after(async () => {
    const { error } = await supabase
      .from('meal_plans')
      .update({ coste_estimado: costeEstimado })
      .eq('user_id', userId)
      .eq('semana_iso', semanaIso)
      .is('coste_estimado', null);

    if (error) {
      console.error('[/menu] failed to persist coste_estimado for the spend trend', error);
    }
  });
}
