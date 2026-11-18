import type { CompraPorItem, LineaCompra } from './compra';
import type { ShoppingListPasillo } from '@/lib/api/types';
import { normalizeNombre } from '@/lib/text/normalize-nombre';
import { claveItemCompra, frescuraPrecio } from './compra';

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
 * Closed set of staples the factor was measured on (milk, rice, butter, grated cheese). Garbanzos and pasta were
 * dropped in the report as not comparable (the catalog match may be a pricier product / another brand), so they
 * stay out: fewer products, never an unmeasured one. Keys are `normalizeNombre` forms of the shopping-list names.
 */
export const BASICOS_MARCA_PROPIA: ReadonlySet<string> = new Set(['leche', 'arroz', 'mantequilla', 'queso rallado']);

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

/**
 * The Mercadona price this row feeds the estimate, or `undefined`. Counts only a staple whose price comes from
 * the linked Mercadona product and is still showable: a price hidden for age (or with no date) does not count,
 * and neither does the stored per-gram estimate.
 */
export function precioBaseEstimacion({ nombre, linea }: { nombre: string, linea: Pick<LineaCompra, 'precio' | 'enlaces'> }): number | undefined {
  if (!BASICOS_MARCA_PROPIA.has(normalizeNombre(nombre))) { return undefined; }
  const enlace = linea.enlaces[0];
  if (!enlace || enlace.cadena !== 'mercadona') { return undefined; }
  const frescura = frescuraPrecio(enlace.antiguedadDias);
  if (frescura !== 'reciente' && frescura !== 'antiguo') { return undefined; }
  return precioValido(linea.precio) ? linea.precio : undefined;
}

export interface TotalComparado {
  cadena: string
  nombre: string
  importe: number
  /** Rows of the list this figure covers. */
  incluidos: number
  /** Rows in the list. */
  productos: number
}

function articulosDe(pasillos: Pasillos): number {
  return pasillos.reduce((n, p) => n + p.items.length, 0);
}

/** Estimated chains: Mercadona price of the staple rows times the factor. With no included row there is nothing to show. */
export function estimarCadenas({ pasillos, compra }: { pasillos: Pasillos, compra: CompraPorItem | undefined }): TotalComparado[] {
  let suma = 0;
  let incluidos = 0;
  for (const pasillo of pasillos) {
    for (const item of pasillo.items) {
      const base = compra?.[claveItemCompra({ pasillo: pasillo.nombre, item: item.nombre })]?.precioBaseEstimacion;
      if (precioValido(base)) {
        suma += base;
        incluidos += 1;
      }
    }
  }
  if (incluidos === 0) { return []; }
  const importe = redondear2(suma * FACTOR_ESTIMACION);
  const productos = articulosDe(pasillos);
  return CADENAS_ESTIMADAS.map(c => ({ cadena: c.id, nombre: c.nombre, importe, incluidos, productos }));
}

/**
 * Chains with real data (Mercadona, Consum): the sum of the rows each one priced through its own linked product,
 * to the cent, with the coverage so the figure never reads as a full basket. Rows whose price is hidden for age
 * are not counted, same rule as the list total.
 */
export function totalesReales({ pasillos, compra }: { pasillos: Pasillos, compra: CompraPorItem | undefined }): TotalComparado[] {
  const porCadena = new Map<string, { nombre: string, suma: number, incluidos: number }>();
  for (const pasillo of pasillos) {
    for (const item of pasillo.items) {
      const linea = compra?.[claveItemCompra({ pasillo: pasillo.nombre, item: item.nombre })];
      const enlace = linea?.enlaces[0];
      if (!linea || !enlace || frescuraPrecio(enlace.antiguedadDias) === 'oculto' || !precioValido(linea.precio)) { continue; }
      const acumulado = porCadena.get(enlace.cadena) ?? { nombre: enlace.nombreCadena, suma: 0, incluidos: 0 };
      acumulado.suma += linea.precio;
      acumulado.incluidos += 1;
      porCadena.set(enlace.cadena, acumulado);
    }
  }
  const productos = articulosDe(pasillos);
  return [...porCadena.entries()]
    .map(([cadena, { nombre, suma, incluidos }]) => ({ cadena, nombre, importe: redondear2(suma), incluidos, productos }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
