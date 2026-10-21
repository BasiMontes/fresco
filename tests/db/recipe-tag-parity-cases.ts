/**
 * FRESCO-1020 — the probes that keep the SQL function `recipe_tag_findings` equal to the TypeScript
 * oracle in `recipe-allergen-diet-rules.ts`. The real catalogue has almost no findings (it is clean),
 * so comparing the two on it proves little: a keyword mistyped in SQL would never be exercised. These
 * cases are built from the oracle's own word lists, one probe per word, so every list is exercised on
 * both sides. Pure: no database, shared by the DB test and by the one-off check against a hosted copy.
 */

import type { Finding } from './recipe-allergen-diet-rules';
import {
  ALLERGEN_KEYWORDS,
  auditRecipeFindings,
  FODMAP_BREAKERS,
  GLUTEN_SUSPECT,
  KETO_BREAKERS,
  MEAT,
  NOT_HALAL,
  NOT_KOSHER,
  NOT_VEGETARIAN,
  PALEO_BREAKERS,
  WINE,
} from './recipe-allergen-diet-rules';

export interface ParityCase {
  name: string
  alergenos: string[]
  dieta: Record<string, boolean>
  ingredientes: string[]
  pasos: string[]
}

/** The ten flags the oracle holds to their definition, all on: any word that breaks one shows up. */
const ALL_FLAGS: Record<string, boolean> = Object.fromEntries(
  ['sin_gluten', 'sin_lactosa', 'sin_huevo', 'vegano', 'vegetariano', 'keto', 'paleo', 'halal', 'kosher', 'bajo_fodmap'].map(flag => [flag, true]),
);

/** Every allergen tag the oracle knows. */
export const ALL_ALLERGENS = Object.keys(ALLERGEN_KEYWORDS);

/** Expands one alternative of a keyword list: `rebozad[oa]s?` -> rebozado, rebozados, rebozada, rebozadas. */
function expandAlternative(alternative: string): string[] {
  let results = [''];
  for (let index = 0; index < alternative.length; index++) {
    let options: string[];
    if (alternative[index] === '[') {
      const end = alternative.indexOf(']', index);
      options = [...alternative.slice(index + 1, end)];
      index = end;
    }
    else {
      options = [alternative[index]];
    }
    const optional = alternative[index + 1] === '?';
    if (optional) { index++; }
    results = results.flatMap(prefix => [...(optional ? [prefix] : []), ...options.map(option => prefix + option)]);
  }
  return results;
}

/** The words a `\b(?:a|b|c?)\b` list matches. */
export function wordsOf(list: RegExp): string[] {
  const inner = list.source.replace(/^\\b\(\?:/, '').replace(/\)\\b$/, '');
  return [...new Set(inner.split('|').flatMap(expandAlternative))];
}

/** Phrases that contain a keyword and are not the allergen or the breaker, plus the phrases that restore a flag. */
const PHRASES = [
  'leche de coco',
  'bebida de avena',
  'bebida de almendras',
  'nata de coco',
  'queso vegano',
  'queso de anacardos',
  'nuez moscada',
  'harina de maiz',
  'harina de arroz',
  'harina de almendras',
  'fideos de arroz',
  'papel de arroz',
  'pan sin gluten',
  'pasta sin gluten',
  'pasta de curry',
  'pasta de tomate',
  'salsa de soja sin gluten',
  'miso sin gluten',
  'tamari sin gluten',
  'nachos sin gluten',
  'su caldo',
  'brotes de soja',
  'vinagre de arroz',
  'judias verdes',
  'carne picada',
  'carne picada de ternera',
  'carne mixta',
  'mezcla de carnes',
  'vino kosher',
  'vino certificado',
  'parmesano',
  'parmesano vegetariano',
  'gruyere dop vegetariano',
  'queso vegetariano',
  'caldo',
  'caldo de verduras',
  'caldo vegetal',
  'sin carne',
  'carne vegetal',
  'carne de soja',
  'dorada',
  'masa',
  'Jamón Ibérico',
  'Piñones',
  'Champiñones',
  'panceta',
  'pan rallado',
  'huevo',
  'miel',
  'mantequilla',
  'atún',
  'gambas',
  'leche',
  'yogur natural',
];

/** The probes: every word of every list, as an ingredient and as a step, plus the phrases, plus the tags alone. */
export function buildCases(): ParityCase[] {
  const words = [...new Set([
    ...Object.values(ALLERGEN_KEYWORDS).flatMap(wordsOf),
    ...[FODMAP_BREAKERS, GLUTEN_SUSPECT, KETO_BREAKERS, MEAT, NOT_HALAL, NOT_KOSHER, NOT_VEGETARIAN, PALEO_BREAKERS, WINE].flatMap(wordsOf),
    ...PHRASES,
  ])];
  const cases: ParityCase[] = [];
  for (const word of words) {
    cases.push(
      { name: `ingredient: ${word}`, alergenos: [], dieta: ALL_FLAGS, ingredientes: [word], pasos: [] },
      { name: `step: ${word}`, alergenos: [], dieta: ALL_FLAGS, ingredientes: ['agua'], pasos: [`Mezclar con ${word} y servir`] },
      { name: `tagged ingredient: ${word}`, alergenos: ALL_ALLERGENS, dieta: ALL_FLAGS, ingredientes: [word], pasos: [] },
    );
  }
  cases.push(
    { name: 'no text, no tags', alergenos: [], dieta: {}, ingredientes: [], pasos: [] },
    { name: 'tags only: gluten and lactose', alergenos: ['gluten', 'lactosa'], dieta: ALL_FLAGS, ingredientes: ['agua'], pasos: [] },
    { name: 'tags only: soy and peanut', alergenos: ['soja', 'cacahuetes'], dieta: ALL_FLAGS, ingredientes: ['agua'], pasos: [] },
    { name: 'a variant listed clears the word in a step', alergenos: [], dieta: {}, ingredientes: ['fideos de arroz', 'leche de coco'], pasos: ['Cocer los fideos', 'Añadir la leche'] },
    { name: 'a listed variant does not clear another keyword', alergenos: [], dieta: {}, ingredientes: ['fideos de arroz'], pasos: ['Cocer los fideos con salsa de soja'] },
    { name: 'a vegetable stock listed clears a bare stock', alergenos: ['apio'], dieta: { vegetariano: true }, ingredientes: ['caldo de verduras'], pasos: ['Añadir el caldo'] },
    { name: 'a bare stock with no vegetable stock listed', alergenos: ['apio'], dieta: { vegetariano: true }, ingredientes: ['arroz'], pasos: ['Añadir el caldo'] },
    { name: 'meat and dairy together are not kosher', alergenos: ['lactosa'], dieta: { kosher: true }, ingredientes: ['ternera', 'queso'], pasos: [] },
    { name: 'a clean vegan recipe', alergenos: [], dieta: ALL_FLAGS, ingredientes: ['calabacin', 'tomate'], pasos: ['Asar las verduras'] },
  );
  return cases;
}

/** The oracle's finding keys for a case, without the recipe id: what the SQL function calls `rule`. */
export function oracleRules(probe: ParityCase): string[] {
  const findings: Finding[] = auditRecipeFindings({
    slug: 'probe',
    nombre: probe.name,
    alergenos: probe.alergenos,
    dieta: probe.dieta,
    ingredientes_principales: probe.ingredientes,
    pasos_resumen: probe.pasos,
  });
  return [...new Set(findings.map(finding => finding.key.slice('probe|'.length)))].sort();
}
