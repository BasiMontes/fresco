import type { RecipeForQuantities } from './backfill-recipe-quantities.ts';
import { describe, expect, test } from 'bun:test';
import { checkQuantities } from './backfill-recipe-quantities.ts';

// Shape of a real catalog row (Gambas al ajillo, ingredientes_principales read
// live 2026-10-08 for FRESCO-863).
const GAMBAS: RecipeForQuantities = {
  id: 'r1',
  nombre: 'Gambas al ajillo',
  raciones: 2,
  ingredientes: ['gambas', 'ajo', 'aceite de oliva'],
};

const GOOD = [
  { nombre: 'gambas', cantidad: 400, unidad: 'g' },
  { nombre: 'ajo', cantidad: 4, unidad: 'dientes' },
  { nombre: 'aceite de oliva', cantidad: 60, unidad: 'ml' },
];

describe('checkQuantities', () => {
  test('accepts a complete, plausible list', () => {
    expect(checkQuantities(GAMBAS, GOOD)).toEqual({ problems: [], warnings: [] });
  });

  test('rejects an ingredient that ingredientes_principales does not carry', () => {
    const result = checkQuantities(GAMBAS, [...GOOD, { nombre: 'perejil', cantidad: 5, unidad: 'g' }]);

    expect(result.problems).toContain('perejil: not in ingredientes_principales');
  });

  test('rejects a recipe with a missing ingredient', () => {
    const result = checkQuantities(GAMBAS, GOOD.slice(0, 2));

    expect(result.problems).toContain('aceite de oliva: missing');
  });

  test('rejects a duplicated ingredient', () => {
    const result = checkQuantities(GAMBAS, [...GOOD, GOOD[0]]);

    expect(result.problems).toContain('gambas: listed more than once');
  });

  test('rejects a unit outside the closed list', () => {
    const result = checkQuantities(GAMBAS, [{ nombre: 'gambas', cantidad: 3, unidad: 'tazas' }, GOOD[1], GOOD[2]]);

    expect(result.problems[0]).toContain('"tazas" is not in the closed list');
  });

  test('rejects a unit slip: 40 garlic cloves for 2 servings', () => {
    const result = checkQuantities(GAMBAS, [GOOD[0], { nombre: 'ajo', cantidad: 40, unidad: 'dientes' }, GOOD[2]]);

    expect(result.problems.join(' ')).toContain('ajo: 40 dientes for 2 servings');
  });

  test('allows "al gusto" with zero quantity and does not count it as missing', () => {
    const sal: RecipeForQuantities = { ...GAMBAS, ingredientes: [...GAMBAS.ingredientes, 'sal'] };
    const result = checkQuantities(sal, [...GOOD, { nombre: 'sal', cantidad: 0, unidad: 'al gusto' }]);

    expect(result.problems).toEqual([]);
  });

  test('rejects a zero quantity on a measured unit', () => {
    const result = checkQuantities(GAMBAS, [{ nombre: 'gambas', cantidad: 0, unidad: 'g' }, GOOD[1], GOOD[2]]);

    expect(result.problems.join(' ')).toContain('gambas: 0 g is below');
  });

  test('treats pizca as a total, not per serving', () => {
    const sal: RecipeForQuantities = { ...GAMBAS, ingredientes: [...GAMBAS.ingredientes, 'sal'] };

    expect(checkQuantities(sal, [...GOOD, { nombre: 'sal', cantidad: 2, unidad: 'pizca' }]).problems).toEqual([]);
    expect(checkQuantities(sal, [...GOOD, { nombre: 'sal', cantidad: 9, unidad: 'pizca' }]).problems.join(' ')).toContain('pizcas');
  });

  test('falls back to 4 servings when the recipe declares none', () => {
    const noRaciones: RecipeForQuantities = { ...GAMBAS, raciones: 0 };
    // 1800 g / 4 = 450 per serving (ok); the same list at 2 servings would be 900 (rejected).
    const heavy = [{ nombre: 'gambas', cantidad: 1800, unidad: 'g' }, GOOD[1], GOOD[2]];

    expect(checkQuantities(noRaciones, heavy).problems).toEqual([]);
    expect(checkQuantities(GAMBAS, heavy).problems.join(' ')).toContain('gambas: 1800 g for 2 servings');
  });

  test('warns, without rejecting, when g+ml per serving is outside the usual range', () => {
    const light = [{ nombre: 'gambas', cantidad: 60, unidad: 'g' }, GOOD[1], { nombre: 'aceite de oliva', cantidad: 10, unidad: 'ml' }];
    const result = checkQuantities(GAMBAS, light);

    expect(result.problems).toEqual([]);
    expect(result.warnings[0]).toContain('per serving is outside');
  });

  test('rejects anything that is not a non-empty array', () => {
    expect(checkQuantities(GAMBAS, null).problems).toEqual(['quantities is not a non-empty array']);
    expect(checkQuantities(GAMBAS, []).problems).toEqual(['quantities is not a non-empty array']);
    expect(checkQuantities(GAMBAS, { gambas: 400 }).problems).toEqual(['quantities is not a non-empty array']);
  });
});
