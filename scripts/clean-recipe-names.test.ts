import { describe, expect, test } from 'bun:test';
import { cleanRecipeName } from './clean-recipe-names.ts';

// Fixture: real prod `recipes.nombre` sample pulled 2026-09-07 (FRESCO-449).
describe('cleanRecipeName', () => {
  test('strips a single filler wrapper phrase, keeps the real flavor', () => {
    expect(cleanRecipeName('Sopa de ajo con cilantro')).toBe('Sopa de ajo con cilantro');
    expect(cleanRecipeName('Gofres con especias con canela')).toBe('Gofres con canela');
  });

  test('strips stacked filler suffixes down to the base dish', () => {
    expect(
      cleanRecipeName('Gambas al ajillo al estilo mediterraneo con guarnicion de temporada'),
    ).toBe('Gambas al ajillo');
    expect(cleanRecipeName('Pollo al horno al estilo del sur con guarnicion de temporada')).toBe(
      'Pollo al horno',
    );
  });

  test('strips "version ligera" regardless of accent', () => {
    expect(cleanRecipeName('Calamares a la plancha version ligera')).toBe(
      'Calamares a la plancha',
    );
    expect(cleanRecipeName('Pasta con setas version ligera')).toBe('Pasta con setas');
  });

  test('fixes dangling-connector generator bugs ("de y", "y con")', () => {
    // 8 words after the "de y" fix -> truncated to 6, never on a dangling connector.
    expect(cleanRecipeName('Curry de y leche de coco picante con jengibre')).toBe(
      'Curry de leche de coco picante',
    );
    // 7 words after the "con y" fix -> truncated to 6 -> trailing "con" trimmed again.
    expect(cleanRecipeName('Setas shiitake salteadas con y tamari con aceitunas')).toBe(
      'Setas shiitake salteadas con tamari',
    );
    // 8 words after the "con y" fix -> both trailing clauses dropped whole
    // (never left mid-clause) to fit the 6-word cap.
    expect(
      cleanRecipeName('Coles de Bruselas asadas con y ajo picante con jengibre'),
    ).toBe('Coles de Bruselas asadas');
  });

  test('truncates to ~6 words after cleanup, never ending on a dangling connector', () => {
    const cleaned = cleanRecipeName(
      'Boles de coco y con semillas de girasol con semillas de lino',
    );
    expect(cleaned.split(' ').length).toBeLessThanOrEqual(6);
    expect(cleaned).not.toMatch(/\s(con|y|de|al)$/i);
  });

  test('is a no-op on an already-clean name', () => {
    expect(cleanRecipeName('Tortilla de calabacín y cebolla')).toBe('Tortilla de calabacín y cebolla');
    expect(cleanRecipeName('Sopa fría de melón')).toBe('Sopa fría de melón');
  });

  test('does not strip a bare wrapper phrase when a real modifier follows it in the same clause', () => {
    expect(cleanRecipeName('Pollo con especias orientales al horno')).toBe(
      'Pollo con especias orientales al horno',
    );
  });

  test('strips a trailing dangling "a la" (empty style slot)', () => {
    expect(cleanRecipeName('Pollo asado a la')).toBe('Pollo asado');
  });

  test('never collapses to an empty name — falls back to the original', () => {
    expect(cleanRecipeName('con especias')).toBe('con especias');
  });

  test('is idempotent — running twice yields the same result', () => {
    const inputs = [
      'Tostada con salmon ahumado al estilo mediterraneo con frutos rojos',
      'Alubias con verduras con hierbas frescas version ligera',
      'Yogur griego con granola con hierbas frescas con miel',
    ];
    for (const input of inputs) {
      const once = cleanRecipeName(input);
      const twice = cleanRecipeName(once);
      expect(twice).toBe(once);
    }
  });
});
