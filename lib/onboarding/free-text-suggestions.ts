import { ALERGENO_VALUES, INGREDIENTE_ODIADO_VALUES } from '@/lib/constants/dietary-options';

/**
 * FRESCO-1228 — deterministic, closed-vocabulary detection of allergens and
 * disliked ingredients in the onboarding free-text boxes. No AI, no network.
 *
 * THIS MODULE ONLY PROPOSES. It never writes to the store. A suggestion becomes
 * a hard filter only when the person clicks its confirm button, and the click
 * writes the exact `value` into `alergenos` / `ingredientesOdiados` (the same
 * fields the chips use). Text that matches nothing stays unfiltered and keeps
 * the FRESCO-1000 warning (`TEXTO_LIBRE_SIN_FILTRO`).
 *
 * MATCHING RULES (all of them closed, none heuristic)
 * 1. Each typed word is lowercased and stripped of accents (`ñ` -> `n`).
 * 2. A vocabulary word matches a typed word when equal, or when the typed word
 *    is the vocabulary word + `s` or + `es` (regular plurals only). Irregular
 *    plurals (nuez -> nueces, altramuz -> altramuces) are listed explicitly.
 * 3. Multi-word entries match consecutive words. The longest entry wins at each
 *    position and consumes its words, so "mantequilla de cacahuete" yields
 *    cacahuetes only, never lacteos, and "leche de coco" yields nothing.
 * 4. Typos are tolerated ONLY where an explicit alias exists below (cachuete,
 *    lactoza). There is no fuzzy matching: a wrong guess on an allergen is
 *    worse than no guess.
 *
 * NEGATION / FALSE-POSITIVE RULE
 * "sin", "no", "ni", "nada" never suppress a match. When in doubt we SUGGEST,
 * because a suggestion costs one click and applies nothing, while a missed
 * allergen costs health. "No soy alérgico a nada" matches nothing on its own
 * (no vocabulary word). "No tengo alergia al marisco" still suggests marisco;
 * the person dismisses it. The wording of the suggestion is therefore neutral
 * ("Has escrito «X»: ¿lo añadimos...?") and never asserts that X is an allergy.
 * `soy` (the verb) is deliberately NOT a synonym of soja; only `soja`/`soya`.
 *
 * FALSE-POSITIVE REVIEW of risky synonyms (each is only a suggestion):
 * - mantequilla / leche / queso / nata: lacteos. Compounds that are not dairy
 *   (leche de coco/arroz/almendra/avena/soja, mantequilla de cacahuete/cacao)
 *   are consumed first as their own entries, so they do not suggest lacteos.
 * - nuez: frutos_de_cascara. "nuez moscada" (nutmeg, not a nut) is consumed
 *   as an empty entry.
 * - frutos secos: suggests frutos_de_cascara AND cacahuetes. In Spain the term
 *   often includes peanuts; two separate chips, each needing its own click.
 * - marisco: suggests crustaceos AND moluscos (both are "marisco").
 * - dorada, sepia, langosta: also an adjective / colour / insect in Spanish.
 *   Kept (recall over precision) since nothing applies without a click.
 * - castañas, piñones, coco: NOT in the EU frutos de cascara list, so excluded.
 * - pan, harina, pasta, cerveza: gluten-bearing but too generic; excluded.
 *
 * Ingredient suggestions only exist for the closed list the SQL understands:
 * `get_filtered_recipes` compares `lower(ingredientes_odiados)` for EQUALITY
 * with each name in `recipes.ingredientes_principales`, so only the values of
 * `INGREDIENTE_ODIADO_OPTIONS` are suggestable; inventing other words would
 * filter nothing while looking protective. `pimiento` alone is ambiguous
 * (rojo/verde) and matches nothing.
 */

export type SuggestionKind = 'alergeno' | 'ingrediente';

export interface FreeTextSuggestion {
  kind: SuggestionKind
  /** Exact value written to the store on confirm (an `ALERGENO_VALUES` / `INGREDIENTE_ODIADO_VALUES` member). */
  value: string
  /** What the person typed, as typed (original case and accents). */
  typed: string
  /** Stable identity used to remember a dismissal for this text. */
  key: string
}

interface Entry {
  words: string[]
  alergenos: string[]
  ingredientes: string[]
}

type Vocab = Record<string, string[]>;

/** allergen value -> normalized (lowercase, no accents, singular) synonyms. */
export const ALERGENO_SYNONYMS: Vocab = {
  gluten: ['gluten', 'trigo', 'centeno', 'cebada', 'avena', 'espelta', 'kamut', 'seitan', 'celiaco', 'celiaca', 'celiaquia', 'sin gluten', 'tacc'],
  lactosa: ['lactosa', 'lactoza', 'leche', 'lacteo', 'queso', 'nata', 'mantequilla', 'yogur', 'yogurt', 'caseina'],
  huevo: ['huevo'],
  frutos_de_cascara: ['fruto seco', 'fruto de cascara', 'nuez', 'nueces', 'almendra', 'avellana', 'pistacho', 'anacardo', 'maranon', 'pecana', 'nuez de brasil', 'macadamia'],
  cacahuetes: ['cacahuete', 'cacahuate', 'cachuete', 'cacahuette', 'mani', 'fruto seco'],
  soja: ['soja', 'soya', 'tofu', 'edamame', 'tempeh'],
  pescado: ['pescado', 'atun', 'salmon', 'merluza', 'bacalao', 'anchoa', 'sardina', 'trucha', 'lubina', 'dorada', 'caballa', 'boqueron'],
  crustaceos: ['marisco', 'crustaceo', 'gamba', 'langostino', 'camaron', 'cangrejo', 'bogavante', 'langosta', 'cigala', 'centollo', 'percebe', 'buey de mar', 'krill'],
  moluscos: ['marisco', 'molusco', 'mejillon', 'almeja', 'calamar', 'pulpo', 'sepia', 'chipiron', 'ostra', 'vieira', 'berberecho', 'caracol', 'cefalopodo'],
  sesamo: ['sesamo', 'ajonjoli', 'tahini', 'tahin'],
  apio: ['apio', 'apionabo'],
  sulfitos: ['sulfito', 'dioxido de azufre'],
  mostaza: ['mostaza'],
  altramuces: ['altramuz', 'altramuces', 'lupino', 'lupin'],
};

