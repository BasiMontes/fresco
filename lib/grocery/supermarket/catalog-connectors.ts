import type { MercadonaMatch } from '../mercadona-catalog.generated';
import type { SupermarketConnector } from './connector';
import type { Envase, ProductoSupermercado, UnidadBase, ZonaId } from './types';
import { normalizeNombre } from '@/lib/text/normalize-nombre';
import { CONSUM_CATALOG_MATCH } from '../consum-catalog.generated';
import { MERCADONA_CATALOG_MATCH } from '../mercadona-catalog.generated';
import { puedeEjecutarse } from './connector';
import { parseFormatoReferencia, precioEnvaseDesdeReferencia } from './units';

/**
 * FRESCO-767 — the two generated catalogs (Mercadona FRESCO-503/762, Consum
 * FRESCO-520) wrapped as `SupermarketConnector`s. Step 1 of the migration in
 * `.context/design/supermarket-data-layer.md` §8: nothing reads these yet, so
 * there is no user-visible change. No network: they only read the committed
 * generated files.
 *
 * - `idExterno` is the catalog key (the canonical ingredient), because the
 *   generated files carry no product id of their own.
 * - One fixed zone: the catalogs are not priced per store.
 * - The catalogs carry no observation date, so `observadoEn` is the Unix
 *   epoch, which the refresh plan reads as stale. That is the honest value.
 */

export const ZONA_CATALOGO: ZonaId = 'catalogo';
const OBSERVADO_EN_DESCONOCIDO = '1970-01-01T00:00:00.000Z';

const UNIDADES_BASE: readonly UnidadBase[] = ['g', 'ml', 'unidad'];

interface EntradaCatalogo {
  clave: string
  envaseVenta: { cantidad: number, unidad: string }
  precioEnvase: number
  url: string
}

function envaseDe(envaseVenta: EntradaCatalogo['envaseVenta']): Envase | null {
  const unidad = UNIDADES_BASE.find(u => u === envaseVenta.unidad);
  return unidad ? { cantidad: envaseVenta.cantidad, unidad } : null;
}

function aProducto(cadena: string, entrada: EntradaCatalogo): ProductoSupermercado | null {
  const envase = envaseDe(entrada.envaseVenta);
  if (!envase || !(entrada.precioEnvase > 0)) {
    return null;
  }
  return {
    cadena,
    idExterno: entrada.clave,
    nombre: entrada.clave,
    marca: null,
    envase,
    precioEnvase: entrada.precioEnvase,
    url: entrada.url,
    disponible: true,
    zona: ZONA_CATALOGO,
    observadoEn: OBSERVADO_EN_DESCONOCIDO,
  };
}

/** `termino` matches a key that equals it or has it at the start of any word. */
function coincide(clave: string, termino: string): boolean {
  return ` ${clave}`.includes(` ${termino}`);
}

/**
 * The catalog a connector serves, kept per connector instead of in a global
 * map by chain id: the only way to read it is through the gated functions
 * below, which check the connector's permission every time.
 */
const CATALOGOS = new WeakMap<SupermarketConnector, ReadonlyMap<string, ProductoSupermercado>>();

function catalogoEjecutable(conector: SupermarketConnector): ReadonlyMap<string, ProductoSupermercado> | null {
  return puedeEjecutarse(conector) ? (CATALOGOS.get(conector) ?? null) : null;
}

/**
 * Synchronous read of the same catalog a connector serves (FRESCO-768):
 * `mapShoppingListItem` is pure and sync, the connector methods are async.
 * FRESCO-808: gated. A connector that may not run returns `null`, the same as
 * a product the catalog does not hold.
 */
export function productoDeCatalogo(conector: SupermarketConnector, clave: string): ProductoSupermercado | null {
  return catalogoEjecutable(conector)?.get(clave) ?? null;
}

/** Every product of a connector's committed catalog (FRESCO-770). Gated like `productoDeCatalogo`: `[]` if the connector may not run. */
function productosDeCatalogo(conector: SupermarketConnector): ProductoSupermercado[] {
  return [...(catalogoEjecutable(conector)?.values() ?? [])];
}

/** Mercadona's own product id, from its product URL (`.../product/4640/aceite-...`). Some ids have a decimal part (`81649.1`). */
export function idMercadonaDeUrl(url: string | null): string | null {
  return url?.match(/\/product\/(\d+(?:\.\d+)?)(?:\/|$)/)?.[1] ?? null;
}

/** A catalog product together with the ingredient it is matched to (`ingredient_product_match`). */
export interface ProductoParaCarga {
  ingrediente: string
  producto: ProductoSupermercado
}

