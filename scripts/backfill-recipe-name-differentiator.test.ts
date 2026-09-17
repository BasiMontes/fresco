import type { RecipeNameRow } from './backfill-recipe-name-differentiator.ts';
import { describe, expect, test } from 'bun:test';
import { deriveDifferentiatedNames } from './backfill-recipe-name-differentiator.ts';

// Fixtures: real prod `recipes` duplicate-`nombre` groups pulled live
// 2026-09-17 (FRESCO-524) via `supabase db query --linked`.
describe('deriveDifferentiatedNames', () => {
  test('derives a distinct nombre per row from the shared "Wok" group (8 rows)', () => {
    const group: RecipeNameRow[] = [
      { id: '1', nombre: 'Wok de tamari y jengibre', descripcionCorta: 'Wok con tamari y jengibre con cilantro, apta vegana, sin gluten, sin lácteos y keto.' },
      { id: '2', nombre: 'Wok de tamari y jengibre', descripcionCorta: 'Wok con tamari y jengibre con semillas de calabaza, apta vegana, sin gluten, sin lácteos y keto.' },
      { id: '3', nombre: 'Wok de tamari y jengibre', descripcionCorta: 'Wok con tamari y jengibre con lima, apta vegana, sin gluten, sin lácteos y keto.' },
      { id: '4', nombre: 'Wok de tamari y jengibre', descripcionCorta: 'Wok con tamari y jengibre con aceitunas, apta vegana, sin gluten, sin lácteos y keto.' },
    ];

    const result = deriveDifferentiatedNames(group);

    expect(result).toHaveLength(4);
    expect(result.map(r => r.newNombre)).toEqual([
      'Wok de tamari y jengibre con cilantro',
      'Wok de tamari y jengibre con semillas de calabaza',
      'Wok de tamari y jengibre con lima',
      'Wok de tamari y jengibre con aceitunas',
    ]);
    // Every derived nombre is unique within the group.
    expect(new Set(result.map(r => r.newNombre)).size).toBe(4);
  });

  test('keeps a multi-word differentiator whole, including a leading adjective before "con"', () => {
    // "Tofu al curry verde" group: one sibling's differentiator is "picante
    // con jengibre" — the word "picante" must not be dropped or split off.
    const group: RecipeNameRow[] = [
      { id: '1', nombre: 'Tofu al curry verde', descripcionCorta: 'Tofu al curry verde con y leche de coco con aceitunas, apta vegana, sin gluten, sin lácteos y keto.' },
      { id: '2', nombre: 'Tofu al curry verde', descripcionCorta: 'Tofu al curry verde con y leche de coco picante con jengibre, apta vegana, sin gluten, sin lácteos y keto.' },
      { id: '3', nombre: 'Tofu al curry verde', descripcionCorta: 'Tofu al curry verde con y leche de coco con cilantro fresco, apta vegana, sin gluten, sin lácteos y keto.' },
    ];

    const result = deriveDifferentiatedNames(group);

    expect(result.map(r => r.newNombre)).toEqual([
      'Tofu al curry verde con aceitunas',
      'Tofu al curry verde picante con jengibre',
      'Tofu al curry verde con cilantro fresco',
    ]);
  });

  test('trims a trailing connector shared by the whole group so the remainder keeps its own "con"', () => {
    // "Berenjena a la plancha con albahaca" group: the shared prefix
    // ("... con y albahaca con") ends in a connector before the
    // differentiator — must not swallow the "con" into the shared part.
    const group: RecipeNameRow[] = [
      { id: '1', nombre: 'Berenjena a la plancha con albahaca', descripcionCorta: 'Berenjena a la plancha con y albahaca con semillas de calabaza, apta vegana, sin gluten, sin lácteos y keto.' },
      { id: '2', nombre: 'Berenjena a la plancha con albahaca', descripcionCorta: 'Berenjena a la plancha con y albahaca con lima, apta vegana, sin gluten, sin lácteos y keto.' },
    ];

    const result = deriveDifferentiatedNames(group);

    expect(result.map(r => r.newNombre)).toEqual([
      'Berenjena a la plancha con albahaca con semillas de calabaza',
      'Berenjena a la plancha con albahaca con lima',
    ]);
  });

  test('never propagates a dangling-connector bug ("y con") that lives entirely in the shared prefix', () => {
    // "Boles de coco" group: `descripcion_corta` carries the (separately
    // tracked, out-of-scope-here) "y con" dangling-connector bug, but it's
    // fully inside the part every sibling shares — must never leak into the
    // derived nombre.
    const group: RecipeNameRow[] = [
      { id: '1', nombre: 'Boles de coco', descripcionCorta: 'Boles de coco y con semillas de girasol con limón, apta vegana, sin gluten, sin lácteos y keto.' },
      { id: '2', nombre: 'Boles de coco', descripcionCorta: 'Boles de coco y con semillas de girasol con jengibre, apta vegana, sin gluten, sin lácteos y keto.' },
    ];

    const result = deriveDifferentiatedNames(group);

    expect(result.map(r => r.newNombre)).toEqual([
      'Boles de coco con limón',
      'Boles de coco con jengibre',
    ]);
    for (const { newNombre } of result) {
      expect(newNombre).not.toMatch(/\by con\b/i);
    }
  });

  test('is a no-op (empty result) on a single-row group — nothing to disambiguate', () => {
    const group: RecipeNameRow[] = [
      { id: '1', nombre: 'Sopa fría de melón', descripcionCorta: 'Sopa fría de melón, apta vegana, sin gluten, sin lácteos y keto.' },
    ];

    expect(deriveDifferentiatedNames(group)).toEqual([]);
  });

  test('leaves the whole group unresolved when a row has no remainder to append', () => {
    // Defensive case: a row whose description is identical to the shared
    // prefix has nothing left to disambiguate with. Rather than partially
    // rename siblings (which could still leave a collision), the whole
    // group is skipped for manual review.
    const group: RecipeNameRow[] = [
      { id: '1', nombre: 'Curry de leche de coco', descripcionCorta: 'Curry de leche de coco, apta vegana, sin gluten, sin lácteos y keto.' },
      { id: '2', nombre: 'Curry de leche de coco', descripcionCorta: 'Curry de leche de coco con jengibre, apta vegana, sin gluten, sin lácteos y keto.' },
    ];

    expect(deriveDifferentiatedNames(group)).toEqual([]);
  });

  test('leaves a non-generator (hand-authored prose) duplicate group untouched', () => {
    // "Fajitas de pollo" group: two independently hand-authored recipes
    // that happen to share a dish name — free-prose descriptions, no diet
    // tag clause. Diffing them naively would bolt a whole sentence onto
    // `nombre`; the group must be skipped entirely instead.
    const group: RecipeNameRow[] = [
      { id: '1', nombre: 'Fajitas de pollo', descripcionCorta: 'Tiras de pollo con pimiento en tortilla de trigo.' },
      { id: '2', nombre: 'Fajitas de pollo', descripcionCorta: 'Fajitas de pollo con pimientos y cebolla, en tortilla de trigo.' },
    ];

    expect(deriveDifferentiatedNames(group)).toEqual([]);
  });

  test('leaves the whole group unresolved when two rows would derive the same new nombre', () => {
    // Three siblings sharing `nombre`: rows 1 and 3 have byte-identical
    // headlines (a genuine duplicate pair), row 2 is legitimately
    // different. The differing row 2 shortens the common prefix enough
    // that rows 1 and 3 both resolve to the same derived nombre — a
    // collision the script must not silently apply.
    const group: RecipeNameRow[] = [
      { id: '1', nombre: 'Curry', descripcionCorta: 'Curry de garbanzos con espinacas, apta vegana, sin gluten, sin lácteos y keto.' },
      { id: '2', nombre: 'Curry', descripcionCorta: 'Curry de calabaza, apta vegana, sin gluten, sin lácteos y keto.' },
      { id: '3', nombre: 'Curry', descripcionCorta: 'Curry de garbanzos con espinacas, apta vegetariana, sin gluten, con lácteos.' },
    ];

    expect(deriveDifferentiatedNames(group)).toEqual([]);
  });
});
