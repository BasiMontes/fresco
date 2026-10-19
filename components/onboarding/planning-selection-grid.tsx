'use client';

import type { DiaSemana, TipoPlatoSlot } from '@schemas';
import type { PlanningSelection } from '@/lib/planning-selection';
import { Checkbox } from '@/components/ui/checkbox';
import { MEAL_LABELS, MEAL_SLOTS } from '@/lib/meal-labels';

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

const MEAL_OPTIONS: { value: TipoPlatoSlot, label: string }[] = MEAL_SLOTS.map(value => ({ value, label: MEAL_LABELS[value] }));

/**
 * FRESCO-259 — edits `planning_selection` (the DB's native day->meals matrix,
 * see `lib/planning-selection.ts`) directly, one checkbox per day x meal
 * cell, so a single meal on a single day can be excluded (e.g. no desayuno on
 * martes/jueves/sábado).
 *
 * FRESCO-864 — one card per meal, its 7 days as 44 px tap targets in two rows
 * (4 + 3) below `sm`, one row from `sm` up. Replaces the 7-column table whose
 * cells were ~38 px wide at 360 px, too narrow for a 44 px target (FRESCO-819).
 * Each day is a `<label>` wrapping its checkbox, so the whole label is the
 * target. The bulk "Todos/Ninguno" sets one meal across all 7 days.
 */
export function PlanningSelectionGrid({ value, onChange, 'data-testid': dataTestId }: PlanningSelectionGridProps) {
  function toggleCell(day: DiaSemana, meal: TipoPlatoSlot) {
    const dayMeals = value[day] ?? [];
    const nextDayMeals = dayMeals.includes(meal)
      ? dayMeals.filter(item => item !== meal)
      : [...dayMeals, meal];
    onChange({ ...value, [day]: nextDayMeals });
  }

  // Bulk select/clear a whole meal — sets that one meal type across all
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
    <div data-testid={dataTestId} className="flex flex-col gap-3">
      {MEAL_OPTIONS.map((meal) => {
        const headingId = `planning-meal-${meal.value}`;
        return (
          <div
            key={meal.value}
            role="group"
            aria-labelledby={headingId}
            className="rounded-md border border-border p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3">
              <span id={headingId} className="text-body-sm font-sans text-text">{meal.label}</span>
              <span className="flex items-center gap-1 text-body-sm font-sans text-tertiary">
                <button
                  type="button"
                  data-testid="planning_meal_select_all"
                  aria-label={`Todos: marcar ${meal.label.toLowerCase()} todos los días`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center underline-offset-2 hover:text-primary hover:underline"
                  onClick={() => setMeal(meal.value, true)}
                >
                  Todos
                </button>
                <button
                  type="button"
                  data-testid="planning_meal_select_none"
                  aria-label={`Ninguno: desmarcar ${meal.label.toLowerCase()} todos los días`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center underline-offset-2 hover:text-primary hover:underline"
                  onClick={() => setMeal(meal.value, false)}
                >
                  Ninguno
                </button>
              </span>
            </div>
            {/* FRESCO-985: the seven columns depend on the width of the card, not of the
                window. Seven 44px targets and six 4px gaps need 332px; at 768px /profile is
                two columns wide and the card is ~248px, so a viewport breakpoint made the
                neighbouring targets overlap. */}
            <div className="@container mt-1">
              <div className="grid grid-cols-4 gap-1 @min-[336px]:grid-cols-7">
                {DAY_OPTIONS.map(day => (
                  <label
                    key={day.value}
                    className="flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-center gap-0.5"
                  >
                    <span className="text-body-sm font-sans uppercase text-tertiary">{day.label}</span>
                    <Checkbox
                      data-testid="planning_selection_cell"
                      checked={(value[day.value] ?? []).includes(meal.value)}
                      onChange={() => toggleCell(day.value, meal.value)}
                      aria-label={`${meal.label} ${day.name}`}
                      className="rounded"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
