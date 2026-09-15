import type { DiaSemana, TipoPlatoSlot } from '@schemas';

const ALL_DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const ALL_MEALS: TipoPlatoSlot[] = ['desayuno', 'comida', 'cena'];

export type PlanningSelection = Record<DiaSemana, TipoPlatoSlot[]>;

/**
 * FRESCO-199 — the DB stores a day->meals matrix (`planning_selection`), but
 * the onboarding UI and `/profile`'s preferences editor still edit it as two
 * flat lists (which days, which meals) until a granular per-day picker
 * ships. This is the boundary conversion for both: every included day gets
 * every included meal, an excluded day gets none — the same "whole week,
 * same meals" semantics the old `planning_meals`/`planning_days` pair had.
 */
export function toPlanningSelection(days: DiaSemana[], meals: TipoPlatoSlot[]): PlanningSelection {
  const daySet = new Set(days);
  return Object.fromEntries(
    ALL_DIAS.map(dia => [dia, daySet.has(dia) ? meals : []]),
  ) as PlanningSelection;
}

/**
 * Inverse of `toPlanningSelection` — reconstructs the two flat lists for the
 * current (non-granular) UI. `days` is every day with at least one meal
 * selected; `meals` is the union of meals selected across those days.
 */
export function fromPlanningSelection(selection: PlanningSelection): { days: DiaSemana[], meals: TipoPlatoSlot[] } {
  const days = ALL_DIAS.filter(dia => (selection[dia]?.length ?? 0) > 0);
  const mealSet = new Set(days.flatMap(dia => selection[dia] ?? []));
  // FRESCO-516: `mealSet`'s iteration order follows insertion order (whatever
  // order each day's meals happen to be stored in), not the canonical
  // desayuno->comida->cena order the calendar always renders in — sort
  // against ALL_MEALS instead of trusting the Set.
  const meals = ALL_MEALS.filter(meal => mealSet.has(meal));
  return { days, meals };
}
