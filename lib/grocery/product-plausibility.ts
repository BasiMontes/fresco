import { normalizeNombre } from '../text/normalize-nombre.ts';

/**
 * FRESCO-785 — is this supermarket product a plausible buy for this ingredient?
 *
 * Shared by both catalog generators and the runtime matcher, so a product the
 * generators would never pick is never picked by the matcher either. Pure, no
 * I/O. Two guards, both diet-independent:
 *
 * 1. Category exclusion: pastry, bakery, cold cuts and smoked products are not
 *    the ingredient, unless the ingredient itself asks for them.
 * 2. Species guard: a generic meat ingredient ("carne picada") must not resolve
 *    to a product naming one species ("cerdo") or a species mix it never named.
 *    This is what keeps a Halal shopper off pork without reading their profile.
 *
 * When this rejects every candidate the ingredient has no link and no price:
 * "no reliable match" shows nothing, never a wrong product.
 */

interface CategoryExclusion {
  /** Normalized whole-word tokens that mark the excluded category in a product name. */
  tokens: readonly string[]
  /** When set, the exclusion applies only to ingredients matching this pattern. */
  onlyFor?: RegExp
}

const CATEGORY_EXCLUSIONS: readonly CategoryExclusion[] = [
  { tokens: ['reposteria', 'bolleria', 'pasteleria', 'postres', 'postre', 'trenza', 'bizcocho', 'galleta', 'galletas', 'donut', 'croissant', 'napolitana'] },
  { tokens: ['chocolate', 'cacao'], onlyFor: /^(fideos|nueces|almendras|avellanas|pasas|cacahuetes)\b/ },
  { tokens: ['fiambre', 'embutido', 'cocido', 'cocida'], onlyFor: /\b(pechuga|pollo|pavo|ternera|cerdo|lomo|carne)\b/ },
  { tokens: ['lonchas', 'loncheado', 'loncheada'], onlyFor: /\b(pechuga|pollo|pavo|ternera|cerdo|lomo|carne)\b/ },
  { tokens: ['ahumado', 'ahumada', 'ahumados', 'ahumadas'] },
  // Not the ingredient: pet food, prepared dairy, infusions, sweets, ready meals and bakery.
  { tokens: ['gato', 'gatos', 'perro', 'perros', 'mascota', 'mascotas', 'conejos', 'enanos'] },
  { tokens: ['bifidus', 'yogur', 'yogurt', 'activia', 'helado', 'batido'] },
  { tokens: ['infusion', 'caramelo', 'caramelos', 'aros', 'cereales', 'barrita', 'snack', 'chicle', 'chicles', 'gragea', 'grissini', 'mollejas', 'sabor', 'vaso', 'orientales', 'instantaneos'] },
  { tokens: ['nuggets', 'bocaditos', 'bites', 'pizza', 'salteado', 'relleno', 'rellenos', 'arroz', 'pate', 'higado'] },
  { tokens: ['kebab', 'brocheta', 'brochetas', 'rebozada', 'rebozado', 'empanada', 'empanado', 'bolonesa', 'carbonara', 'rosegones', 'jardinera', 'tarrito', 'tarritos', 'yarroz', 'empanadilla', 'empanadillas', 'burger', 'hamburguesa', 'peskitos', 'palitos', 'petalos', 'infantil', 'mickey', 'higaditos', 'pan', 'hogaza', 'rebanado', 'tostadas'] },
];

/** Species a meat product may name. `mixta` is a pork and beef blend, so it counts as one. */
const SPECIES_TOKENS: readonly string[] = [
  'cerdo',
  'cerda',
  'ternera',
  'vacuno',
  'buey',
  'pollo',
  'pavo',
  'cordero',
  'conejo',
  'pato',
  'mixta',
  'mixto',
];

/** Ingredients the species guard looks at: raw meat, not cold cuts or the species-named ones. */
const GENERIC_MEAT = /\b(?:carne|pechuga|filete|filetes|chuleta|chuletas|solomillo|picada|picado|hamburguesa)\b/;

function words(texto: string): Set<string> {
  return new Set(normalizeNombre(texto).split(/[^a-z0-9]+/).filter(Boolean));
}

const PROTEINA = /\b(?:carne|pollo|pavo|ternera|cerdo|cordero|merluza|salmon|bacalao|atun|gambas|pescado|lomo|pechuga)\b/;

const ARTICULOS = new Set(['de', 'del', 'la', 'el', 'los', 'las']);

/** How many words a product name may place before the ingredient and still be that ingredient ("filetes pechuga pollo"). */
const MAX_PALABRAS_ANTES = 2;

function mismaPalabra(palabra: string, termino: string): boolean {
  return palabra === termino || palabra === `${termino}s` || palabra === `${termino}es`;
}

/**
 * Mercadona and Consum name a product "<core noun> <descriptor> <brand>", so the
 * ingredient is the product when it sits among the first words. Later, or after
 * "con" / "sin", it is an add-in or a trait of another product: "bifidus con
 * nueces", "panecillo sin sal".
 */
function esCabezaDelProducto(clave: string, nombreProducto: string): boolean {
  const termino = clave.split(' ').find(p => !ARTICULOS.has(p));
  if (!termino) { return true; }
  const palabrasProducto = normalizeNombre(nombreProducto).split(/[^a-z0-9]+/).filter(p => p && !ARTICULOS.has(p));
  const indice = palabrasProducto.findIndex(p => mismaPalabra(p, termino));
  if (indice < 0) { return true; } // matched through a synonym the caller already vetted
  if (indice > MAX_PALABRAS_ANTES) { return false; }
  return !palabrasProducto.slice(0, indice).some(p => p === 'con' || p === 'sin');
}

function nombraAlgunaEspecie(palabras: Set<string>): boolean {
  return SPECIES_TOKENS.some(t => palabras.has(t));
}

export function esProductoPlausible(ingrediente: string, nombreProducto: string): boolean {
  const clave = normalizeNombre(ingrediente);
  const claveWords = words(clave);
  const productoWords = words(nombreProducto);

  for (const { tokens, onlyFor } of CATEGORY_EXCLUSIONS) {
    if (onlyFor && !onlyFor.test(clave)) { continue; }
    const marcado = tokens.filter(t => productoWords.has(t));
    // The ingredient asking for the category itself ("salmon ahumado") lifts it.
    if (marcado.length > 0 && !marcado.some(t => claveWords.has(t))) { return false; }
  }

  if (!esCabezaDelProducto(clave, nombreProducto)) { return false; }

  // "merluza con pisto", "ternera con verduras": a protein plus a garnish is a ready meal.
  if (PROTEINA.test(clave) && /\bcon\b(?! (?:piel|hueso|huesos|espinas)\b)/.test(normalizeNombre(nombreProducto)) && !/\bcon\b/.test(clave)) {
    return false;
  }

  if (GENERIC_MEAT.test(clave) && !nombraAlgunaEspecie(claveWords)) {
    // "pechuga" alone is poultry by name, so only a non-poultry species conflicts.
    const permitidas = claveWords.has('pechuga') ? new Set(['pollo', 'pavo']) : new Set<string>();
    const conflicto = SPECIES_TOKENS.some(t => productoWords.has(t) && !permitidas.has(t));
    if (conflicto) { return false; }
  }

  return true;
}
