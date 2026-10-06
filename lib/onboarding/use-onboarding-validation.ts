import { isHealthConsentSatisfied } from '@/lib/onboarding/health-data-consent';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { validateHousehold } from '@/lib/validation/onboarding';

/**
 * Cross-step validation of the onboarding draft. It feeds the footer CTA,
 * which lives outside any single step, so it is derived once here and passed
 * down instead of each step recomputing it.
 */
export function useOnboardingValidation() {
  const { adultos, ninos, presupuestoSemanaEuros, planningSelection } = useOnboardingStore();

  // FRESCO-794 (ADR-0040): allergies and diet are health data (art. 9); the
  // wizard goes on only once the user has ticked the explicit consent in step 2.
  const healthConsentOk = useOnboardingStore(isHealthConsentSatisfied);

  const household = validateHousehold({ adultos, ninos });
  // FRESCO-371: presupuesto is optional again (A4-H14). Null/unset is valid;
  // a typed-in value still has to be > 0 (matches the DB check constraint).
  const presupuestoValid = presupuestoSemanaEuros === null || presupuestoSemanaEuros > 0;
  // FRESCO-165/166 — QA sweep found "Ninguno" (days) left 0 days selected
  // with "Generar mi menú" still enabled: it generated a menu anyway. Worse,
  // deselecting all 3 meals didn't block generation either, and because
  // `upsertUserProfile()` below persists `planning_selection` BEFORE
  // `generateMealPlan()` runs, a user who reached that state and hit
  // a generation failure (e.g. 409 "plan already exists") was left with a
  // permanently-saved empty preference — `/menu` reads today's meals from
  // that (now-corrupted) preference, not from the real stored plan, so it
  // rendered with zero meal cards and no explanation. Blocking submission
  // here prevents the empty-preference profile write from ever happening.
  const hasInvalidPlanning = Object.values(planningSelection).every(meals => meals.length === 0);

  return { household, presupuestoValid, hasInvalidPlanning, healthConsentOk };
}

export type OnboardingValidation = ReturnType<typeof useOnboardingValidation>;
