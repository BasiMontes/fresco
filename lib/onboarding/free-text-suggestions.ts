import { ALERGENO_VALUES, INGREDIENTE_ODIADO_VALUES } from '@/lib/constants/dietary-options';

/**
 * FRESCO-1228 — deterministic, closed-vocabulary detection of allergens and
 * disliked ingredients in the onboarding free-text boxes. No AI, no network.
 *
 * THIS MODULE ONLY PROPOSES. It never writes to the store. A suggestion becomes
 * a hard filter only when the person clicks its confirm button, and the click
 * writes the exact `values` into `alergenos` / `ingredientesOdiados` (the same
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
 * 5. ONE typed phrase that implies several allergens (marisco = crustaceos AND
 *    moluscos; frutos secos = frutos_de_cascara AND cacahuetes) is ONE
 *    suggestion carrying all its values, so a single click never leaves a
 *    half-protected state.
 *
 * NEGATION / FALSE-POSITIVE RULE
 * "sin", "no", "ni", "nada" never suppress a match. When in doubt we SUGGEST,
 * because a suggestion costs one click and applies nothing, while a missed
 * allergen costs health. "No soy alérgico a nada" matches nothing on its own
 * (no vocabulary word). "No tengo alergia al marisco" still suggests marisco;
 * the person dismisses it. The wording of the suggestion is therefore neutral
 * ("Has escrito «X»: ¿lo añadimos...?") and never asserts that X is an allergy
 * or a diet. `soy` (the verb) is deliberately NOT a synonym of soja.
 *
 * DECISIONS ON AMBIGUOUS WORDS (each is only a suggestion; recall over precision
 * where the word is what a person with that allergy would type):
 * - ACCEPTED despite other meanings: pan, pasta, harina, cerveza, malta (gluten:
 *   the words a celiac types), clara, yema (huevo), bonito, rape (pescado),
 *   helado, suero, flan (lacteos), dorada, sepia, langosta, choco, pota.
 * - NOT ADDED: `tortilla` (corn tortilla vs egg omelette: ambiguous either way),
 *   `crema` alone (crema de calabacin has no dairy; only `crema pastelera` and
 *   `crema catalana` are listed), `pez` alone (any fish and non-food uses; only
 *   `pez espada` is listed), `navaja` singular (a knife; only the plural
 *   `navajas`, the shellfish), castañas, piñones, coco (not on the EU frutos de
 *   cascara list).
 * - Compounds that are NOT the allergen are consumed first as their own entries:
 *   leche de coco/arroz, nata de coco, nuez moscada, trigo sarraceno (buckwheat
 *   has no gluten), queso vegano, harina de maiz/arroz/garbanzo, mantequilla de
 *   cacao. `queso de soja` and `leche de soja` suggest soja, not lacteos.
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
  /** Exact values written to the store on confirm (members of `ALERGENO_VALUES` / `INGREDIENTE_ODIADO_VALUES`). */
  values: string[]
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
  gluten: [
    'gluten',
    'sin gluten',
    'tacc',
    'trigo',
    'centeno',
    'cebada',
    'avena',
    'espelta',
    'kamut',
    'seitan',
    'celiaco',
    'celiaca',
    'celiaquia',
    'pan',
    'pasta',
    'harina',
    'cerveza',
    'malta',
    'semola',
    'cuscus',
    'fideo',
    'galleta',
    'empanado',
    'rebozado',
  ],
  lactosa: [
    'lactosa',
    'lactoza',
    'leche',
    'lacteo',
    'queso',
    'nata',
    'mantequilla',
    'yogur',
    'yogurt',
    'caseina',
    'helado',
    'suero',
    'lactosuero',
    'requeson',
    'mascarpone',
    'flan',
    'bechamel',
    'besamel',
    'cuajada',
    'kefir',
    'crema pastelera',
    'crema catalana',
  ],
  huevo: ['huevo', 'clara', 'yema', 'mayonesa', 'merengue', 'albumina', 'ovoalbumina'],
  frutos_de_cascara: [
    'fruto seco',
    'fruto de cascara',
    'nuez',
    'nueces',
    'almendra',
    'avellana',
    'pistacho',
    'anacardo',
    'maranon',
    'pecana',
    'pacana',
    'nuez de brasil',
    'macadamia',
    'turron',
    'mazapan',
    'praline',
    'almendrado',
  ],
  cacahuetes: ['cacahuete', 'cacahuate', 'cachuete', 'cacahuette', 'mani', 'fruto seco'],
  soja: ['soja', 'soya', 'tofu', 'edamame', 'tempeh'],
  pescado: [
    'pescado',
    'atun',
    'salmon',
    'merluza',
    'bacalao',
    'anchoa',
    'sardina',
    'trucha',
    'lubina',
    'dorada',
    'caballa',
    'boqueron',
    'lenguado',
    'bonito',
    'surimi',
    'tilapia',
    'rape',
    'rodaballo',
    'pescadilla',
    'pez espada',
  ],
  crustaceos: [
    'marisco',
    'crustaceo',
    'gamba',
    'langostino',
    'camaron',
    'cangrejo',
    'bogavante',
    'langosta',
    'cigala',
    'centollo',
    'percebe',
    'buey de mar',
    'krill',
    'carabinero',
    'necora',
    'centolla',
    'jaiba',
    'gambon',
  ],
  moluscos: [
    'marisco',
    'molusco',
    'mejillon',
    'almeja',
    'calamar',
    'pulpo',
    'sepia',
    'chipiron',
    'ostra',
    'vieira',
    'berberecho',
    'caracol',
    'cefalopodo',
    'navajas', // plural only: "navaja" alone is a knife
    'zamburina',
    'coquina',
    'choco',
    'jibia',
    'pota',
  ],
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
  'harina de almendra': ['frutos_de_cascara'],
  'leche de almendra': ['frutos_de_cascara'],
  'leche de anacardo': ['frutos_de_cascara'],
  'leche de avena': ['gluten'],
  'leche de soja': ['soja'],
  'leche de soya': ['soja'],
  'queso de soja': ['soja'],
  'leche de coco': [],
  'leche de arroz': [],
  'nata de coco': [],
  'queso vegano': [],
  'nuez moscada': [],
  'trigo sarraceno': [],
  'harina de maiz': [],
  'harina de arroz': [],
  'harina de garbanzo': [],
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
 * Scans `text` and returns one suggestion per typed phrase and kind, in typed
 * order; a phrase implying several values carries all of them.
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
    const push = (kind: SuggestionKind, candidates: string[]) => {
      if (!kinds.includes(kind)) { return; }
      const values = candidates.filter(v => (kind === 'alergeno' ? ALERGENO_VALUES.has(v) : INGREDIENTE_ODIADO_VALUES.has(v)));
      if (values.length === 0) { return; }
      const key = `${kind}:${values.join('+')}:${typedKey}`;
      if (seen.has(key)) { return; }
      seen.add(key);
      out.push({ kind, values, typed, key });
    };
    push('alergeno', entry.alergenos);
    push('ingrediente', entry.ingredientes);
    i += entry.words.length;
  }
  return out;
}
