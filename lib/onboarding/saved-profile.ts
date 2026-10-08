import type { OnboardingProfilePayload, SavedOnboardingProfile } from '@/lib/api/user-profile';
import type { OnboardingState } from '@/lib/store/onboarding-store';
import { ALL_DIAS_SEMANA } from '@/lib/store/onboarding-store';

/**
 * FRESCO-806 (audit-6 A6-L5) — a user who already has a profile must find it in
 * the wizard. These are the pure halves of that: the mapping from the saved
 * row to the wizard's state, and the test for "the wizard has not been touched".
 */

/** The wizard's data fields: everything except the step bookkeeping and the actions. */
export type OnboardingData = Omit<
  OnboardingState,
  | 'step'
  | 'returnToSummary'
  | 'healthDataConsent'
  | 'healthConsentPriorAt'
  | `set${string}`
  | `toggle${string}`
  | 'editFromSummary'
  | 'goToSummary'
  | 'reset'
>;

/**
 * A column the database leaves null (or empty) keeps the wizard's own default,
 * so a profile row created by the app with only its defaults looks exactly like
 * a fresh wizard.
 */
export function profileToWizardData(
  saved: SavedOnboardingProfile,
  defaults: OnboardingData,
): OnboardingData {
  const hasPlanning = Object.values(saved.planning_selection ?? {}).some(meals => (meals ?? []).length > 0);
  return {
    nombre: saved.nombre ?? defaults.nombre,
    sexo: saved.sexo ?? defaults.sexo,
    objetivo: saved.objetivo ?? defaults.objetivo,
    dietaVegetariano: saved.dieta_vegetariano,
    dietaVegano: saved.dieta_vegano,
    dietaSinGluten: saved.dieta_sin_gluten,
    dietaSinLactosa: saved.dieta_sin_lactosa,
    dietaSinHuevo: saved.dieta_sin_huevo,
    dietaKeto: saved.dieta_keto,
    dietaHalal: saved.dieta_halal,
    alergenos: saved.alergenos ?? [],
    ingredientesOdiados: saved.ingredientes_odiados ?? [],
    cocinasFavoritas: saved.cocinas_favoritas ?? [],
    adultos: saved.adultos,
    ninos: saved.ninos,
    dietaTextoLibre: saved.dieta_texto_libre ?? '',
    ingredientesOdiadosTextoLibre: saved.ingredientes_odiados_texto_libre ?? '',
    cocinasTextoLibre: saved.cocinas_texto_libre ?? '',
    presupuestoSemanaEuros: saved.presupuesto_semana_euros ?? null,
    planningSelection: hasPlanning
      ? Object.fromEntries(ALL_DIAS_SEMANA.map(dia => [dia, saved.planning_selection[dia] ?? []])) as OnboardingData['planningSelection']
      : defaults.planningSelection,
    nivelExperiencia: saved.nivel_experiencia ?? null,
  };
}

/** The store's values without its actions: what is compared against the defaults. */
export type WizardSnapshot = Omit<OnboardingState, keyof OnboardingActions>;

type OnboardingActions = Pick<OnboardingState, Extract<keyof OnboardingState, `set${string}` | `toggle${string}` | 'editFromSummary' | 'goToSummary' | 'reset'>>;

/** True when every field (step and consent included) still equals the wizard's default: nothing was typed, nothing to lose by pre-filling. */
export function isWizardUntouched(current: WizardSnapshot, defaults: WizardSnapshot): boolean {
  return (Object.keys(defaults) as (keyof WizardSnapshot)[])
    .every(key => JSON.stringify(current[key]) === JSON.stringify(defaults[key]));
}

/**
 * What "Empezar" saves: the wizard's values, in the columns' names. Extracted
 * from the generate hook so a test can prove the round trip: a saved profile
 * loaded into the wizard and saved back is the same profile (FRESCO-806).
 */
export function wizardToProfilePayload(state: OnboardingData): OnboardingProfilePayload {
  return {
    nombre: state.nombre,
    sexo: state.sexo,
    objetivo: state.objetivo,
    num_personas: state.adultos + state.ninos,
    adultos: state.adultos,
    ninos: state.ninos,
    dieta_vegetariano: state.dietaVegetariano,
    dieta_vegano: state.dietaVegano,
    dieta_sin_gluten: state.dietaSinGluten,
    dieta_sin_lactosa: state.dietaSinLactosa,
    dieta_sin_huevo: state.dietaSinHuevo,
    dieta_keto: state.dietaKeto,
    dieta_halal: state.dietaHalal,
    alergenos: state.alergenos,
    ingredientes_odiados: state.ingredientesOdiados,
    cocinas_favoritas: state.cocinasFavoritas,
    dieta_texto_libre: state.dietaTextoLibre,
    ingredientes_odiados_texto_libre: state.ingredientesOdiadosTextoLibre,
    cocinas_texto_libre: state.cocinasTextoLibre,
    // DB check constraint: presupuesto_semana_euros > 0 — 0/negative rejected,
    // only a genuine positive value or null is valid.
    presupuesto_semana_euros: state.presupuestoSemanaEuros,
    planning_selection: state.planningSelection,
    nivel_experiencia: state.nivelExperiencia,
  };
}
