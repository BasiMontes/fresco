import type { CanonicalIngredient, GroceryInput, MappedGroceryItem } from './types';
import { normalizeNombre } from '@/lib/text/normalize-nombre';
import { INGREDIENT_DICTIONARY } from './ingredient-dictionary';

/**
 * FRESCO-488 — `mapShoppingListItem`: one Fresco shopping-list item → its
 * buyable form. Pure and deterministic (same input, same output). No I/O, no
 * `shopping_lists` write, no menu / learning touch.
 *
 * See `types.ts` for the contract and the story's Gherkin AC for the four
 * shapes it must handle: non-retail unit, lost recipe context, unknown
 * ingredient, unit-by-pieces.
 */

/** Unit families that can be reconciled with each other. */
const UNIT_FAMILIES: readonly (readonly string[])[] = [
  ['g', 'kg'],
  ['ml', 'l'],
  ['unidades', 'unidad'],
  ['dientes'],
  ['rebanadas'],
  ['latas', 'lata'],
  ['botes', 'bote'],
  ['cucharadas'],
];

function sameFamily(a: string, b: string): boolean {
  if (a === b) { return true; }
  return UNIT_FAMILIES.some(f => f.includes(a) && f.includes(b));
}

/** kg → g, l → ml; every other unit passes through unchanged. */
function toBaseUnit(cantidad: number, unidad: string): { cantidad: number, unidad: string } {
  if (unidad === 'kg') { return { cantidad: cantidad * 1000, unidad: 'g' }; }
  if (unidad === 'l') { return { cantidad: cantidad * 1000, unidad: 'ml' }; }
  return { cantidad, unidad };
}

/**
 * Recipe-context recovery. When `clave` is a dictionary hit but a MORE
 * specific canonical entry exists (`clave` + extra words) and every extra word
 * shows up in one of the item's `usos[].receta` strings, that specific entry
 * is what the shopper actually needs. e.g. "salmón" + recipe "Tostada con
 * salmón ahumado" → "salmón ahumado".
 */
function recoverFromRecipeContext(
  clave: string,
  usos: GroceryInput['usos'],
): CanonicalIngredient | null {
  if (!usos || usos.length === 0) { return null; }
  const recetasNorm = usos.map(u => normalizeNombre(u.receta));

  let best: CanonicalIngredient | null = null;
  for (const entry of Object.values(INGREDIENT_DICTIONARY)) {
    if (entry.clave === clave || !entry.clave.startsWith(`${clave} `)) { continue; }
    const extraWords = entry.clave.slice(clave.length + 1).split(' ');
    const allPresent = extraWords.every(w => recetasNorm.some(r => r.includes(w)));
    if (!allPresent) { continue; }
    // Prefer the most specific match (longest key).
    if (!best || entry.clave.length > best.clave.length) { best = entry; }
  }
  return best;
}

function packCount(cantidad: number, porPaquete: number): number {
  if (!(porPaquete > 0)) { return 1; }
  return Math.max(1, Math.ceil(cantidad / porPaquete));
}

export function mapShoppingListItem(item: GroceryInput): MappedGroceryItem {
  const clave = normalizeNombre(item.nombre);
  const { cantidad: cantidadNormalizada, unidad: unidadNormalizada } = toBaseUnit(
    item.cantidad,
    item.unidad,
  );

  const directo = INGREDIENT_DICTIONARY[clave] ?? null;

  // Unknown ingredient — pass through untouched, never drop it (Business Rule).
  if (!directo) {
    return {
      nombreOriginal: item.nombre,
      productoCanonico: item.nombre,
      terminoBusqueda: item.nombre,
      pasillo: null,
      cantidadNormalizada,
      unidadVenta: item.unidad,
      envasesEstimados: 1,
      confianza: 'baja',
    };
  }

  const recuperado = recoverFromRecipeContext(clave, item.usos);
  const entry = recuperado ?? directo;
  const remapAplicado = recuperado !== null;

  const familiasCoinciden = sameFamily(unidadNormalizada, entry.porcionReceta.unidad);

  return {
    nombreOriginal: item.nombre,
    productoCanonico: entry.canonico,
    terminoBusqueda: entry.terminoBusqueda,
    pasillo: entry.pasillo,
    cantidadNormalizada,
    unidadVenta: entry.envaseVenta.unidad,
    envasesEstimados: packCount(cantidadNormalizada, entry.envaseVenta.cantidad),
    confianza: remapAplicado || !familiasCoinciden ? 'media' : 'alta',
  };
}

/** Convenience: map a whole persisted list's items in one call. */
export function mapShoppingList(items: readonly GroceryInput[]): MappedGroceryItem[] {
  return items.map(mapShoppingListItem);
}
