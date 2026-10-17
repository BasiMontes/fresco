/**
 * FRESCO-943 / FRESCO-999 — the keyword table behind `recipe-allergen-diet-coherence.test.ts`
 * and `scripts/check-hosted-recipe-tags.ts`.
 *
 * The allergen filter is a plain tag comparison, so a recipe whose ingredient list says
 * "queso" but whose `alergenos` lacks `lactosa` reaches the person who declared the
 * allergy. This table is the minimum net for that: a word-boundary match over
 * `ingredientes_principales` AND `pasos_resumen` together (plain substrings are wrong:
 * "champiñones" contains "piñón", "panceta" contains "pan"; and a sub-ingredient named only
 * in a step, like the soy sauce of a pad thai, is just as real as a listed one), a
 * per-allergen exceptions list, and the diet flags that must agree with the tags and the
 * text. It is NOT an exhaustive review of the catalogue (FRESCO-908).
 */

export interface RecipeTags {
  /** Stable id of the row in findings: two rows can share a `nombre`. */
  slug?: string
  nombre: string
  alergenos: string[] | null
  dieta: Record<string, boolean> | null
  ingredientes_principales: string[] | null
  pasos_resumen?: string[] | null
}

/** One way the tags contradict the text. `key` is stable across wording changes. */
export interface Finding {
  key: string
  message: string
}

/** Lower-case and strip accents so `\b` works on the Spanish words ("jamón" -> "jamon"). */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

const words = (list: string) => new RegExp(`\\b(?:${list})\\b`);

/** allergen tag -> words (in an ingredient or a step) that require it. */
export const ALLERGEN_KEYWORDS: Record<string, RegExp> = {
  lactosa: words('leche|queso|yogur|nata|mantequilla|requeson|skyr|bechamel|mozzarella|parmesano|feta|burrata|mascarpone|ricotta|kefir|crema pastelera'),
  gluten: words(
    'trigo|pan|harina|pasta|espaguetis|macarrones|fideos|cuscus|seitan|avena|cebada|centeno|galleta|croissant|bagel|granola|lasana|tortellini|picatostes|masa|cerveza|ramen|empanadas?'
    + '|espelta|kamut|escanda|bulgur|semola|farro|gnocchi|noquis|pizza|rebozad[oa]s?|panko|salsa de soja|shoyu|bechamel',
  ),
  huevo: words('huevos?|mayonesa|crema pastelera|crema de limon|crepes?|croissant|bizcocho|merengue|brioche|magdalenas?|natillas|flan'),
  pescado: words(
    'salmon|bacalao|merluza|atun|bonito|rape|anchoas?|sardinas?|boquerones|dorada|corvina|pescado'
    + '|lubina|trucha|caballa|rodaballo|pez espada|emperador|lenguado|abadejo|mero|pargo|besugo|bacaladilla|jurel|pescadilla|surimi|fumet|dashi',
  ),
  crustaceos: words('gambas?|langostinos?|cangrejo|langosta|cigalas?|camarones?|centollo|bogavante|carabineros?|necoras?|percebes?|buey de mar|krill'),
  moluscos: words('calamares|calamar|mejillones|almejas|pulpo|sepia|ostras?|chipirones?|vieiras?|berberechos?|navajas?|zamburinas?|coquinas?|caracoles'),
  soja: words('soja|tofu|tempeh|tamari|miso|edamame|teriyaki|shoyu'),
  sesamo: words('sesamo|tahini|tahina|hummus|humus'),
  cacahuetes: words('cacahuetes?'),
  frutos_de_cascara: words('nueces|nuez|almendras?|avellanas?|pistachos?|anacardos|pinones?|frutos secos'),
  apio: words('apio|caldo'),
  sulfitos: words('vino|vinagre|pasas|orejones|vermut|cava|sidra'),
  // Curry powder blends carry mustard seed (A7-SAFEA-07, A7-SAFEB-09).
  mostaza: words('mostaza|curry'),
  // FRESCO-912: the last two of the EU-14. No active recipe mentions either today, so
  // these entries are the net that catches the first one that does.
  altramuces: words('altramuz|altramuces|lupino|lupinos'),
};

