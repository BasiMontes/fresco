import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { addIsoWeeks, formatWeekRangeLabel, getIsoWeekMonday } from '@/lib/date/iso-week';

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
/** FRESCO-158 — navigation window: 2 weeks back, 2 weeks forward, plus the current week. */
const MAX_WEEK_OFFSET = 2;

/**
 * FRESCO-61 — prev/next controls for `/calendar`. `mondayIso` is the
 * Monday of `semanaIso`, already resolved by the page (via
 * `getDateFromIsoWeek`) so this component doesn't re-derive it.
 *
 * The label describes the actual Monday-Sunday range ("3–9 feb"), not the
 * month-style label from the user's mockup ("FEB 2026") — the data model is
 * strictly weekly (`meal_plans.semana_iso`), and a month framing doesn't fit
 * a week-granular feature (Rule 14: mockup as inspiration, not literal spec).
 *
 * FRESCO-158 — user-reported finding: navigation was unbounded, letting a
 * user scroll arbitrarily far into the past/future for a feature whose data
 * model (and generation flow) really only makes sense within a handful of
 * weeks of "now". `weekOffset` is the viewed week's distance from the REAL
 * current week (not from whatever week happens to be on screen), so the
 * bound holds even after several prev/next clicks. Disabled (not hidden) at
 * the edges — hiding would reflow the row's width, which FRESCO-157 already
 * tightened.
 */
export function WeekNavigation({ semanaIso, mondayIso }: { semanaIso: string, mondayIso: string }) {
  const label = formatWeekRangeLabel(mondayIso);

  const semanaAnterior = addIsoWeeks(semanaIso, -1);
  const semanaSiguiente = addIsoWeeks(semanaIso, 1);

  const currentMonday = getIsoWeekMonday();
  const weekOffset = Math.round(
    (new Date(`${mondayIso}T00:00:00.000Z`).getTime() - new Date(`${currentMonday}T00:00:00.000Z`).getTime()) / MS_PER_WEEK,
  );
  const canGoPrev = weekOffset > -MAX_WEEK_OFFSET;
  const canGoNext = weekOffset < MAX_WEEK_OFFSET;

  return (
    <div className="flex items-center gap-2" data-testid="week_navigation">
      {canGoPrev
        ? (
            <Link
              href={`/calendar?semana=${semanaAnterior}`}
              aria-label="Semana anterior"
              data-testid="week_nav_prev"
              className="grid size-9 place-items-center rounded-full bg-surface text-primary hover:bg-neutral-200"
            >
              <ChevronLeft className="size-4" />
            </Link>
          )
        : (
            <span
              aria-label="Semana anterior"
              aria-disabled="true"
              data-testid="week_nav_prev"
              className="grid size-9 place-items-center rounded-full bg-surface text-tertiary opacity-40"
            >
              <ChevronLeft className="size-4" />
            </span>
          )}
      <p className="min-w-24 text-center text-label uppercase text-text" data-testid="week_nav_label">
        {label}
      </p>
      {canGoNext
        ? (
            <Link
              href={`/calendar?semana=${semanaSiguiente}`}
              aria-label="Semana siguiente"
              data-testid="week_nav_next"
              className="grid size-9 place-items-center rounded-full bg-surface text-primary hover:bg-neutral-200"
            >
              <ChevronRight className="size-4" />
            </Link>
          )
        : (
            <span
              aria-label="Semana siguiente"
              aria-disabled="true"
              data-testid="week_nav_next"
              className="grid size-9 place-items-center rounded-full bg-surface text-tertiary opacity-40"
            >
              <ChevronRight className="size-4" />
            </span>
          )}
    </div>
  );
}
