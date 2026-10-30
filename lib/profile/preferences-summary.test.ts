import type { OnboardingProfilePayload } from '@/lib/api/user-profile';
import { describe, expect, test } from 'bun:test';
import { summarizePreferences } from './preferences-summary';

function preferences(overrides: Partial<OnboardingProfilePayload> = {}): OnboardingProfilePayload {
  return {
    num_personas: 2,
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
    ...overrides,
  };
}

describe('summarizePreferences (FRESCO-1070)', () => {
  test('says nothing is saved, never "no restrictions", when there is no diet and no allergen', () => {
    expect(summarizePreferences(preferences())).toBe('Sin dieta ni alérgenos guardados');
  });

  test('names a single diet', () => {
    expect(summarizePreferences(preferences({ dieta_vegetariano: true }))).toBe('Vegetariano');
  });

  test('counts the allergens, singular and plural', () => {
    expect(summarizePreferences(preferences({ alergenos: ['gluten'] }))).toBe('1 alérgeno');
    expect(summarizePreferences(preferences({ alergenos: ['gluten', 'huevo', 'soja'] }))).toBe('3 alérgenos');
  });

  test('joins diets and allergens', () => {
    expect(summarizePreferences(preferences({ dieta_vegano: true, alergenos: ['soja', 'sesamo'] }))).toBe('Vegano · 2 alérgenos');
  });

  test('names two diets and folds the rest into a count', () => {
    expect(summarizePreferences(preferences({ dieta_vegetariano: true, dieta_sin_gluten: true }))).toBe('Vegetariano, Sin gluten');
    expect(summarizePreferences(preferences({ dieta_vegetariano: true, dieta_sin_gluten: true, dieta_keto: true, dieta_halal: true }))).toBe('Vegetariano, Sin gluten +2');
  });
});
