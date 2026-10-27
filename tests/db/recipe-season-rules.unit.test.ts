/**
 * FRESCO-1058 — the TypeScript twin of the season rule (`recipe-season-rules.ts`), no database.
 * `recipe-season-parity.test.ts` proves it equals the SQL on the real catalogue.
 */

import { describe, expect, test } from 'bun:test';
import { computeRecipeTemporada, recipeTemporadaProblem } from './recipe-season-rules';

const TABLE = new Map<string, readonly string[]>([
  ['espárragos', ['primavera']],
  ['coles de bruselas', ['otono', 'invierno']],
  ['guisantes', ['primavera']],
  ['apio', ['otono', 'invierno']],
  ['pimiento', ['verano', 'otono']],
  ['calabacín', ['primavera', 'verano']],
  ['alcachofas', ['invierno', 'primavera']],
]);

describe('computeRecipeTemporada', () => {
  test('matches names case-insensitively, accents included', () => {
    expect(computeRecipeTemporada(['Espárragos'], TABLE)).toEqual(['primavera']);
    expect(computeRecipeTemporada(['COLES DE BRUSELAS'], TABLE)).toEqual(['otono', 'invierno']);
  });

  test('a name must match exactly, not as a substring', () => {
    expect(computeRecipeTemporada(['espárragos trigueros', 'sal'], TABLE)).toEqual(['todo_el_ano']);
  });

  test('tomate (not in the table) is not seasonal', () => {
    expect(computeRecipeTemporada(['tomate', 'aceite'], TABLE)).toEqual(['todo_el_ano']);
  });

  test('an empty list is all year', () => {
    expect(computeRecipeTemporada([], TABLE)).toEqual(['todo_el_ano']);
  });

  test('input that is not an array is all year', () => {
    expect(computeRecipeTemporada(null, TABLE)).toEqual(['todo_el_ano']);
    expect(computeRecipeTemporada('espárragos', TABLE)).toEqual(['todo_el_ano']);
    expect(computeRecipeTemporada({ 0: 'espárragos' }, TABLE)).toEqual(['todo_el_ano']);
  });

  test('non-text elements are ignored', () => {
    expect(computeRecipeTemporada([null, 5, 'guisantes'], TABLE)).toEqual(['primavera']);
  });

  test('intersects the seasons of every seasonal ingredient', () => {
    expect(computeRecipeTemporada(['pimiento', 'calabacín'], TABLE)).toEqual(['verano']);
    expect(computeRecipeTemporada(['apio', 'coles de bruselas', 'tomate'], TABLE)).toEqual(['otono', 'invierno']);
  });

  test('returns calendar order whatever the order in the table', () => {
    expect(computeRecipeTemporada(['alcachofas'], TABLE)).toEqual(['primavera', 'invierno']);
  });

  test('a conflict gives null', () => {
    expect(computeRecipeTemporada(['guisantes', 'apio'], TABLE)).toBeNull();
  });
});

describe('recipeTemporadaProblem', () => {
  test('a season that fits is fine', () => {
    expect(recipeTemporadaProblem(['primavera'], ['espárragos'], TABLE)).toBeNull();
    expect(recipeTemporadaProblem(['todo_el_ano'], ['tomate'], TABLE)).toBeNull();
  });

  test.each([[null], [undefined], ['primavera'], [{}], [[]]])('rejects an empty or non-array season (%p)', (value) => {
    expect(recipeTemporadaProblem(value, ['tomate'], TABLE)).not.toBeNull();
  });

  test('rejects values that are not text', () => {
    expect(recipeTemporadaProblem(['primavera', 2], ['espárragos'], TABLE)).not.toBeNull();
  });

  test('rejects a value outside the vocabulary, ñ included', () => {
    expect(recipeTemporadaProblem(['otoño'], ['tomate'], TABLE)).not.toBeNull();
    expect(recipeTemporadaProblem(['Primavera'], ['espárragos'], TABLE)).not.toBeNull();
  });

  test('todo_el_ano must go alone', () => {
    expect(recipeTemporadaProblem(['todo_el_ano', 'verano'], ['tomate'], TABLE)).not.toBeNull();
    expect(recipeTemporadaProblem(['todo_el_ano', 'todo_el_ano'], ['tomate'], TABLE)).not.toBeNull();
  });

  test('rejects repeats', () => {
    expect(recipeTemporadaProblem(['verano', 'verano'], ['pimiento', 'calabacín'], TABLE)).not.toBeNull();
  });

  test('rejects the wrong order', () => {
    expect(recipeTemporadaProblem(['invierno', 'otono'], ['apio'], TABLE)).not.toBeNull();
    expect(recipeTemporadaProblem(['otono', 'invierno'], ['apio'], TABLE)).toBeNull();
  });

  test('rejects a season that differs from the computed one, saying expected and stored', () => {
    const problem = recipeTemporadaProblem(['verano'], ['espárragos'], TABLE);
    expect(problem).toContain('expected');
    expect(problem).toContain('stored');
    expect(recipeTemporadaProblem(['todo_el_ano'], ['espárragos'], TABLE)).not.toBeNull();
    expect(recipeTemporadaProblem(['primavera'], ['tomate'], TABLE)).not.toBeNull();
  });

  test('a conflict accepts any valid value, and still rejects an invalid one', () => {
    expect(recipeTemporadaProblem(['primavera'], ['guisantes', 'apio'], TABLE)).toBeNull();
    expect(recipeTemporadaProblem(['todo_el_ano'], ['guisantes', 'apio'], TABLE)).toBeNull();
    expect(recipeTemporadaProblem(['invierno', 'otono'], ['guisantes', 'apio'], TABLE)).not.toBeNull();
  });

  test('ingredients that are not an array behave as all year', () => {
    expect(recipeTemporadaProblem(['todo_el_ano'], null, TABLE)).toBeNull();
    expect(recipeTemporadaProblem(['verano'], null, TABLE)).not.toBeNull();
  });
});
