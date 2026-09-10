import { describe, expect, test } from 'bun:test';
import { buildDictionary, renderFile } from '../../scripts/gen-grocery-dictionary';
import { BASE_QUANTITIES } from '../../supabase/functions/generate-shopping-list/consolidator';
import { CANONICAL_KEYS, INGREDIENT_DICTIONARY } from './ingredient-dictionary';
import {
  RETAIL_PACK_OVERRIDE,
  SEARCH_TERM_OVERRIDE,
  SYNONYM_OVERRIDE,
} from './retail-packs';

/**
 * FRESCO-488 — the Node dictionary is generated from the Edge function's own
 * recipe vocabulary (`BASE_QUANTITIES`). Nothing at the type level forces the
 * committed file to stay in sync with a fresh generator run, or the overlay
 * keys to stay valid ingredient names. These tests do — same posture as
 * `lib/text/runtime-parity.test.ts` (FRESCO-382) and `scripts/check-*-drift.ts`.
 */

describe('ingredient-dictionary — generated file is in sync', () => {
  test('committed file matches a fresh generator run', async () => {
    const fresh = renderFile(buildDictionary());
    const committed = Bun.file(new URL('./ingredient-dictionary.ts', import.meta.url));
    return committed.text().then((text) => {
      expect(text).toBe(fresh);
    });
  });
});

describe('ingredient-dictionary — parity with the Edge vocabulary', () => {
  const edgeKeys = Object.keys(BASE_QUANTITIES);

  test('every Edge BASE_QUANTITIES key has a dictionary entry', () => {
    const missing = edgeKeys.filter(k => !INGREDIENT_DICTIONARY[k]);
    expect(missing).toEqual([]);
  });

  test('the dictionary adds no keys the Edge vocabulary does not have', () => {
    const extra = CANONICAL_KEYS.filter(k => !(k in BASE_QUANTITIES));
    expect(extra).toEqual([]);
  });
});

describe('retail-packs overlay — keys are real ingredients', () => {
  test.each([
    ['RETAIL_PACK_OVERRIDE', RETAIL_PACK_OVERRIDE],
    ['SEARCH_TERM_OVERRIDE', SEARCH_TERM_OVERRIDE],
    ['SYNONYM_OVERRIDE', SYNONYM_OVERRIDE],
  ])('%s has no key absent from BASE_QUANTITIES', (_label, table) => {
    const strays = Object.keys(table).filter(k => !(k in BASE_QUANTITIES));
    expect(strays).toEqual([]);
  });
});

describe('ingredient-dictionary — every entry is well-formed', () => {
  test('envaseVenta.cantidad is positive and unidad is non-empty', () => {
    for (const entry of Object.values(INGREDIENT_DICTIONARY)) {
      expect(entry.envaseVenta.cantidad).toBeGreaterThan(0);
      expect(entry.envaseVenta.unidad.length).toBeGreaterThan(0);
    }
  });

  test('terminoBusqueda is never empty', () => {
    for (const entry of Object.values(INGREDIENT_DICTIONARY)) {
      expect(entry.terminoBusqueda.length).toBeGreaterThan(0);
    }
  });
});
