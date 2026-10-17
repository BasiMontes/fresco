import type { RecipeTags } from '../tests/db/recipe-allergen-diet-rules';
import { describe, expect, test } from 'bun:test';
import { auditCatalogue, MIN_ACTIVE_RECIPES, parseCatalogue } from './check-hosted-recipe-tags';

/** FRESCO-999 — the hosted-catalogue check fails on any finding and never reads a broken dump as clean. */

function clean(n: number): RecipeTags[] {
  return Array.from({ length: n }, (_, i) => ({
    slug: `receta-${i}`,
    nombre: `Receta ${i}`,
    alergenos: [],
    dieta: {},
    ingredientes_principales: ['calabacin', 'aceite de oliva'],
    pasos_resumen: ['Saltear las verduras'],
  }));
}

describe('parseCatalogue', () => {
  test('reads the { rows } shape of `supabase db query -o json`, ignoring text before the JSON', () => {
    const raw = `Connecting to remote database...\n${JSON.stringify({ rows: clean(2), warning: 'x' })}`;
    expect(parseCatalogue(raw)).toHaveLength(2);
  });

  test('reads a bare array', () => {
    expect(parseCatalogue(JSON.stringify(clean(3)))).toHaveLength(3);
  });

  test('refuses input that is not a catalogue', () => {
    expect(() => parseCatalogue('no json here')).toThrow('no JSON found');
    expect(() => parseCatalogue('{"error":"boom"}')).toThrow('expected a JSON array');
  });
});

describe('auditCatalogue', () => {
  test('a clean catalogue has no findings', () => {
    expect(auditCatalogue(clean(MIN_ACTIVE_RECIPES))).toEqual({ checked: MIN_ACTIVE_RECIPES, findings: [] });
  });

  test('ANY finding is reported, with the recipe slug in the key (hummus without sesamo, soy sauce only in a step)', () => {
    const rows = clean(MIN_ACTIVE_RECIPES);
    rows[0] = { ...rows[0], slug: 'tostada-hummus-pepino', ingredientes_principales: ['pan integral', 'hummus', 'pepino'], alergenos: ['gluten'] };
    rows[1] = { ...rows[1], slug: 'pad-thai', pasos_resumen: ['Mezclar todo con salsa de soja'] };

    const { findings } = auditCatalogue(rows);

    expect(findings.map(finding => finding.key)).toEqual(expect.arrayContaining([
      'tostada-hummus-pepino|falta:sesamo',
      'pad-thai|falta:soja',
      'pad-thai|falta:gluten',
    ]));
  });

  test('an empty or truncated dump is an error, never "clean"', () => {
    expect(() => auditCatalogue([])).toThrow('the dump is incomplete');
    expect(() => auditCatalogue(clean(MIN_ACTIVE_RECIPES - 1))).toThrow('the dump is incomplete');
  });
});