/**
 * Text that contains a keyword but is NOT the allergen. One entry, one reason.
 * Removed from the normalized text before the keyword match; skips that allergen only.
 */
export const ALLERGEN_EXCEPTIONS: { allergen: string, pattern: RegExp, why: string }[] = [
  { allergen: 'lactosa', pattern: /\bleche de coco\b/, why: 'coconut milk is not dairy' },
  { allergen: 'lactosa', pattern: /\b(?:bebida|leche) de (?:almendras?|avena|soja|arroz)\b/, why: 'plant drinks are not dairy' },
  { allergen: 'lactosa', pattern: /\bnata de coco\b/, why: 'coconut cream is not dairy' },
  { allergen: 'lactosa', pattern: /\bqueso (?:vegano|de (?:anacardos|tofu))\b/, why: 'plant-based cheese' },
  { allergen: 'frutos_de_cascara', pattern: /\bnuez moscada\b/, why: 'nutmeg is a seed, not a tree nut' },
  { allergen: 'frutos_de_cascara', pattern: /\b(?:bebida|leche) de almendras?\b/, why: 'almond drink: the base is declared by the recipe, not a whole nut' },
  { allergen: 'gluten', pattern: /\bharina de (?:maiz|arroz|garbanzos?)\b/, why: 'gluten-free flours' },
  { allergen: 'gluten', pattern: /\bfideos de arroz\b/, why: 'rice noodles' },
  { allergen: 'gluten', pattern: /\bpapel de arroz\b/, why: 'rice paper' },
  { allergen: 'gluten', pattern: /\bpan sin gluten\b/, why: 'gluten-free bread' },
  { allergen: 'gluten', pattern: /\bpasta sin gluten\b/, why: 'gluten-free pasta' },
  { allergen: 'gluten', pattern: /\bpasta de (?:curry|tomate|miso|sesamo|guindilla|ajo|anchoas?|dientes|pimiento|pimenton)\b/, why: 'a paste (condiment), not pasta' },
  { allergen: 'gluten', pattern: /\bsalsa de soja sin gluten\b/, why: 'gluten-free soy sauce' },
  { allergen: 'soja', pattern: /\bbrotes de soja\b/, why: 'bean sprouts are the vegetable, not a soy product' },
  { allergen: 'sulfitos', pattern: /\bvinagre de arroz\b/, why: 'rice vinegar is made without grape must' },
];

/**
 * Words that are noise only inside a STEP, removed before the match. A step's "dorada" is an
 * adjective ("hasta que esté dorada") and its "masa" is the dough of whatever flour the
 * ingredient list names; the same words in the ingredient list are the real thing.
 */
const STEP_NOISE: Record<string, RegExp> = {
  pescado: /\bdorad[ao]s?\b/g,
  gluten: /\bmasa\b/g,
};

/** Pork and alcohol: not halal. */
const NOT_HALAL = words('cerdo|jamon|chorizo|panceta|tocino|morcilla|secreto iberico|vino|cerveza|ron|brandy|licor|cava|bacon|beicon');
/** Never kosher: rabbit, shellfish (also covered by crustaceos/moluscos), pork. */
const NOT_KOSHER = words('conejo|cerdo|jamon|chorizo|panceta|tocino|morcilla|secreto iberico|bacon|beicon');
const MEAT = words('ternera|pollo|pavo|cordero|carne|pato|codornices|higado|rabo de toro|morcillo|solomillo');
/** Anything from an animal that makes a recipe not vegetarian: meat, pork, gelatin. Fish and shellfish come from the allergen table. */
const NOT_VEGETARIAN = words(
  'ternera|pollo|pavo|cordero|carne|pato|codornices|higado|rabo de toro|morcillo|solomillo|cerdo|jamon|chorizo|panceta|tocino|morcilla|secreto iberico|conejo|bacon|beicon|salchichas?|lomo|pechuga|costillas?|gelatina',
);
/** Text that negates a meat word ("sin carne", "carne vegetal"): removed before the vegetarian match. */
const NOT_MEAT_PHRASES = /\b(?:sin carne|carne vegetal|carne de soja|vegetal de carne)\b/g;
/** Not gluten-free unless the text says so: soy sauce is wheat-based, tamari and miso often are. */
const GLUTEN_SUSPECT = words('tamari|miso|teriyaki|salsa de soja|shoyu|cerveza');
const GLUTEN_FREE_PHRASES = /\b(?:tamari|miso|teriyaki|salsa de soja|shoyu|cerveza) sin gluten\b/g;

