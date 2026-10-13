import { describe, expect, test } from 'bun:test';
import { ALERGENO_OPTIONS, ALERGENO_VALUES, impliedAlergenos } from '@/lib/constants/dietary-options';

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
