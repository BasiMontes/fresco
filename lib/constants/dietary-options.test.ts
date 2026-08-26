import { describe, expect, test } from 'bun:test';
import { impliedAlergenos } from '@/lib/constants/dietary-options';

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
