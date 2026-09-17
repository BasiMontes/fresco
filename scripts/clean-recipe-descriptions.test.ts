import { describe, expect, test } from 'bun:test';
import { cleanRecipeDescription } from './clean-recipe-descriptions.ts';

// Fixtures: real prod `recipes.descripcion_corta` sample pulled 2026-09-15 (FRESCO-526).
describe('cleanRecipeDescription', () => {
  test('drops the dangling "de" from "de con", keeps the rest untouched', () => {
    expect(cleanRecipeDescription('Wok de con tamari y jengibre con aceitunas, apta vegana, sin gluten, sin lácteos y keto.')).toBe(
      'Wok con tamari y jengibre con aceitunas, apta vegana, sin gluten, sin lácteos y keto.',
    );
    expect(cleanRecipeDescription('Sopa de con ajo con cilantro, apta vegana, sin gluten, sin lácteos y keto.')).toBe(
      'Sopa con ajo con cilantro, apta vegana, sin gluten, sin lácteos y keto.',
    );
  });

  test('matches the connector case-insensitively (real rows are always lowercase)', () => {
    expect(cleanRecipeDescription('Bol De Con semillas de calabaza con limón.')).toBe(
      'Bol con semillas de calabaza con limón.',
    );
  });

  test('leaves a description with no dangling connector untouched', () => {
    expect(cleanRecipeDescription('Crema suave de calabacín con un chorrito de aceite de oliva.')).toBe(
      'Crema suave de calabacín con un chorrito de aceite de oliva.',
    );
  });

  test('does not touch a legitimate "de" followed by an unrelated word starting with "con"', () => {
    // Guards the word-boundary: "de conchas" must never become "conchas".
    expect(cleanRecipeDescription('Sopa de conchas con perejil.')).toBe('Sopa de conchas con perejil.');
  });

  // FRESCO-528: real prod `recipes.descripcion_corta` sample pulled 2026-09-17,
  // collateral finding from FRESCO-526 — same generator-template bug, different
  // duplicated connector ("con y " / "de y ").
  test('collapses the duplicated "con y" connector, keeps the rest untouched', () => {
    expect(cleanRecipeDescription('Tofu a la plancha con y limón con ajo asado, apta vegana, sin gluten, sin lácteos y keto.')).toBe(
      'Tofu a la plancha con limón con ajo asado, apta vegana, sin gluten, sin lácteos y keto.',
    );
    expect(cleanRecipeDescription('Calabacín salteado con y albahaca con jengibre, apta vegana, sin gluten, sin lácteos y keto.')).toBe(
      'Calabacín salteado con albahaca con jengibre, apta vegana, sin gluten, sin lácteos y keto.',
    );
  });

  test('collapses the duplicated "de y" connector, keeps the rest untouched', () => {
    expect(cleanRecipeDescription('Curry de y leche de coco con semillas de calabaza, apta vegana, sin gluten, sin lácteos y keto.')).toBe(
      'Curry de leche de coco con semillas de calabaza, apta vegana, sin gluten, sin lácteos y keto.',
    );
  });

  test('matches the duplicated connector case-insensitively', () => {
    expect(cleanRecipeDescription('Rúcula Con Y semillas de girasol con jengibre.')).toBe(
      'Rúcula Con semillas de girasol con jengibre.',
    );
  });

  test('leaves a legitimate "y" conjunction between two flavors untouched', () => {
    // Guards the word-boundary: "cúrcuma y comino" (a real two-item list) must
    // survive — only a "con"/"de" immediately before the "y" is the bug.
    expect(cleanRecipeDescription('Coliflor asada con y cúrcuma y comino con semillas de calabaza, apta vegana, sin gluten, sin lácteos y keto.')).toBe(
      'Coliflor asada con cúrcuma y comino con semillas de calabaza, apta vegana, sin gluten, sin lácteos y keto.',
    );
  });

  test('does not touch words that merely start with "y" after "con"/"de"', () => {
    // Guards the word-boundary: "con yogur"/"de yuca" must never lose "yogur"/"yuca".
    expect(cleanRecipeDescription('Bol con yogur y granola.')).toBe('Bol con yogur y granola.');
    expect(cleanRecipeDescription('Crema de yuca con cilantro.')).toBe('Crema de yuca con cilantro.');
  });
});
