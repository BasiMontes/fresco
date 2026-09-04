import type { DiaSemana, TipoPlatoSlot } from '@schemas';
import type { PlanningSelection } from '@/lib/planning-selection';
import { Checkbox } from '@/components/ui/checkbox';

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
    <div data-testid={dataTestId} className="overflow-x-auto">
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