/**
 * The committed catalog of a connector as rows for the initial load into the
 * database (FRESCO-770, FRESCO-771). The connector decides which id a product
 * is stored under (`idParaCarga`: Mercadona's own id, taken from the product
 * URL, so the live connector can look it up) and whether it can be stored at
 * all. Two ingredients may share one product, hence a list of pairs rather than
 * a map. Gated: `[]` if the connector may not run.
 */
export function productosParaCarga(conector: SupermarketConnector): ProductoParaCarga[] {
  return productosDeCatalogo(conector).flatMap((producto) => {
    if (!conector.idParaCarga) {
      return [{ ingrediente: producto.idExterno, producto }];
    }
    const id = conector.idParaCarga(producto);
    return id === null ? [] : [{ ingrediente: producto.idExterno, producto: { ...producto, idExterno: id } }];
  });
}

export function crearConectorDeCatalogo(
  base: Pick<SupermarketConnector, 'cadena' | 'nombre' | 'permiso' | 'permisoRef' | 'idParaCarga'>,
  entradas: readonly EntradaCatalogo[],
): SupermarketConnector {
  const productos = entradas
    .map(entrada => aProducto(base.cadena, entrada))
    .filter((p): p is ProductoSupermercado => p !== null)
    .sort((a, b) => a.idExterno.localeCompare(b.idExterno));
  const porId = new Map(productos.map(p => [p.idExterno, p]));

  const conector: SupermarketConnector = {
    ...base,
    capacidades: { buscar: true, disponibilidad: false },
    // Fail-closed on every read path, not only through the registry: a
    // connector that may not run serves nothing, even when called directly.
    async buscarProductos(termino, zona) {
      const aguja = normalizeNombre(termino);
      if (!puedeEjecutarse(base) || zona !== ZONA_CATALOGO || aguja === '') {
        return [];
      }
      return productos.filter(p => coincide(p.idExterno, aguja));
    },
    async obtenerProducto(idExterno, zona) {
      return puedeEjecutarse(base) && zona === ZONA_CATALOGO ? (porId.get(idExterno) ?? null) : null;
    },
  };
  CATALOGOS.set(conector, porId);
  return conector;
}

/**
 * Mercadona prints a price per reference unit. The connector converts it to
 * the price of the whole pack. A count reference ("ud") means the price IS for
 * one whole pack, whatever its weight (ready-to-eat lentils: 4 EUR per 485 g
 * bowl), so it is multiplied by its quantity, exactly like `packPrice` does.
 */
export function precioEnvaseMercadona(match: Pick<MercadonaMatch, 'envaseVenta' | 'precioMercadona'>): number {
  const { precioReferencia, formatoReferencia } = match.precioMercadona;
  const referencia = parseFormatoReferencia(formatoReferencia);
  if (referencia.unidad === 'ud') {
    return precioReferencia * referencia.cantidad;
  }
  const envase = envaseDe(match.envaseVenta);
  const precio = envase
    ? precioEnvaseDesdeReferencia({ precioReferencia, referencia, envase })
    : null;
  return precio ?? 0;
}

/**
 * The legal state of each chain, declared once. Every connector of a chain
 * spreads its entry from here so they cannot drift, and
 * `tests/db/supermarket-price-model.test.ts` fails if the `supermarket_chain`
 * seed disagrees (FRESCO-808: one source of truth in code, one guard on the
 * database copy the RLS gate needs).
 */
export const PERMISOS_CADENA = {
  mercadona: { permiso: 'riesgo-aceptado', permisoRef: 'ADR-0028' },
  consum: { permiso: 'riesgo-aceptado', permisoRef: 'ADR-0037' },
} as const satisfies Record<string, Pick<SupermarketConnector, 'permiso' | 'permisoRef'>>;

export const conectorMercadona = crearConectorDeCatalogo(
  {
    cadena: 'mercadona',
    nombre: 'Mercadona',
    ...PERMISOS_CADENA.mercadona,
    // The generated catalog carries no product id; Mercadona's own sits in the product URL.
    idParaCarga: producto => idMercadonaDeUrl(producto.url),
  },
  Object.entries(MERCADONA_CATALOG_MATCH).map(([clave, match]) => ({
    clave,
    envaseVenta: match.envaseVenta,
    precioEnvase: precioEnvaseMercadona(match),
    url: match.shareUrl,
  })),
);

/** Consum prices the whole pack already, so `precio` passes through. */
export const conectorConsum = crearConectorDeCatalogo(
  { cadena: 'consum', nombre: 'Consum', ...PERMISOS_CADENA.consum },
  Object.entries(CONSUM_CATALOG_MATCH).map(([clave, match]) => ({
    clave,
    envaseVenta: match.envaseVenta,
    precioEnvase: match.precioConsum.precio,
    url: match.url,
  })),
);
