import type { ConnectorRegistry } from './connector';
import type { PlanRefresco } from './refresh-plan';
import type { CadenaId, ProductoSupermercado } from './types';
import { BloqueoError, LimiteDeTasaError, PermisoNoConcedidoError } from './connector';

/**
 * FRESCO-770 — the execution loop for a `PlanRefresco` (FRESCO-752). The plan
 * says WHAT to fetch; this runs it, one chain at a time, and reports.
 *
 * Pure: no clock, no network, no database. The runner injects how a product is
 * stored and how to wait, so every branch is testable with the fake connector.
 *
 * - Legal gate: connectors come from `registro.get`, which throws for a chain
 *   that may not run. That chain is skipped and never touched (fail-closed).
 * - `LimiteDeTasaError`: wait what the chain asked for, then retry the same
 *   request in a batch cut to half of what is left. A second rate limit on a
 *   batch of one gives up on that chain for this run.
 * - `BloqueoError`: the chain refused us. Stop that chain for the run, no retry.
 * - Anything else counts as a failure of that one request; the loop goes on.
 */

export type EstadoCadena
  = | 'completada'
    | 'cortada-por-bloqueo'
    | 'cortada-por-limite'
    | 'sin-permiso'
    | 'sin-conector';

export interface ResultadoCadena {
  cadena: CadenaId
  estado: EstadoCadena
  /** Products fetched and handed to `guardar`. */
  observaciones: number
  /** Requests the chain answered with no product. */
  sinDatos: number
  /** Requests that failed with an unexpected error (or whose `guardar` failed). */
  fallos: number
  /** Times the chain asked us to slow down. */
  esperasPorLimite: number
  /** Planned requests not made in this run. */
  aplazadas: number
}

export interface InformeRefresco {
  porCadena: ResultadoCadena[]
  /** Stale products the plan left for a later run (budget exhausted). */
  aplazadosPorPresupuesto: number
}

export interface DependenciasRefresco {
  registro: Pick<ConnectorRegistry, 'get'>
  guardar: (producto: ProductoSupermercado) => Promise<void>
  esperar: (ms: number) => Promise<void>
}

export async function ejecutarRefresco(
  plan: PlanRefresco,
  deps: DependenciasRefresco,
): Promise<InformeRefresco> {
  const porCadena: ResultadoCadena[] = [];
  for (const [cadena, peticiones] of Object.entries(plan.porCadena)) {
    porCadena.push(await refrescarCadena(cadena, peticiones, plan.pausaEntrePeticionesMs, deps));
  }
  return { porCadena, aplazadosPorPresupuesto: plan.aplazados };
}

async function refrescarCadena(
  cadena: CadenaId,
  peticiones: PlanRefresco['porCadena'][string],
  pausaMs: number,
  { registro, guardar, esperar }: DependenciasRefresco,
): Promise<ResultadoCadena> {
  const resultado: ResultadoCadena = {
    cadena,
    estado: 'completada',
    observaciones: 0,
    sinDatos: 0,
    fallos: 0,
    esperasPorLimite: 0,
    aplazadas: 0,
  };

  let conector: ReturnType<typeof registro.get>;
  try {
    conector = registro.get(cadena);
  }
  catch (error) {
    resultado.estado = error instanceof PermisoNoConcedidoError ? 'sin-permiso' : 'sin-conector';
    resultado.aplazadas = peticiones.length;
    return resultado;
  }

  let cola = [...peticiones];
  let i = 0;
  // The request that was retried after a rate limit, so a second limit on it
  // (with nothing smaller left to try) ends the chain instead of looping.
  let reintentada: string | null = null;
  while (i < cola.length) {
    const { idExterno, zona } = cola[i];
    try {
      const producto = await conector.obtenerProducto(idExterno, zona);
      if (producto === null) {
        resultado.sinDatos++;
      }
      else {
        await guardar(producto);
        resultado.observaciones++;
      }
    }
    catch (error) {
      if (error instanceof BloqueoError) {
        resultado.estado = 'cortada-por-bloqueo';
        resultado.aplazadas += cola.length - i;
        return resultado;
      }
      if (error instanceof LimiteDeTasaError) {
        resultado.esperasPorLimite++;
        const restantes = cola.slice(i);
        if (restantes.length === 1 && reintentada === idExterno) {
          resultado.estado = 'cortada-por-limite';
          resultado.aplazadas += 1;
          return resultado;
        }
        reintentada = idExterno;
        await esperar(error.reintentarEnMs);
        const lote = Math.ceil(restantes.length / 2);
        resultado.aplazadas += restantes.length - lote;
        cola = restantes.slice(0, lote);
        i = 0;
        continue;
      }
      resultado.fallos++;
    }
    i++;
    if (i < cola.length) {
      await esperar(pausaMs);
    }
  }
  return resultado;
}
