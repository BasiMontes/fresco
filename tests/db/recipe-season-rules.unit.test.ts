/**
 * FRESCO-1058 — the TypeScript twin of the season rule (`recipe-season-rules.ts`), no database.
 * `recipe-season-parity.test.ts` proves it equals the SQL on the real catalogue.
 */

import { describe, expect, test } from 'bun:test';
import { computeRecipeSeason, computeRecipeTemporada, recipeTemporadaProblem } from './recipe-season-rules';

const EXCEPTIONS = new Map<string, readonly string[]>([
  ['salmorejo', ['verano']],
  ['hamburguesa-de-lentejas', ['todo_el_ano']],
]);

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

describe('computeRecipeSeason (FRESCO-1059)', () => {
  const season = (ingredientes: unknown, slug: unknown, clasificacion: unknown) =>
    computeRecipeSeason(ingredientes, slug, clasificacion, TABLE, EXCEPTIONS);

  test.each(['guiso', 'sopa'])('a %s with no seasonal ingredient is wanted in autumn and winter', (categoria) => {
    expect(season(['ternera', 'vino tinto'], 'cocido', { categoria })).toEqual(['otono', 'invierno']);
  });

  test('legumbres follow the cold months unless they are light', () => {
    expect(season(['lentejas'], 'lentejas', { categoria: 'legumbres', es_ligero: false })).toEqual(['otono', 'invierno']);
    expect(season(['lentejas'], 'lentejas', { categoria: 'legumbres' })).toEqual(['otono', 'invierno']);
    expect(season(['tempeh'], 'tempeh', { categoria: 'legumbres', es_ligero: true })).toEqual(['todo_el_ano']);
  });

  test.each(['arroz', 'pasta', 'carne', 'pescado', 'reposteria', 'tostadas', 'huevos'])('%s is not decided by the dish', (categoria) => {
    expect(season(['tomate'], 'plato', { categoria, es_comfort_food: true, es_contundente: true })).toEqual(['todo_el_ano']);
  });

  test('the flags do not move a recipe, only the category does', () => {
    expect(season([], 'bizcocho', { categoria: 'reposteria', es_comfort_food: true, es_contundente: true, es_ligero: false })).toEqual(['todo_el_ano']);
  });

  test('a season from the ingredients is never overridden by the dish', () => {
    expect(season(['calabacín'], 'crema-de-calabacin', { categoria: 'sopa' })).toEqual(['primavera', 'verano']);
    expect(season(['apio'], 'sopa-de-apio', { categoria: 'sopa' })).toEqual(['otono', 'invierno']);
  });

  test('a conflict between ingredients stays null, whatever the dish', () => {
    expect(season(['guisantes', 'apio'], 'guiso', { categoria: 'guiso' })).toBeNull();
  });

  test('a per-slug exception wins over the category', () => {
    expect(season(['tomate', 'pan'], 'salmorejo', { categoria: 'sopa', es_ligero: true })).toEqual(['verano']);
    expect(season(['lentejas'], 'hamburguesa-de-lentejas', { categoria: 'legumbres', es_ligero: false })).toEqual(['todo_el_ano']);
  });

  test('an exception does not override a season that comes from the ingredients', () => {
    expect(season(['espárragos'], 'salmorejo', { categoria: 'sopa' })).toEqual(['primavera']);
  });

  test.each([[null], [undefined], ['guiso'], [[]], [{}]])('a classification that is not usable (%p) leaves the recipe all year', (clasificacion) => {
    expect(season([], 'plato', clasificacion)).toEqual(['todo_el_ano']);
  });

  test('a slug that is not text matches no exception', () => {
    expect(season([], null, { categoria: 'sopa' })).toEqual(['otono', 'invierno']);
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