/** Compounds that must NOT trigger their head word. `[]` = recognised, suggests nothing. */
const COMPOUNDS: Record<string, string[]> = {
  'mantequilla de cacahuete': ['cacahuetes'],
  'mantequilla de cacahuate': ['cacahuetes'],
  'mantequilla de mani': ['cacahuetes'],
  'crema de cacahuete': ['cacahuetes'],
  'crema de avellana': ['frutos_de_cascara'],
  'mantequilla de almendra': ['frutos_de_cascara'],
  'leche de almendra': ['frutos_de_cascara'],
  'leche de anacardo': ['frutos_de_cascara'],
  'leche de avena': ['gluten'],
  'leche de soja': ['soja'],
  'leche de soya': ['soja'],
  'leche de coco': [],
  'leche de arroz': [],
  'nuez moscada': [],
  'mantequilla de cacao': [],
  'manteca de cacao': [],
};

/** disliked-ingredient value -> normalized singular synonyms. Values MUST be INGREDIENTE_ODIADO_OPTIONS values. */
export const INGREDIENTE_SYNONYMS: Vocab = {
  'cebolla': ['cebolla'],
  'champiñones': ['champinon'],
  'setas': ['seta'],
  'cilantro': ['cilantro'],
  'apio': ['apio'],
  'comino': ['comino'],
  'guisantes': ['guisante'],
  'judias verdes': ['judia verde', 'habichuela verde'],
  'pimiento rojo': ['pimiento rojo'],
  'pimiento verde': ['pimiento verde'],
  'chorizo': ['chorizo'],
  'panceta': ['panceta'],
  'tocino': ['tocino'],
  'morcilla': ['morcilla'],
};

function normalizeWord(word: string): string {
  return word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function buildEntries(): Entry[] {
  const byPhrase = new Map<string, Entry>();
  const get = (phrase: string): Entry => {
    let entry = byPhrase.get(phrase);
    if (!entry) {
      entry = { words: phrase.split(' '), alergenos: [], ingredientes: [] };
      byPhrase.set(phrase, entry);
    }
    return entry;
  };
  for (const [phrase, values] of Object.entries(COMPOUNDS)) {
    get(phrase).alergenos.push(...values);
  }
  for (const [value, phrases] of Object.entries(ALERGENO_SYNONYMS)) {
    for (const phrase of phrases) {
      const entry = get(phrase);
      if (!entry.alergenos.includes(value)) { entry.alergenos.push(value); }
    }
  }
  for (const [value, phrases] of Object.entries(INGREDIENTE_SYNONYMS)) {
    for (const phrase of phrases) { get(phrase).ingredientes.push(value); }
  }
  // Longest entry first so a compound consumes its words before its head word.
  return [...byPhrase.values()].sort((a, b) => b.words.length - a.words.length);
}

const ENTRIES = buildEntries();

function wordMatches(token: string, word: string): boolean {
  return token === word || token === `${word}s` || token === `${word}es`;
}

export interface FindSuggestionsOptions {
  /** Which kinds this box may propose. */
  kinds: SuggestionKind[]
}

/**
 * Scans `text` and returns de-duplicated suggestions in typed order.
 * Pure: same input, same output; no store access.
 */
export function findSuggestions(text: string, { kinds }: FindSuggestionsOptions): FreeTextSuggestion[] {
  const tokens = [...text.matchAll(/[\p{L}\p{N}]+/gu)].map(m => ({
    norm: normalizeWord(m[0]),
    start: m.index,
    end: m.index + m[0].length,
  }));
  const out: FreeTextSuggestion[] = [];
  const seen = new Set<string>();

  let i = 0;
  while (i < tokens.length) {
    const entry = ENTRIES.find(e =>
      i + e.words.length <= tokens.length
      && e.words.every((w, k) => wordMatches(tokens[i + k].norm, w)),
    );
    if (!entry) {
      i += 1;
      continue;
    }
    const last = tokens[i + entry.words.length - 1];
    const typed = text.slice(tokens[i].start, last.end);
    const typedKey = tokens.slice(i, i + entry.words.length).map(t => t.norm).join(' ');
    const push = (kind: SuggestionKind, value: string) => {
      if (!kinds.includes(kind)) { return; }
      const valid = kind === 'alergeno' ? ALERGENO_VALUES.has(value) : INGREDIENTE_ODIADO_VALUES.has(value);
      if (!valid) { return; }
      const key = `${kind}:${value}:${typedKey}`;
      if (seen.has(key)) { return; }
      seen.add(key);
      out.push({ kind, value, typed, key });
    };
    entry.alergenos.forEach(value => push('alergeno', value));
    entry.ingredientes.forEach(value => push('ingrediente', value));
    i += entry.words.length;
  }
  return out;
}
