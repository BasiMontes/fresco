import type { SavedOnboardingProfile } from '@/lib/api/user-profile';
import { describe, expect, test } from 'bun:test';
import { isWizardUntouched, profileToWizardData, wizardToProfilePayload } from '@/lib/onboarding/saved-profile';
import { ONBOARDING_INITIAL_STATE } from '@/lib/store/onboarding-store';

// The account the audit found: Halal, egg allergy, breakfasts only on 6 days.
const SAVED: SavedOnboardingProfile = {
  nombre: 'Marta',
  sexo: 'mujer',
  objetivo: 'comer_sano',
  adultos: 3,
  ninos: 1,
  dieta_vegetariano: false,
  dieta_vegano: false,
  dieta_sin_gluten: false,
  dieta_sin_lactosa: false,
  dieta_sin_huevo: true,
  dieta_keto: false,
  dieta_halal: true,
  alergenos: ['huevo'],
  ingredientes_odiados: ['coliflor'],
  cocinas_favoritas: ['italiana'],
  dieta_texto_libre: 'sin cerdo',
  ingredientes_odiados_texto_libre: 'apio',
  cocinas_texto_libre: '',
  presupuesto_semana_euros: 90,
  planning_selection: {
    lunes: ['desayuno'],
    martes: ['desayuno'],
    miercoles: ['desayuno'],
    jueves: ['desayuno'],
    viernes: ['desayuno'],
    sabado: ['desayuno'],
    domingo: [],
  },
  nivel_experiencia: 'intermedio',
};

describe('profileToWizardData (FRESCO-806)', () => {
  test('puts every saved value in the wizard, so the summary shows them', () => {
    const wizard = profileToWizardData(SAVED, ONBOARDING_INITIAL_STATE);
    expect(wizard.nombre).toBe('Marta');
    expect(wizard.dietaHalal).toBe(true);
    expect(wizard.dietaSinHuevo).toBe(true);
    expect(wizard.alergenos).toEqual(['huevo']);
    expect(wizard.ingredientesOdiados).toEqual(['coliflor']);
    expect(wizard.adultos).toBe(3);
    expect(wizard.presupuestoSemanaEuros).toBe(90);
    expect(wizard.planningSelection.lunes).toEqual(['desayuno']);
    expect(wizard.planningSelection.domingo).toEqual([]);
  });

  test('a profile row holding only database defaults looks like a fresh wizard', () => {
    const defaultsRow = {
      nombre: null,
      sexo: null,
      objetivo: null,
      adultos: 2,
      ninos: 0,
      dieta_vegetariano: false,
      dieta_vegano: false,
      dieta_sin_gluten: false,
      dieta_sin_lactosa: false,
      dieta_sin_huevo: false,
      dieta_keto: false,
      dieta_halal: false,
      alergenos: [],
      ingredientes_odiados: [],
      cocinas_favoritas: [],
      dieta_texto_libre: null,
      ingredientes_odiados_texto_libre: null,
      cocinas_texto_libre: null,
      presupuesto_semana_euros: null,
      planning_selection: {},
      nivel_experiencia: null,
    } as unknown as SavedOnboardingProfile;
    const wizard = profileToWizardData(defaultsRow, ONBOARDING_INITIAL_STATE);
    expect(isWizardUntouched({ ...ONBOARDING_INITIAL_STATE, ...wizard }, ONBOARDING_INITIAL_STATE)).toBe(true);
    // An empty planning matrix must not leave the wizard unable to generate.
    expect(wizard.planningSelection).toEqual(ONBOARDING_INITIAL_STATE.planningSelection);
  });
});

describe('Empezar does not overwrite what was saved (FRESCO-806)', () => {
  test('loading a saved profile into the wizard and saving it back changes nothing', () => {
    const payload = wizardToProfilePayload(profileToWizardData(SAVED, ONBOARDING_INITIAL_STATE));
    expect(payload).toEqual({ ...SAVED, num_personas: 4 });
  });

  test('an untouched wizard would save defaults over it: this is the bug the pre-fill prevents', () => {
    const payload = wizardToProfilePayload(ONBOARDING_INITIAL_STATE);
    expect(payload.alergenos).toEqual([]);
    expect(payload.dieta_halal).toBe(false);
    expect(payload.alergenos).not.toEqual(SAVED.alergenos);
  });
});

describe('isWizardUntouched (FRESCO-806)', () => {
  test('is true for the initial state and false after any edit', () => {
    expect(isWizardUntouched(ONBOARDING_INITIAL_STATE, ONBOARDING_INITIAL_STATE)).toBe(true);
    expect(isWizardUntouched({ ...ONBOARDING_INITIAL_STATE, nombre: 'Ana' }, ONBOARDING_INITIAL_STATE)).toBe(false);
    expect(isWizardUntouched({ ...ONBOARDING_INITIAL_STATE, alergenos: ['huevo'] }, ONBOARDING_INITIAL_STATE)).toBe(false);
    expect(isWizardUntouched({ ...ONBOARDING_INITIAL_STATE, step: 3 }, ONBOARDING_INITIAL_STATE)).toBe(false);
  });
});
