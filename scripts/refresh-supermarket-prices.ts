#!/usr/bin/env bun

// FRESCO-770 — runner for the supermarket price refresh (ADR-0036, design
// `.context/design/supermarket-data-layer.md` §6). GitHub Actions runs it
// (`.github/workflows/refresh-supermarket-prices.yml`), so it can reuse
// `lib/grocery/supermarket` as is.
//
// Usage:
//   bun scripts/refresh-supermarket-prices.ts                      # dry run: print the plan
//   bun scripts/refresh-supermarket-prices.ts --apply              # run it and write
//   bun scripts/refresh-supermarket-prices.ts --cargar-catalogos   # dry run of the initial load
//   bun scripts/refresh-supermarket-prices.ts --cargar-catalogos --apply
//
// Options: --max-peticiones=30 (per chain, per run), --max-edad-horas=168,
// --pausa-ms=3000. Env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (never
// printed). Without --apply nothing is written and no chain is contacted.
//
// The legal gate applies twice: a chain is only planned if it is `habilitada`
// in the database AND has a runnable connector in the code, and the loop then
// asks the registry again for every chain (`ejecutarRefresco`).
//
// Two registries, on purpose. The app's `registroSupermercados` holds the
// static connectors that read the committed catalogs; it is bundled into the
// browser and cannot do I/O. The refresh uses its own, built here from the
// live connectors. Today that is Mercadona, read from the community dataset
// `datania/mercadona-catalog` (FRESCO-771, ADR-0028: no request to Mercadona,
// prices at most a week old). Consum has none yet (FRESCO-772), so it is not
// planned.

import type { Database } from '../lib/supabase/types.ts';
import { createClient } from '@supabase/supabase-js';
import { productosParaCarga } from '../lib/grocery/supermarket/catalog-connectors.ts';
import { crearRegistro } from '../lib/grocery/supermarket/connector.ts';
import { crearConectorMercadonaDataset } from '../lib/grocery/supermarket/mercadona-dataset.ts';
import {
  cargarProductos,
  guardarObservacion,
  leerCadenasHabilitadas,
  leerDemandaDeMenu,
  leerProductosSeguidos,
  ZONA_BD,
} from '../lib/grocery/supermarket/price-store.ts';
import { planificarRefresco } from '../lib/grocery/supermarket/refresh-plan.ts';
import { ejecutarRefresco } from '../lib/grocery/supermarket/refresh-run.ts';
import { registroSupermercados } from '../lib/grocery/supermarket/registry.ts';
import { DATASET_API, datasetAgeDays, isStale, MAX_AGE_DAYS } from './check-mercadona-dataset-freshness.ts';
import { loadCatalog } from './gen-mercadona-catalog.ts';

interface Opciones {
  apply: boolean
  cargarCatalogos: boolean
  maxPeticiones: number
  maxEdadHoras: number
  pausaMs: number
}

const USO = 'usage: bun scripts/refresh-supermarket-prices.ts [--apply] [--cargar-catalogos] [--max-peticiones=N] [--max-edad-horas=N] [--pausa-ms=N]';
const DIAS_HACIA_ATRAS = 7;

function leerOpciones(argv: readonly string[]): Opciones {
  const opciones: Opciones = { apply: false, cargarCatalogos: false, maxPeticiones: 30, maxEdadHoras: 168, pausaMs: 3000 };
  const numeros: Record<string, 'maxPeticiones' | 'maxEdadHoras' | 'pausaMs'> = {
    '--max-peticiones': 'maxPeticiones',
    '--max-edad-horas': 'maxEdadHoras',
    '--pausa-ms': 'pausaMs',
  };
  for (const arg of argv) {
    const [nombre, valor] = arg.split('=');
    if (arg === '--apply') { opciones.apply = true; }
    else if (arg === '--cargar-catalogos') { opciones.cargarCatalogos = true; }
    else if (numeros[nombre] && /^\d+$/.test(valor ?? '')) { opciones[numeros[nombre]] = Number(valor); }
    else { throw new Error(`unknown or malformed option "${arg}"\n${USO}`); }
  }
  return opciones;
}