/** The flags a text can contradict: flag -> allergen tags whose presence in the text breaks it. */
const FLAG_ALLERGENS: Record<string, string[]> = {
  sin_gluten: ['gluten'],
  sin_lactosa: ['lactosa'],
  sin_huevo: ['huevo'],
};

interface Source {
  kind: 'ingrediente' | 'paso'
  text: string
}

function sourcesOf(recipe: RecipeTags): Source[] {
  return [
    ...(recipe.ingredientes_principales ?? []).map(text => ({ kind: 'ingrediente' as const, text })),
    ...(recipe.pasos_resumen ?? []).map(text => ({ kind: 'paso' as const, text })),
  ];
}

/** Normalized text with the exceptions of `allergen` removed. */
function cleaned(text: string, allergen: string): string {
  let name = normalize(text);
  for (const rule of ALLERGEN_EXCEPTIONS) {
    if (rule.allergen === allergen) { name = name.replace(new RegExp(rule.pattern.source, 'g'), ' '); }
  }
  return name;
}

/** Does this ingredient or step require `allergen`? */
export function textHasAllergen(text: string, allergen: string): boolean {
  return ALLERGEN_KEYWORDS[allergen].test(cleaned(text, allergen));
}

const matchedWords = (allergen: string, text: string): string[] =>
  text.match(new RegExp(ALLERGEN_KEYWORDS[allergen].source, 'g')) ?? [];

/**
 * Keyword words that the recipe's own ingredient list already clears: "fideos de arroz" and
 * "leche de coco" are listed, so a step that says just "los fideos" or "la leche" refers to
 * them. Only those exact words are cleared; "salsa de soja" in the same step still counts.
 */
function clearedByListedVariant(recipe: RecipeTags, allergen: string): Set<string> {
  const cleared = new Set<string>();
  for (const text of recipe.ingredientes_principales ?? []) {
    if (textHasAllergen(text, allergen)) { continue; }
    for (const word of matchedWords(allergen, normalize(text))) { cleared.add(word); }
  }
  return cleared;
}

function stepHasAllergen(recipe: RecipeTags, step: string, allergen: string): boolean {
  const noise = STEP_NOISE[allergen];
  const text = cleaned(step, allergen);
  const cleared = clearedByListedVariant(recipe, allergen);
  return matchedWords(allergen, noise ? text.replace(noise, ' ') : text).some(word => !cleared.has(word));
}

const describe = (source: Source) => (source.kind === 'ingrediente' ? `ingrediente: ${source.text}` : `paso: "${source.text}"`);
const firstWith = (sources: Source[], match: (text: string) => boolean) => sources.find(source => match(source.text));

