/**
 * FRESCO-943 — the keyword table behind `recipe-allergen-diet-coherence.test.ts`.
 *
 * The allergen filter is a plain tag comparison, so a recipe whose ingredient list says
 * "queso" but whose `alergenos` lacks `lactosa` reaches the person who declared the
 * allergy. This table is the minimum net for that: a word-boundary match over
 * `ingredientes_principales` (plain substrings are wrong: "champiñones" contains "piñón",
 * "panceta" contains "pan"), a per-allergen exceptions list, and the diet flags that
 * must agree with the tags. It is NOT an exhaustive review of the catalogue (FRESCO-908).
 */

export interface RecipeTags {
  nombre: string
  alergenos: string[] | null
  dieta: Record<string, boolean> | null
  ingredientes_principales: string[] | null
}

/** Lower-case and strip accents so `\b` works on the Spanish words ("jamón" -> "jamon"). */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

const words = (list: string) => new RegExp(`\\b(?:${list})\\b`);

/** allergen tag -> ingredient words that require it. */
export const ALLERGEN_KEYWORDS: Record<string, RegExp> = {
  lactosa: words('leche|queso|yogur|nata|mantequilla|requeson|skyr|bechamel|mozzarella|parmesano|feta|burrata|mascarpone|ricotta|kefir|crema pastelera'),
  gluten: words('trigo|pan|harina|pasta|espaguetis|macarrones|fideos|cuscus|seitan|avena|cebada|centeno|galleta|croissant|bagel|granola|lasana|tortellini|picatostes|masa|cerveza|ramen|empanada'),
  huevo: words('huevos?|mayonesa|crema pastelera'),
  pescado: words('salmon|bacalao|merluza|atun|bonito|rape|anchoas?|sardinas?|boquerones|dorada|corvina|pescado'),
  crustaceos: words('gambas?|langostinos?|cangrejo|langosta'),
  moluscos: words('calamares|calamar|mejillones|almejas|pulpo|sepia|ostras?'),
  soja: words('soja|tofu|tempeh|tamari|miso|edamame|teriyaki'),
  sesamo: words('sesamo|tahini'),
  cacahuetes: words('cacahuetes?'),
  frutos_de_cascara: words('nueces|nuez|almendras?|avellanas?|pistachos?|anacardos|pinones?|frutos secos'),
  apio: words('apio'),
  sulfitos: words('vino'),
};

/**
 * Ingredients that contain a keyword but are NOT the allergen. One entry, one reason.
 * Matched against the normalized ingredient name; a match skips that allergen only.
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
  { allergen: 'soja', pattern: /\bbrotes de soja\b/, why: 'bean sprouts are the vegetable, not a soy product' },
];

/** Pork and alcohol: not halal. */
const NOT_HALAL = words('cerdo|jamon|chorizo|panceta|tocino|morcilla|secreto iberico|vino|cerveza|ron|brandy|licor|cava');
/** Never kosher: rabbit, shellfish (also covered by crustaceos/moluscos), pork. */
const NOT_KOSHER = words('conejo|cerdo|jamon|chorizo|panceta|tocino|morcilla|secreto iberico');
const MEAT = words('ternera|pollo|pavo|cordero|carne|pato|codornices|higado|rabo de toro|morcillo|solomillo');

export function ingredientHasAllergen(ingredient: string, allergen: string): boolean {
  const name = normalize(ingredient);
  if (!ALLERGEN_KEYWORDS[allergen].test(name)) { return false; }
  return !ALLERGEN_EXCEPTIONS.some(rule => rule.allergen === allergen && rule.pattern.test(name));
}

/** Messages (`<name>: ...`) for every way the tags contradict the ingredient list. */
export function auditRecipe(recipe: RecipeTags): string[] {
  const alergenos = recipe.alergenos ?? [];
  const dieta = recipe.dieta ?? {};
  const ingredients = recipe.ingredientes_principales ?? [];
  const problems: string[] = [];
  const fail = (message: string) => problems.push(`${recipe.nombre}: ${message}`);

  for (const allergen of Object.keys(ALLERGEN_KEYWORDS)) {
    if (alergenos.includes(allergen)) { continue; }
    const ingredient = ingredients.find(item => ingredientHasAllergen(item, allergen));
    if (ingredient) { fail(`falta ${allergen} (ingrediente: ${ingredient})`); }
  }

  const tagged = (allergen: string) => alergenos.includes(allergen);
  if (tagged('gluten') && dieta.sin_gluten === true) { fail('lleva gluten pero sin_gluten es true'); }
  if (tagged('lactosa') && dieta.sin_lactosa === true) { fail('lleva lactosa pero sin_lactosa es true'); }
  if (tagged('huevo') && dieta.sin_huevo === true) { fail('lleva huevo pero sin_huevo es true'); }

  const names = ingredients.map(normalize);
  const halalBreaker = names.find(name => NOT_HALAL.test(name));
  if (halalBreaker && dieta.halal === true) { fail(`halal es true con cerdo o alcohol (ingrediente: ${halalBreaker})`); }

  const kosherBreaker = names.find(name => NOT_KOSHER.test(name))
    ?? ingredients.find(item => ingredientHasAllergen(item, 'crustaceos') || ingredientHasAllergen(item, 'moluscos'));
  const meatAndDairy = names.some(name => MEAT.test(name))
    && ingredients.some(item => ingredientHasAllergen(item, 'lactosa'));
  if (dieta.kosher === true && (kosherBreaker || meatAndDairy)) {
    fail(`kosher es true con ${kosherBreaker ? `conejo, marisco o cerdo (ingrediente: ${kosherBreaker})` : 'carne y lácteo'}`);
  }
  return problems;
}
