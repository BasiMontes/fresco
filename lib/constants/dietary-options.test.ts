import { describe, expect, test } from 'bun:test';
import { ALERGENO_OPTIONS, ALERGENO_VALUES, DIETA_FIELDS, impliedAlergenos } from '@/lib/constants/dietary-options';

describe('lib/constants/dietary-options — ALERGENO_OPTIONS (FRESCO-912)', () => {
  test('offers the 14 allergens the EU requires to declare, mostaza and altramuces included', () => {
    expect(ALERGENO_OPTIONS).toHaveLength(14);
    expect(ALERGENO_VALUES.has('mostaza')).toBe(true);
    expect(ALERGENO_VALUES.has('altramuces')).toBe(true);
  });

  test('every value is unique and has a label', () => {
    expect(new Set(ALERGENO_OPTIONS.map(option => option.value)).size).toBe(14);
    expect(ALERGENO_OPTIONS.every(option => option.label.length > 0)).toBe(true);
  });
});

// FRESCO-1159 (owner decision, 2026-11-10): the EU allergen is "leche y productos derivados (incluida la lactosa)",
// and someone allergic to milk protein does not recognise themselves in "Lactosa". Only the label changed: the
// stored value is pinned by CHECK constraints on recipes and ingredient_substitutions, and the diet "Sin lactosa"
// is another thing. This is the one source onboarding, the profile, the Biblioteca filter and chips, the summary
// and the recipe sheet read.
describe('lib/constants/dietary-options — the milk allergen label (FRESCO-1159)', () => {
  test('the milk allergen is shown as "Leche y lácteos" and keeps its stored value "lactosa"', () => {
    expect(ALERGENO_OPTIONS.find(option => option.value === 'lactosa')).toEqual({ value: 'lactosa', label: 'Leche y lácteos' });
  });

  test('no allergen is labelled "Lactosa" any more', () => {
    expect(ALERGENO_OPTIONS.map(option => option.label)).not.toContain('Lactosa');
  });

  test('the "Sin lactosa" diet is not renamed: it is not the allergen', () => {
    expect(DIETA_FIELDS.find(field => field.key === 'dieta_sin_lactosa')?.label).toBe('Sin lactosa');
  });
});

describe('lib/constants/dietary-options — impliedAlergenos (FRESCO-275)', () => {
  test('no dieta flags implies nothing', () => {
    expect(impliedAlergenos({ vegano: false, vegetariano: false, sinGluten: false })).toEqual([]);
  });

  test('vegano implies huevo, pescado, and sulfitos', () => {
    expect(impliedAlergenos({ vegano: true, vegetariano: false, sinGluten: false }).sort()).toEqual(['huevo', 'pescado', 'sulfitos']);
  });

  test('vegetariano alone implies pescado and sulfitos, not huevo — real data confirms vegetarian recipes can contain egg', () => {
    expect(impliedAlergenos({ vegano: false, vegetariano: true, sinGluten: false }).sort()).toEqual(['pescado', 'sulfitos']);
  });

  test('sinGluten implies gluten', () => {
    expect(impliedAlergenos({ vegano: false, vegetariano: false, sinGluten: true })).toEqual(['gluten']);
  });

  test('combining flags unions without duplicates', () => {
    expect(impliedAlergenos({ vegano: true, vegetariano: true, sinGluten: true }).sort()).toEqual(['gluten', 'huevo', 'pescado', 'sulfitos']);
  });
});
