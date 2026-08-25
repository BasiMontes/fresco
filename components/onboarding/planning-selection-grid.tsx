import type { DiaSemana, TipoPlatoSlot } from '@schemas';
import type { PlanningSelection } from '@/lib/planning-selection';
import { Checkbox } from '@/components/ui/checkbox';

export interface PlanningSelectionGridProps {
  'value': PlanningSelection
  'onChange': (next: PlanningSelection) => void
  'data-testid'?: string
}

const DAY_OPTIONS: { value: DiaSemana, label: string }[] = [
  { value: 'lunes', label: 'Lun' },
  { value: 'martes', label: 'Mar' },
  { value: 'miercoles', label: 'Mié' },
  { value: 'jueves', label: 'Jue' },
  { value: 'viernes', label: 'Vie' },
  { value: 'sabado', label: 'Sáb' },
  { value: 'domingo', label: 'Dom' },
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
 */
export function PlanningSelectionGrid({ value, onChange, 'data-testid': dataTestId }: PlanningSelectionGridProps) {
  function toggleCell(day: DiaSemana, meal: TipoPlatoSlot) {
    const dayMeals = value[day] ?? [];
    const nextDayMeals = dayMeals.includes(meal)
      ? dayMeals.filter(item => item !== meal)
      : [...dayMeals, meal];
    onChange({ ...value, [day]: nextDayMeals });
  }

  return (
    <div data-testid={dataTestId} className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th scope="col" className="w-12" />
            {MEAL_OPTIONS.map(meal => (
              <th key={meal.value} scope="col" className="pb-2 text-center text-caption font-sans uppercase text-tertiary">
                {meal.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAY_OPTIONS.map(day => (
            <tr key={day.value}>
              <th scope="row" className="py-1.5 pr-2 text-left text-body-sm font-sans font-normal text-text">
                {day.label}
              </th>
              {MEAL_OPTIONS.map((meal) => {
                const checked = (value[day.value] ?? []).includes(meal.value);
                return (
                  <td key={meal.value} className="py-1.5 text-center">
                    <Checkbox
                      data-testid="planning_selection_cell"
                      checked={checked}
                      onChange={() => toggleCell(day.value, meal.value)}
                      aria-label={`${meal.label} el ${day.label}`}
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