/** Every way the tags contradict the ingredient list and the steps. */
export function auditRecipeFindings(recipe: RecipeTags): Finding[] {
  const alergenos = recipe.alergenos ?? [];
  const dieta = recipe.dieta ?? {};
  const sources = sourcesOf(recipe);
  const id = recipe.slug ?? recipe.nombre;
  const findings: Finding[] = [];
  const fail = (rule: string, message: string) => findings.push({ key: `${id}|${rule}`, message: `${recipe.nombre}: ${message}` });
  const tagged = (allergen: string) => alergenos.includes(allergen);
  const sourceHasAllergen = (source: Source, allergen: string) =>
    (source.kind === 'paso' ? stepHasAllergen(recipe, source.text, allergen) : textHasAllergen(source.text, allergen));
  const hit = (allergen: string) => sources.find(source => sourceHasAllergen(source, allergen));

  for (const allergen of Object.keys(ALLERGEN_KEYWORDS)) {
    if (tagged(allergen)) { continue; }
    const source = hit(allergen);
    if (source) { fail(`falta:${allergen}`, `falta ${allergen} (${describe(source)})`); }
  }

  // A tag that says the allergen is present contradicts the matching free-of flag...
  for (const [flag, [allergen]] of Object.entries(FLAG_ALLERGENS)) {
    if (tagged(allergen) && dieta[flag] === true) { fail(`dieta:${flag}`, `lleva ${allergen} pero ${flag} es true`); }
  }
  // ...and so does the text, when the tag is missing too (the tag finding above is a separate fix).
  for (const [flag, [allergen]] of Object.entries(FLAG_ALLERGENS)) {
    if (tagged(allergen) || dieta[flag] !== true) { continue; }
    const source = hit(allergen);
    if (source) { fail(`dieta:${flag}`, `${flag} es true con ${allergen} en el texto (${describe(source)})`); }
  }
  if (dieta.sin_gluten === true) {
    const suspect = firstWith(sources, text => GLUTEN_SUSPECT.test(normalize(text).replace(GLUTEN_FREE_PHRASES, ' ')));
    if (suspect && !tagged('gluten') && !hit('gluten')) {
      fail('dieta:sin_gluten', `sin_gluten es true con un producto que suele llevar trigo o cebada (${describe(suspect)})`);
    }
  }

  const names = sources.map(source => normalize(source.text));
  const halalBreaker = names.find(name => NOT_HALAL.test(name));
  if (halalBreaker && dieta.halal === true) { fail('dieta:halal', `halal es true con cerdo o alcohol (texto: ${halalBreaker})`); }

  const kosherBreaker = names.find(name => NOT_KOSHER.test(name))
    ?? sources.find(source => sourceHasAllergen(source, 'crustaceos') || sourceHasAllergen(source, 'moluscos'))?.text;
  const meatAndDairy = names.some(name => MEAT.test(name)) && sources.some(source => sourceHasAllergen(source, 'lactosa'));
  if (dieta.kosher === true && (kosherBreaker || meatAndDairy)) {
    fail('dieta:kosher', `kosher es true con ${kosherBreaker ? `conejo, marisco o cerdo (texto: ${kosherBreaker})` : 'carne y lácteo'}`);
  }

  const animal = sources.find(source =>
    NOT_VEGETARIAN.test(normalize(source.text).replace(NOT_MEAT_PHRASES, ' '))
    || sourceHasAllergen(source, 'pescado') || sourceHasAllergen(source, 'crustaceos') || sourceHasAllergen(source, 'moluscos'));
  if (animal && (dieta.vegetariano === true || dieta.vegano === true)) {
    fail(dieta.vegano === true ? 'dieta:vegano' : 'dieta:vegetariano', `${dieta.vegano === true ? 'vegano' : 'vegetariano'} es true con carne o pescado (${describe(animal)})`);
  }
  if (dieta.vegano === true && !animal) {
    const dairyOrEgg = sources.find(source =>
      sourceHasAllergen(source, 'lactosa') || sourceHasAllergen(source, 'huevo') || /\bmiel\b/.test(normalize(source.text)));
    if (dairyOrEgg) { fail('dieta:vegano', `vegano es true con lácteo, huevo o miel (${describe(dairyOrEgg)})`); }
  }
  return findings;
}

/** Messages (`<name>: ...`) for every way the tags contradict the text. */
export function auditRecipe(recipe: RecipeTags): string[] {
  return auditRecipeFindings(recipe).map(finding => finding.message);
}
