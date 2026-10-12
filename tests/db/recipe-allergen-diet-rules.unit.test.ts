import type { RecipeTags } from './recipe-allergen-diet-rules';
import { describe, expect, test } from 'bun:test';
import { auditRecipe, ingredientHasAllergen } from './recipe-allergen-diet-rules';

/**
 * FRESCO-943 — the exceptions list of the allergen/diet audit must not mask the real cases
 * (jamón, queso, trigo), and the word boundaries must not invent false ones. No stack needed.
 */

const DIET = { halal: true, kosher: true, sin_gluten: true, sin_lactosa: true, sin_huevo: true };

function recipe(ingredients: string[], overrides: Partial<RecipeTags> = {}): RecipeTags {
  return { nombre: 'Receta', alergenos: [], dieta: { ...DIET }, ingredientes_principales: ingredients, ...overrides };
}

describe('allergen keywords catch the audit cases', () => {
  test('queso, yogur and leche require lactosa, even next to an exception-looking word', () => {
    expect(auditRecipe(recipe(['queso feta']))).toEqual(['Receta: falta lactosa (ingrediente: queso feta)']);
    expect(auditRecipe(recipe(['yogur griego']))).toHaveLength(1);
    expect(auditRecipe(recipe(['leche de coco', 'leche']))).toEqual(['Receta: falta lactosa (ingrediente: leche)']);
  });

  test('tortilla de trigo requires gluten', () => {
    expect(auditRecipe(recipe(['tortilla de trigo']))).toEqual(['Receta: falta gluten (ingrediente: tortilla de trigo)']);
  });

  test('jamón breaks halal and kosher; wine breaks halal and needs sulfitos', () => {
    const ham = auditRecipe(recipe(['jamón serrano']));
    expect(ham.some(m => m.includes('halal'))).toBe(true);
    expect(ham.some(m => m.includes('kosher'))).toBe(true);
    const wine = auditRecipe(recipe(['vino blanco']));
    expect(wine.some(m => m.includes('falta sulfitos'))).toBe(true);
    expect(wine.some(m => m.includes('halal'))).toBe(true);
  });

  test('rabbit, shellfish and meat with dairy break kosher', () => {
    expect(auditRecipe(recipe(['conejo'])).some(m => m.includes('kosher'))).toBe(true);
    expect(auditRecipe(recipe(['gambas'])).some(m => m.includes('kosher'))).toBe(true);
    expect(auditRecipe(recipe(['ternera', 'queso'], { alergenos: ['lactosa'], dieta: { ...DIET, sin_lactosa: false } }))
      .some(m => m.includes('carne y lácteo'))).toBe(true);
  });

  test('a tag that says the allergen is present contradicts the diet flag', () => {
    const problems = auditRecipe(recipe([], { alergenos: ['gluten', 'lactosa', 'huevo'] }));
    expect(problems).toHaveLength(3);
  });
});

describe('exceptions and word boundaries do not invent allergens', () => {
  test.each([
    ['lactosa', 'leche de coco'],
    ['lactosa', 'bebida de almendra'],
    ['lactosa', 'leche de avena'],
    ['lactosa', 'nata de coco'],
    ['lactosa', 'bebida de soja'],
    ['frutos_de_cascara', 'nuez moscada'],
    ['frutos_de_cascara', 'bebida de almendra'],
    ['gluten', 'harina de maíz'],
    ['gluten', 'fideos de arroz'],
    ['gluten', 'pan sin gluten'],
    ['gluten', 'panceta'],
    ['frutos_de_cascara', 'champiñones'],
    ['soja', 'brotes de soja'],
  ])('%s is not required by "%s"', (allergen, ingredient) => {
    expect(ingredientHasAllergen(ingredient, allergen)).toBe(false);
  });

  test.each([
    ['lactosa', 'queso'],
    ['lactosa', 'queso crema'],
    ['gluten', 'pan integral'],
    ['gluten', 'tortilla de trigo'],
    ['gluten', 'harina de trigo'],
    ['frutos_de_cascara', 'nueces'],
    ['frutos_de_cascara', 'piñones'],
    ['soja', 'tofu'],
    ['sulfitos', 'vino tinto'],
  ])('%s is still required by "%s"', (allergen, ingredient) => {
    expect(ingredientHasAllergen(ingredient, allergen)).toBe(true);
  });

  test('a coherent recipe has no findings', () => {
    const dieta = { ...DIET, halal: false, kosher: false };
    expect(auditRecipe(recipe(['leche de coco', 'champiñones', 'panceta'], { dieta }))).toEqual([]);
  });
});