/** When the dataset snapshot was published. Fail-closed: a stalled dataset refreshes nothing. */
async function fechaSnapshotMercadona(): Promise<string> {
  const res = await fetch(DATASET_API);
  if (!res.ok) {
    throw new Error(`could not read the Mercadona dataset metadata (${res.status})`);
  }
  const { lastModified } = await res.json() as { lastModified: string };
  const edad = datasetAgeDays(lastModified, new Date());
  if (isStale(edad)) {
    throw new Error(`the Mercadona dataset was last updated ${lastModified} (${edad} days ago, limit ${MAX_AGE_DAYS}): not refreshing from it`);
  }
  return lastModified;
}

const registroEnVivo = crearRegistro([
  crearConectorMercadonaDataset({ cargarCatalogo: loadCatalog, fechaSnapshot: fechaSnapshotMercadona }),
]);

async function main(): Promise<void> {
  const opciones = leerOpciones(process.argv.slice(2));
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(2);
  }
  const db = createClient<Database>(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });

  const habilitadas = await leerCadenasHabilitadas(db);
  // The initial load reads the committed catalogs (static connectors); the
  // refresh needs a live connector.
  const registro = opciones.cargarCatalogos ? registroSupermercados : registroEnVivo;
  const enCodigo = new Set(registro.activos().map(c => c.cadena));
  const ejecutables = new Set([...habilitadas].filter(c => enCodigo.has(c)));
  console.log(`chains enabled in the database: ${[...habilitadas].sort().join(', ') || '(none)'}`);
  console.log(`chains runnable in the code:    ${[...enCodigo].sort().join(', ') || '(none)'}`);
  const desalineadas = [...new Set([...habilitadas, ...enCodigo])].filter(c => !ejecutables.has(c));
  if (desalineadas.length > 0) {
    console.warn(`::warning::not planned, enabled in only one place: ${desalineadas.sort().join(', ')}`);
  }
  if (ejecutables.size === 0) {
    console.log('no chain is both enabled and runnable: nothing to do');
    return;
  }

  if (opciones.cargarCatalogos) {
    const productos = [...ejecutables].flatMap(c => productosParaCarga(c));
    console.log(`initial load: ${productos.length} products from the committed catalogs of ${[...ejecutables].sort().join(', ')}`);
    if (!opciones.apply) {
      console.log('dry run: nothing written (pass --apply)');
      return;
    }
    const resultado = await cargarProductos(db, { items: productos, zona: ZONA_BD });
    console.log(`loaded ${resultado.productos} products, skipped ${resultado.omitidos} with an unusable price`);
    return;
  }

  const desde = new Date(Date.now() - DIAS_HACIA_ATRAS * 86_400_000).toISOString().slice(0, 10);
  const demanda = await leerDemandaDeMenu(db, desde);
  const seguidos = await leerProductosSeguidos(db, { demandaPorIngrediente: demanda, habilitadas: ejecutables, zona: ZONA_BD });
  const plan = planificarRefresco({
    productos: seguidos,
    ahora: new Date(),
    politica: {
      maxEdadPrecioHoras: opciones.maxEdadHoras,
      maxPeticionesPorCadena: opciones.maxPeticiones,
      pausaEntrePeticionesMs: opciones.pausaMs,
    },
  });
  for (const [cadena, peticiones] of Object.entries(plan.porCadena)) {
    console.log(`plan ${cadena}: ${peticiones.length} requests`);
  }
  console.log(`tracked products with demand: ${seguidos.length}, deferred by budget: ${plan.aplazados}`);
  if (!opciones.apply) {
    console.log('dry run: no chain contacted, nothing written (pass --apply)');
    return;
  }

  const informe = await ejecutarRefresco(plan, {
    registro: registroEnVivo,
    guardar: async (producto) => { await guardarObservacion(db, producto); },
    esperar: async ms => Bun.sleep(ms),
  });
  for (const r of informe.porCadena) {
    console.log(`${r.cadena}: ${r.estado}, ${r.observaciones} stored, ${r.sinDatos} without data, ${r.fallos} failed, ${r.esperasPorLimite} rate limits, ${r.aplazadas} deferred`);
    if (r.estado === 'cortada-por-bloqueo') {
      console.warn(`::warning::${r.cadena} blocked the runner; its circuit is open for this run`);
    }
  }
}

await main();
