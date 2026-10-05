import type { CadenaId, ProductoSupermercado, ZonaId } from './types';

/**
 * FRESCO-752 — the interface every chain implements, and the registry that
 * decides which connectors may run.
 *
 * The registry is where the legal gate lives in code. A connector declares
 * its `permiso`, and only two states may run: `concedido` (written consent
 * from the chain) and `riesgo-aceptado` (no consent, risk accepted in an ADR).
 * Both must cite the document that justifies them in `permisoRef`.
 */

export type EstadoPermiso = 'concedido' | 'riesgo-aceptado' | 'pendiente' | 'rechazado';

export interface CapacidadesConector {
  buscar: boolean
  disponibilidad: boolean
}

export interface SupermarketConnector {
  readonly cadena: CadenaId
  /** The chain's display name, as the shopper reads it ("Mercadona"). Consumers print this, never a chain id. */
  readonly nombre: string
  readonly permiso: EstadoPermiso
  /** The ADR or tracker card that justifies `permiso`, e.g. `ADR-0028` or `FRESCO-532`. */
  readonly permisoRef: string
  readonly capacidades: CapacidadesConector
  /**
   * The id a product is stored under in the database, when the chain's own id
   * is not the catalog key (Mercadona: the id inside the product URL). Absent:
   * the catalog key is the id. `null`: the product cannot be stored, so it is
   * left out of the initial load.
   */
  readonly idParaCarga?: (producto: ProductoSupermercado) => string | null
  buscarProductos: (termino: string, zona: ZonaId) => Promise<ProductoSupermercado[]>
  obtenerProducto: (idExterno: string, zona: ZonaId) => Promise<ProductoSupermercado | null>
}

/** The chain asked us to slow down. Callers wait `reintentarEnMs` and use a smaller batch. */
export class LimiteDeTasaError extends Error {
  readonly reintentarEnMs: number;

  constructor(cadena: CadenaId, reintentarEnMs: number) {
    super(`${cadena} rate-limited the connector; retry in ${reintentarEnMs} ms`);
    this.name = 'LimiteDeTasaError';
    this.reintentarEnMs = reintentarEnMs;
  }
}

/** The chain refused the connector (403 or a challenge). Not retried: the circuit for that chain opens. */
export class BloqueoError extends Error {
  constructor(cadena: CadenaId) {
    super(`${cadena} blocked the connector`);
    this.name = 'BloqueoError';
  }
}

/** A connector without a runnable permission was asked to run. */
export class PermisoNoConcedidoError extends Error {
  constructor(cadena: CadenaId, permiso: string) {
    super(`${cadena} cannot run: permission is "${permiso}", not a runnable state with a cited reference`);
    this.name = 'PermisoNoConcedidoError';
  }
}

/**
 * Fail-closed: anything that is not exactly a runnable state backed by a
 * non-empty reference counts as not permitted, including an unexpected value.
 */
export function puedeEjecutarse(connector: Pick<SupermarketConnector, 'permiso' | 'permisoRef'>): boolean {
  const estadoValido = connector.permiso === 'concedido' || connector.permiso === 'riesgo-aceptado';
  return estadoValido && connector.permisoRef.trim().length > 0;
}

export interface EstadoConector {
  cadena: CadenaId
  permiso: EstadoPermiso
  permisoRef: string
  ejecutable: boolean
}

export interface ConnectorRegistry {
  /** The connector for `cadena`. Throws `PermisoNoConcedidoError` unless it may run. */
  get: (cadena: CadenaId) => SupermarketConnector
  /** Only the connectors that may run. */
  activos: () => SupermarketConnector[]
  /** Every registered connector with its state, for reports and dashboards. */
  estado: () => EstadoConector[]
}

export function crearRegistro(connectors: readonly SupermarketConnector[]): ConnectorRegistry {
  const porCadena = new Map<CadenaId, SupermarketConnector>();
  for (const connector of connectors) {
    if (porCadena.has(connector.cadena)) {
      throw new Error(`Duplicate connector for chain "${connector.cadena}"`);
    }
    porCadena.set(connector.cadena, connector);
  }

  return {
    get(cadena) {
      const connector = porCadena.get(cadena);
      if (!connector) {
        throw new Error(`No connector registered for chain "${cadena}"`);
      }
      if (!puedeEjecutarse(connector)) {
        throw new PermisoNoConcedidoError(cadena, connector.permiso);
      }
      return connector;
    },
    activos() {
      return [...porCadena.values()].filter(puedeEjecutarse);
    },
    estado() {
      return [...porCadena.values()].map(connector => ({
        cadena: connector.cadena,
        permiso: connector.permiso,
        permisoRef: connector.permisoRef,
        ejecutable: puedeEjecutarse(connector),
      }));
    },
  };
}
