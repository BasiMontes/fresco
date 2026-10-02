import type { PerfilCompra } from './product-compatibility';
import type { PrecioNormalizado } from './supermarket/types';
import type { CanonicalIngredient, GroceryInput, MappedGroceryItem } from './types';
import { normalizeNombre } from '@/lib/text/normalize-nombre';
import { INGREDIENT_DICTIONARY } from './ingredient-dictionary';
import { esProductoCompatible, nombreProductoDesdeUrl } from './product-compatibility';
import { productoDeCatalogo } from './supermarket/catalog-connectors';
import { registroSupermercados } from './supermarket/registry';
import { precioPorUnidadReferencia } from './supermarket/units';

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

/** Recipe-name filler that carries no ingredient signal — ignored when gating a context remap. */
const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'sin', 'al', 'a', 'y', 'en']);

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
export function recoverFromRecipeContext(
  clave: string,
  usos: GroceryInput['usos'],
): CanonicalIngredient | null {
  if (!usos || usos.length === 0) { return null; }
  const recetasNorm = usos.map(u => normalizeNombre(u.receta));

  let best: CanonicalIngredient | null = null;
  for (const entry of Object.values(INGREDIENT_DICTIONARY)) {
    if (entry.clave === clave || !entry.clave.startsWith(`${clave} `)) { continue; }
    const extraWords = entry.clave
      .slice(clave.length + 1)
      .split(' ')
      .filter(w => !STOPWORDS.has(w));
    if (extraWords.length === 0) { continue; }
    const allPresent = extraWords.every(w => recetasNorm.some(r => r.includes(w)));
    if (!allPresent) { continue; }
    // Prefer the most specific match (longest key).
    if (!best || entry.clave.length > best.clave.length) { best = entry; }
  }
  return best;
}

/**
 * FRESCO-768 — the entry's price in the common shape, from every connector the
 * registry lets run. Only the chain whose pack the entry's `envaseVenta` IS
 * counts (`origenEnvase`): another chain's catalog may also hold the
 * ingredient, but with a different pack, and mixing them would price one pack
 * and count another.
 *
 * FRESCO-826: a product incompatible with the shopper's diet or allergens is
 * dropped, so the ingredient shows no link and no catalog price (the catalog
 * holds one product per ingredient, there is no other candidate).
 */
function preciosNormalizados(entry: CanonicalIngredient, perfil: PerfilCompra | undefined): PrecioNormalizado[] {
  const precios: PrecioNormalizado[] = [];
  for (const conector of registroSupermercados.activos()) {
    if (conector.cadena !== entry.origenEnvase) { continue; }
    const producto = productoDeCatalogo(conector.cadena, entry.clave);
    if (!producto) { continue; }
    const nombre = producto.nombre === entry.clave ? nombreProductoDesdeUrl(producto.url) : producto.nombre;
    if (!esProductoCompatible(entry.clave, nombre, perfil)) { continue; }
    precios.push({
      cadena: producto.cadena,
      precioEnvase: producto.precioEnvase,
      precioReferencia: precioPorUnidadReferencia({ precioEnvase: producto.precioEnvase, envase: producto.envase }),
      url: producto.url,
      observadoEn: producto.observadoEn,
    });
  }
  return precios;
}

function packCount(cantidad: number, porPaquete: number): number {
  if (!(porPaquete > 0)) { return 1; }
  return Math.max(1, Math.ceil(cantidad / porPaquete));
}

export function mapShoppingListItem(item: GroceryInput, perfil?: PerfilCompra): MappedGroceryItem {
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
      unidadVenta: unidadNormalizada,
      envasesEstimados: 1,
      confianza: 'baja',
      origenEnvase: 'estimado',
      precios: [],
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
    origenEnvase: entry.origenEnvase,
    precios: preciosNormalizados(entry, perfil),
  };
}

/** Convenience: map a whole persisted list's items in one call. */
export function mapShoppingList(items: readonly GroceryInput[], perfil?: PerfilCompra): MappedGroceryItem[] {
  return items.map(item => mapShoppingListItem(item, perfil));
}
