import type { CadenaId, ZonaId } from './types';

/**
 * FRESCO-752 — selective refresh planning.
 *
 * Only the products users' menus actually need are refreshed, the most
 * demanded and most stale first, within a request budget per chain. Pure: it
 * decides WHAT to fetch; a runner (a GitHub Actions job, or a pg_cron plus
 * Edge Function per ADR-0011) does the fetching.
 */

export interface ProductoSeguido {
  cadena: CadenaId
  idExterno: string
  zona: ZonaId
  /** ISO instant of the last observed price, or `null` if never observed. */
  ultimaObservacion: string | null
  /** How many active menu slots need this product. Higher is refreshed first. */
  demanda: number
}

export interface PoliticaRefresco {
  /** A price older than this is stale. */
  maxEdadPrecioHoras: number
  /** Hard cap of requests per chain per run: small batches, never a bulk pull. */
  maxPeticionesPorCadena: number
  /** Pause between two requests to the same chain. */
  pausaEntrePeticionesMs: number
}

export interface PeticionRefresco {
  cadena: CadenaId
  idExterno: string
  zona: ZonaId
}

export interface PlanRefresco {
  porCadena: Record<CadenaId, PeticionRefresco[]>
  pausaEntrePeticionesMs: number
  /** Stale products left for a later run because the budget ran out. */
  aplazados: number
}

const MS_POR_HORA = 3_600_000;

interface PlanificarInput {
  productos: readonly ProductoSeguido[]
  ahora: Date
  politica: PoliticaRefresco
}

export function planificarRefresco(input: PlanificarInput): PlanRefresco {
  const { productos, ahora, politica } = input;
  const limite = ahora.getTime() - politica.maxEdadPrecioHoras * MS_POR_HORA;

  // Never observed counts as the oldest possible; an unparseable date is stale (fail-closed).
  const antiguedad = (p: ProductoSeguido): number => {
    if (p.ultimaObservacion === null) {
      return Number.NEGATIVE_INFINITY;
    }
    const instante = new Date(p.ultimaObservacion).getTime();
    return Number.isNaN(instante) ? Number.NEGATIVE_INFINITY : instante;
  };

  const caducados = productos
    .filter(p => p.demanda > 0 && antiguedad(p) < limite)
    .sort((a, b) =>
      b.demanda - a.demanda
      || antiguedad(a) - antiguedad(b)
      || a.cadena.localeCompare(b.cadena)
      || a.idExterno.localeCompare(b.idExterno),
    );

  const porCadena: Record<CadenaId, PeticionRefresco[]> = {};
  let aplazados = 0;
  for (const p of caducados) {
    const cola = (porCadena[p.cadena] ??= []);
    if (cola.length >= politica.maxPeticionesPorCadena) {
      aplazados++;
      continue;
    }
    cola.push({ cadena: p.cadena, idExterno: p.idExterno, zona: p.zona });
  }

  return { porCadena, pausaEntrePeticionesMs: politica.pausaEntrePeticionesMs, aplazados };
}
