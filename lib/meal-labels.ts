/**
 * FRESCO-1014 (A7-UI-09) — the one place that names the three meals of the day. The midday meal is "Comida":
 * in much of Spain "almuerzo" is the mid-morning snack, and the profile, the onboarding, the history and the
 * recipe filter used to disagree about it. Every screen that labels a meal imports this map.
 */

export type MealSlot = 'desayuno' | 'comida' | 'cena';

export const MEAL_LABELS: Record<MealSlot, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  cena: 'Cena',
};

export const MEAL_SLOTS = Object.keys(MEAL_LABELS) as MealSlot[];
