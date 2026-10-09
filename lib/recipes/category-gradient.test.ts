import { describe, expect, test } from 'bun:test';
import { categoryGradient, RECIPE_CATEGORIES } from './category-gradient';

/**
 * FRESCO-861 — the category contract (`CategoriaReceta`) is the list the
 * database check `recipes_categoria_en_contrato` accepts. That every category has a
 * placeholder gradient is enforced by the compiler (`Record<CategoriaReceta, ...>`).
 */
describe('categoryGradient', () => {
  test('the contract lists the 18 categories the catalogue uses, bowls and batidos included', () => {
    expect(RECIPE_CATEGORIES).toHaveLength(18);
    expect(RECIPE_CATEGORIES).toEqual(expect.arrayContaining(['bowls', 'batidos', 'reposteria', 'tostadas', 'lacteos', 'wrap']));
  });

  test('a category outside the contract, or a missing one, gets the neutral fallback', () => {
    expect(categoryGradient('bowl')).toBe(categoryGradient(null));
    expect(categoryGradient(undefined)).toBe(categoryGradient(null));
    expect(categoryGradient('')).toBe(categoryGradient(null));
  });
});
