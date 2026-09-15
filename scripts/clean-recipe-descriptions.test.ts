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
});
