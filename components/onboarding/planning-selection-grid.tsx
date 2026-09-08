'use client';

import type { DiaSemana, TipoPlatoSlot } from '@schemas';
import type { PlanningSelection } from '@/lib/planning-selection';
import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export interface PlanningSelectionGridProps {
  'value': PlanningSelection
  'onChange': (next: PlanningSelection) => void
  'data-testid'?: string
}

const DAY_OPTIONS: { value: DiaSemana, label: string, name: string }[] = [
  { value: 'lunes', label: 'Lun', name: 'lunes' },
  { value: 'martes', label: 'Mar', name: 'martes' },
  { value: 'miercoles', label: 'Mié', name: 'miércoles' },
  { value: 'jueves', label: 'Jue', name: 'jueves' },
  { value: 'viernes', label: 'Vie', name: 'viernes' },
  { value: 'sabado', label: 'Sáb', name: 'sábado' },
  { value: 'domingo', label: 'Dom', name: 'domingo' },
];

const MEAL_OPTIONS: { value: TipoPlatoSlot, label: string }[] = [
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'comida', label: 'Almuerzo' },
  { value: 'cena', label: 'Cena' },
];

/**
 * FRESCO-259 — edits `planning_selection` (the DB's native day->meals matrix,
 * see `lib/planning-selection.ts`) directly, one checkbox per day x meal
 * cell. Replaces the two flat "which days" / "which meals" toggle lists,
 * which could only express their cartesian product — every included day got
 * every included meal, so excluding a single meal on a single day (e.g. no
 * desayuno on martes/jueves/sábado) was structurally impossible.
 *
 * FRESCO-426 — axis flipped: days are the columns (7), meal types the rows
 * (3). A weekly planner reads left-to-right like a calendar, and 7 columns
 * use the horizontal space that 3 columns wasted.
 *
 * FRESCO-427-ish (post axis flip) — bulk "Todos/Ninguno" moved from a
 * second header row repeated once per day column (7x, visually noisy) to
 * once per meal row, next to Desayuno/Almuerzo/Cena — it now bulk-toggles
 * that meal across all 7 days instead of all 3 meals on one day.
 */
export function PlanningSelectionGrid({ value, onChange, 'data-testid': dataTestId }: PlanningSelectionGridProps) {
  // FRESCO-451: found in review — a plain CSS `mask-image` fade is painted
  // relative to the container's own box, not scroll offset, so it stayed
  // visible over Domingo's column even once fully scrolled right (the exact
  // "fades content that isn't actually cut off" problem the sm:-breakpoint
  // reset was meant to avoid, just recurring mid-scroll instead). Track
  // scroll position the same way `HorizontalScrollRow` tracks its arrows and
  // only render the fade while there's actually more to scroll to.
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const updateFade = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) { return; }
    // 1px tolerance — sub-pixel layout can leave scrollLeft a fraction short
    // of the true max, which would otherwise strand the fade visible forever.
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  React.useEffect(() => {
    updateFade();
    const el = scrollerRef.current;
    if (!el) { return; }
    const resizeObserver = new ResizeObserver(updateFade);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [updateFade]);

  function toggleCell(day: DiaSemana, meal: TipoPlatoSlot) {
    const dayMeals = value[day] ?? [];
    const nextDayMeals = dayMeals.includes(meal)
      ? dayMeals.filter(item => item !== meal)
      : [...dayMeals, meal];
    onChange({ ...value, [day]: nextDayMeals });
  }

  // Bulk select/clear a whole meal row — sets that one meal type across all
  // seven days, leaving every other meal type's selection untouched.
  function setMeal(meal: TipoPlatoSlot, included: boolean) {
    const next = { ...value };
    for (const day of DAY_OPTIONS) {
      const dayMeals = next[day.value] ?? [];
      next[day.value] = included
        ? (dayMeals.includes(meal) ? dayMeals : [...dayMeals, meal])
        : dayMeals.filter(item => item !== meal);
    }
    onChange(next);
  }

  return (
    <div
      ref={scrollerRef}
      onScroll={updateFade}
      data-testid={dataTestId}
      // FRESCO-451: below `sm` the 7-day table needs a horizontal scroll to
      // reach Sáb/Dom, with nothing signaling that — a right-edge fade tells
      // the eye there's more without interactive scroll arrows (this is a
      // table, not `HorizontalScrollRow`'s card-carousel shape). Only
      // rendered while `canScrollRight` — a static fade stays painted over
      // the last column even once fully scrolled, which is exactly the
      // "fades content that isn't cut off" problem this is meant to avoid.
      className={cn(
        'overflow-x-auto',
        canScrollRight && '[mask-image:linear-gradient(to_right,black_92%,transparent)] [-webkit-mask-image:linear-gradient(to_right,black_92%,transparent)]',
      )}
    >
      <table className="w-full min-w-[19rem] border-collapse">
        <thead>
          <tr>
            <th scope="col" className="w-20" />
            {DAY_OPTIONS.map(day => (
              <th key={day.value} scope="col" className="pb-1 text-center text-caption font-sans uppercase text-tertiary">
                {day.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MEAL_OPTIONS.map(meal => (
            <tr key={meal.value}>
              <th scope="row" aria-label={meal.label} className="py-1.5 pr-2 text-left align-middle">
                <span className="flex flex-col gap-0.5">
                  <span className="text-body-sm font-sans font-normal text-text">{meal.label}</span>
                  <span className="flex gap-1.5 text-caption font-sans text-tertiary">
                    <button
                      type="button"
                      data-testid="planning_meal_select_all"
                      aria-label={`Marcar ${meal.label.toLowerCase()} todos los días`}
                      className="underline-offset-2 hover:text-primary hover:underline"
                      onClick={() => setMeal(meal.value, true)}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      data-testid="planning_meal_select_none"
                      aria-label={`Desmarcar ${meal.label.toLowerCase()} todos los días`}
                      className="underline-offset-2 hover:text-primary hover:underline"
                      onClick={() => setMeal(meal.value, false)}
                    >
                      Ninguno
                    </button>
                  </span>
                </span>
              </th>
              {DAY_OPTIONS.map((day) => {
                const checked = (value[day.value] ?? []).includes(meal.value);
                return (
                  <td key={day.value} className="px-0.5 py-1.5 text-center">
                    <Checkbox
                      data-testid="planning_selection_cell"
                      checked={checked}
                      onChange={() => toggleCell(day.value, meal.value)}
                      aria-label={`${meal.label} ${day.name}`}
                      className="rounded"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
