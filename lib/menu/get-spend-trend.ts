import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { addIsoWeeks, getIsoWeek } from '@/lib/date/iso-week';

const WEEKS_IN_TREND = 8;

export interface SpendTrendPoint {
  semanaIso: string
  /** `null` = no `meal_plans` row for this week, or a row with `coste_estimado` not yet computed -- an explicit gap, never coerced to 0. */
  costeEstimado: number | null
}

export class SpendTrendError extends Error {}

/**
 * FRESCO-535 -- the last `WEEKS_IN_TREND` ISO weeks (current week inclusive,
 * chronological order) with whatever `coste_estimado` is persisted for each.
 * Always returns exactly `WEEKS_IN_TREND` points, one per expected week,
 * built from the full expected-week list first and left-joined against the
 * DB rows in memory -- a week with no `meal_plans` row at all still gets its
 * own point (`costeEstimado: null`), it never just disappears from the
 * series. That's what lets the chart render an explicit gap instead of
 * silently compressing the x-axis.
 */
export async function getSpendTrend(
  client: SupabaseClient<Database>,
  semanaIso: string = getIsoWeek(),
  userId?: string,
): Promise<SpendTrendPoint[]> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new SpendTrendError('No hay una sesión autenticada para leer la tendencia de gasto.');
    }

    resolvedUserId = user.id;
  }

  const expectedWeeks = Array.from(
    { length: WEEKS_IN_TREND },
    (_, index) => addIsoWeeks(semanaIso, -(WEEKS_IN_TREND - 1 - index)),
  );

  const { data, error } = await client
    .from('meal_plans')
    .select('semana_iso, coste_estimado')
    .eq('user_id', resolvedUserId)
    .in('semana_iso', expectedWeeks);

  if (error) {
    throw new SpendTrendError(`No se pudo leer la tendencia de gasto: ${error.message}`);
  }

  const costeByWeek = new Map((data ?? []).map(row => [row.semana_iso, row.coste_estimado]));

  return expectedWeeks.map(week => ({
    semanaIso: week,
    costeEstimado: costeByWeek.get(week) ?? null,
  }));
}
