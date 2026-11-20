import type { CompraPorItem, LineaCompra } from './compra';
import type { ShoppingListPasillo } from '@/lib/api/types';
import { normalizeNombre } from '@/lib/text/normalize-nombre';
import { claveItemCompra, precioCuentaComoVigente } from './compra';

/**
 * FRESCO-1222 — "Comparar tu compra": a labelled estimate for the chains that have no price data.
 *
 * Pure and client-safe: it imports no catalog. The server (`resolverCompra`) stamps each row with
 * `precioBaseEstimacion` (the Mercadona price of a staple row) and the card sums that plain data, so the
 * estimate follows the list as rows are bought or removed. No price of another chain is read or stored:
 * FRESCO-1221 measured a factor 1.0 over Mercadona for house-brand staples, nothing more.
 */

/** FRESCO-1221 (`.context/business/supermarket-price-estimate-2026-11-17.md`): factor over Mercadona, house-brand staples only. */
export const FACTOR_ESTIMACION = 1.0;

/**
 * Closed set of staples the factor was measured on (milk, rice, butter, grated cheese, garbanzos, pasta).
 * Garbanzos and pasta were first dropped in the FRESCO-1221 report as not comparable; FRESCO-1223 found the
 * cause (the catalog linked a prepared stew and a manufacturer brand), pinned both to the plain house-brand
 * product, and the report now counts them as comparable. Fewer products, never an unmeasured one: anything
 * outside this set shows no estimate. Keys are `normalizeNombre` forms of the shopping-list names.
 */
export const BASICOS_MARCA_PROPIA: ReadonlySet<string> = new Set(['leche', 'arroz', 'mantequilla', 'queso rallado', 'garbanzos', 'pasta']);

/** The five chains FRESCO-1221 measured. Lidl and Aldi are deliberately absent: no web price to measure against. */
export const CADENAS_ESTIMADAS: readonly { id: string, nombre: string }[] = [
  { id: 'dia', nombre: 'Dia' },
  { id: 'carrefour', nombre: 'Carrefour' },
  { id: 'eroski', nombre: 'Eroski' },
  { id: 'alcampo', nombre: 'Alcampo' },
  { id: 'ahorramas', nombre: 'Ahorramás' },
];

type Pasillos = readonly Pick<ShoppingListPasillo, 'nombre' | 'items'>[];

function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function precioValido(precio: number | undefined): precio is number {
  return precio !== undefined && Number.isFinite(precio) && precio > 0;
}

/** A linked price that may be shown as the chain's: a real linked product, priced, with a date that is neither missing nor too old. */
function precioEnlazadoVigente(linea: Pick<LineaCompra, 'precioEnlazado' | 'enlaces'>): { cadena: string, nombreCadena: string, precio: number } | undefined {
  const enlace = linea.enlaces[0];
  if (!enlace || !precioValido(linea.precioEnlazado)) { return undefined; }
  if (!precioCuentaComoVigente(enlace.antiguedadDias)) { return undefined; }
  return { cadena: enlace.cadena, nombreCadena: enlace.nombreCadena, precio: linea.precioEnlazado };
}

/**
 * The Mercadona price this row feeds the estimate, or `undefined`. `clave` is the MAPPED ingredient key (what the
 * catalog was matched on, e.g. "arroz redondo" after a recipe-context remap), not the name typed on the list.
 * Counts only a staple priced by the linked Mercadona product with a showable date: a price hidden for age or with
 * no date does not count, and neither does the stored per-gram estimate (`precioEnlazado` is absent then).
 */
export function precioBaseEstimacion({ clave, linea }: { clave: string, linea: Pick<LineaCompra, 'precioEnlazado' | 'enlaces'> }): number | undefined {
  if (!BASICOS_MARCA_PROPIA.has(normalizeNombre(clave))) { return undefined; }
  const vigente = precioEnlazadoVigente(linea);
  return vigente?.cadena === 'mercadona' ? vigente.precio : undefined;
}

export interface TotalComparado {
  cadena: string
  nombre: string
  importe: number
  /** Rows of the list this figure covers. */
  incluidos: number
  /** Rows in the list. */
  productos: number
  /** Estimated chains only: the names of the list rows the estimate covers, so the card can say which staples it is about. */
  basicos?: readonly string[]
}

function articulosDe(pasillos: Pasillos): number {
  return pasillos.reduce((n, p) => n + p.items.length, 0);
}

/** Estimated chains: Mercadona price of the staple rows times the factor. With no included row there is nothing to show. */
export function estimarCadenas({ pasillos, compra }: { pasillos: Pasillos, compra: CompraPorItem | undefined }): TotalComparado[] {
  let suma = 0;
  let incluidos = 0;
  const basicos: string[] = [];
  for (const pasillo of pasillos) {
    for (const item of pasillo.items) {
      const base = compra?.[claveItemCompra({ pasillo: pasillo.nombre, item: item.nombre })]?.precioBaseEstimacion;
      if (precioValido(base)) {
        suma += base;
        incluidos += 1;
        if (!basicos.includes(item.nombre)) { basicos.push(item.nombre); }
      }
    }
  }
  if (incluidos === 0) { return []; }
  const importe = redondear2(suma * FACTOR_ESTIMACION);
  const productos = articulosDe(pasillos);
  return CADENAS_ESTIMADAS.map(c => ({ cadena: c.id, nombre: c.nombre, importe, incluidos, productos, basicos }));
}

/**
 * Chains with real data (Mercadona, Consum): the sum of the rows each one priced through its own linked product,
 * to the cent, with the coverage so the figure never reads as a full basket. Same gate as the estimate base: a row
 * counts only with a priced linked product and a showable date (hidden for age or no date: not counted).
 */
export function totalesReales({ pasillos, compra }: { pasillos: Pasillos, compra: CompraPorItem | undefined }): TotalComparado[] {
  const porCadena = new Map<string, { nombre: string, suma: number, incluidos: number }>();
  for (const pasillo of pasillos) {
    for (const item of pasillo.items) {
      const linea = compra?.[claveItemCompra({ pasillo: pasillo.nombre, item: item.nombre })];
      const vigente = linea && precioEnlazadoVigente(linea);
      if (!vigente) { continue; }
      const acumulado = porCadena.get(vigente.cadena) ?? { nombre: vigente.nombreCadena, suma: 0, incluidos: 0 };
      acumulado.suma += vigente.precio;
      acumulado.incluidos += 1;
      porCadena.set(vigente.cadena, acumulado);
    }
  }
  const productos = articulosDe(pasillos);
  return [...porCadena.entries()]
    .map(([cadena, { nombre, suma, incluidos }]) => ({ cadena, nombre, importe: redondear2(suma), incluidos, productos }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
