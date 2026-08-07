import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { addIsoWeeks, formatWeekRangeLabel } from '@/lib/date/iso-week';

/**
 * FRESCO-61 — prev/next controls for `/calendar`. `mondayIso` is the
 * Monday of `semanaIso`, already resolved by the page (via
 * `getDateFromIsoWeek`) so this component doesn't re-derive it.
 *
 * The label describes the actual Monday-Sunday range ("3–9 feb"), not the
 * month-style label from the user's mockup ("FEB 2026") — the data model is
 * strictly weekly (`meal_plans.semana_iso`), and a month framing doesn't fit
 * a week-granular feature (Rule 14: mockup as inspiration, not literal spec).
 */
export function WeekNavigation({ semanaIso, mondayIso }: { semanaIso: string, mondayIso: string }) {
  const label = formatWeekRangeLabel(mondayIso);

  const semanaAnterior = addIsoWeeks(semanaIso, -1);
  const semanaSiguiente = addIsoWeeks(semanaIso, 1);

  return (
    <div className="flex items-center gap-2" data-testid="week_navigation">
      <Link
        href={`/calendar?semana=${semanaAnterior}`}
        aria-label="Semana anterior"
        data-testid="week_nav_prev"
        className="grid size-9 place-items-center rounded-full bg-surface text-primary hover:bg-neutral-200"
      >
        <ChevronLeft className="size-4" />
      </Link>
      <p className="min-w-24 text-center text-label uppercase text-text" data-testid="week_nav_label">
        {label}
      </p>
      <Link
        href={`/calendar?semana=${semanaSiguiente}`}
        aria-label="Semana siguiente"
        data-testid="week_nav_next"
        className="grid size-9 place-items-center rounded-full bg-surface text-primary hover:bg-neutral-200"
      >
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}
