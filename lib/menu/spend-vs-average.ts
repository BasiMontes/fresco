import type { SpendTrendPoint } from '@/lib/menu/get-spend-trend';

const AVERAGE_WINDOW_WEEKS = 4;

/**
 * FRESCO-841 — one line comparing this week's estimated spend with the
 * average of the previous (up to) 4 weeks that have a figure. `trend` is the
 * `getSpendTrend` series, current week last. Weeks without data are skipped,
 * never counted as 0 €. No earlier week with data (or a 0 € average) returns
 * `null`: there is nothing honest to compare against.
 */
export function formatSpendVsAverage(
  costeEstimado: number,
  trend: SpendTrendPoint[],
): string | null {
  const previous = trend
    .slice(0, -1)
    .slice(-AVERAGE_WINDOW_WEEKS)
    .flatMap(point => (point.costeEstimado === null ? [] : [point.costeEstimado]));

  if (previous.length === 0) { return null; }

  const average = previous.reduce((sum, value) => sum + value, 0) / previous.length;

  if (average <= 0) { return null; }

  const reference = previous.length === 1 ? 'la semana anterior' : `tu media de ${previous.length} semanas`;
  const percent = Math.round(((costeEstimado - average) / average) * 1000) / 10;

  if (percent === 0) { return `Igual que ${reference}`; }

  const sign = percent > 0 ? '+' : '−';
  const magnitude = String(Math.abs(percent)).replace('.', ',');

  return `${sign}${magnitude} % frente a ${reference}`;
}
