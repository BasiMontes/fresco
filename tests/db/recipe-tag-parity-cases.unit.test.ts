/** FRESCO-1020 — the probe generator is pure, so it is pinned without a stack. */

import { describe, expect, test } from 'bun:test';
import { ALL_ALLERGENS, buildCases, oracleRules, wordsOf } from './recipe-tag-parity-cases';

describe('wordsOf', () => {
  test('expands an optional letter and a character class', () => {
    expect(wordsOf(/\b(?:huevos?|rebozad[oa]s?)\b/).sort()).toEqual(['huevo', 'huevos', 'rebozada', 'rebozadas', 'rebozado', 'rebozados']);
  });

  test('keeps a multi-word alternative whole and expands inside it', () => {
    expect(wordsOf(/\b(?:tortillas? de trigo|pan)\b/).sort()).toEqual(['pan', 'tortilla de trigo', 'tortillas de trigo']);
  });
});

describe('buildCases', () => {
  const cases = buildCases();

  test('probes every word as an ingredient, as a step and with every tag set', () => {
    for (const word of ['queso', 'salsa de soja', 'carne picada']) {
      expect(cases.map(probe => probe.name)).toEqual(expect.arrayContaining([`ingredient: ${word}`, `step: ${word}`, `tagged ingredient: ${word}`]));
    }
    expect(cases.length).toBeGreaterThan(900);
  });

  test('most probes carry a finding, so a list the SQL mistypes cannot go unseen', () => {
    const withFindings = cases.filter(probe => oracleRules(probe).length > 0);

    expect(withFindings.length / cases.length).toBeGreaterThan(0.8);
  });

  test('a recipe with every tag set raises no missing-allergen finding', () => {
    const tagged = cases.find(probe => probe.name === 'tagged ingredient: queso')!;

    expect(tagged.alergenos).toEqual(ALL_ALLERGENS);
    expect(oracleRules(tagged).filter(rule => rule.startsWith('falta:'))).toEqual([]);
  });
});
