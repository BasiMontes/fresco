import type { PastMealPlanWeek } from '@/lib/api/meal-plan';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { formatWeekRangeLabel } from '@/lib/date/iso-week';

/**
 * FRESCO-425 — the "Histórico de menús" list. One row per past week, newest
 * first (ordering done by the caller). Each row links to the read-only
 * detail view (`/historial?semana=YYYY-Www`). The cocinada/descartada
 * balance is the visible proof that Fresco has a record of what the
 * household actually cooked — the same signal the Pro learning reads.
 */
export function WeekHistoryList({ weeks }: { weeks: PastMealPlanWeek[] }) {
  return (
    <ul className="flex flex-col gap-2" data-testid="historial_week_list">
      {weeks.map(week => (
        <li key={week.mealPlanId}>
          <Link
            href={`/historial?semana=${week.semanaIso}`}
            data-testid="historial_week_row"
            className="flex items-center justify-between gap-3 rounded-card bg-surface p-4 shadow-sm transition-colors hover:bg-neutral-200"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-label font-sans text-text">
                Semana del
                {' '}
                {formatWeekRangeLabel(week.mondayIso)}
              </span>
              <span className="text-caption text-tertiary">
                {week.cocinadas}
                {' '}
                {week.cocinadas === 1 ? 'receta cocinada' : 'recetas cocinadas'}
                {' · '}
                {week.descartadas}
                {' '}
                {week.descartadas === 1 ? 'descartada' : 'descartadas'}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-tertiary" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
