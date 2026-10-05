import type { SupermarketConnector } from '../lib/grocery/supermarket/connector.ts';
import type { Db } from '../lib/grocery/supermarket/price-store.ts';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { crearRegistro } from '../lib/grocery/supermarket/connector.ts';
import { crearConectorFalso } from '../lib/grocery/supermarket/fake-connector.ts';
import { ejecutar, leerOpciones } from './refresh-supermarket-prices.ts';

// FRESCO-801 — the runner holds the service-role key and `--apply` writes to the
// shared database, so the property worth pinning is what a dry run does NOT do.

type Fila = Record<string, unknown>;

interface Tablas {
  cadenas: string[]
  demanda: { ingrediente: string, huecos: number }[]
  coincidencias: { ingrediente: string, producto_id: number }[]
  productos: { id: number, cadena: string, id_externo: string }[]
  precios: { producto_id: number, observado_en: string }[]
}

const AHORA = new Date('2026-10-05T10:00:00.000Z');
const CADENA = 'tiendafalsa';

/**
 * A stand-in for the Supabase client: it answers the reads `price-store` makes
 * and records every table or RPC touched. Any write method throws, so a dry run
 * that tried to write would fail the test instead of passing silently.
 */
function dbFalsa(tablas: Tablas): { db: Db, lecturas: string[] } {
  const lecturas: string[] = [];
  const filas = (nombre: string): Fila[] => {
    if (nombre === 'supermarket_chain') { return tablas.cadenas.map(slug => ({ slug })); }
    if (nombre === 'get_supermarket_demand') { return tablas.demanda; }
    if (nombre === 'ingredient_product_match') { return tablas.coincidencias; }
    if (nombre === 'supermarket_product') { return tablas.productos; }
    if (nombre === 'supermarket_price') { return tablas.precios; }
    throw new Error(`unexpected read of ${nombre}`);
  };
  const consulta = (nombre: string): unknown => {
    lecturas.push(nombre);
    const resultado = { data: filas(nombre), error: null };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      range: async () => Promise.resolve(resultado),
      then: async (resolver: (valor: typeof resultado) => unknown) => Promise.resolve(resultado).then(resolver),
      insert: () => { throw new Error(`dry run wrote to ${nombre} (insert)`); },
      upsert: () => { throw new Error(`dry run wrote to ${nombre} (upsert)`); },
      update: () => { throw new Error(`dry run wrote to ${nombre} (update)`); },
      delete: () => { throw new Error(`dry run wrote to ${nombre} (delete)`); },
    };
    return builder;
  };
  const db = { from: consulta, rpc: consulta } as unknown as Db;
  return { db, lecturas };
}

function conectorEspiado(opciones: Parameters<typeof crearConectorFalso>[0] = {}): { conector: SupermarketConnector, contactos: () => number } {
  const conector = crearConectorFalso({ cadena: CADENA, ...opciones });
  let contactos = 0;
  const original = conector.obtenerProducto;
  const buscar = conector.buscarProductos;
  return {
    conector: {
      ...conector,
      obtenerProducto: async (...args) => { contactos++; return original(...args); },
      buscarProductos: async (...args) => { contactos++; return buscar(...args); },
    },
    contactos: () => contactos,
  };
}

const TABLAS: Tablas = {
  cadenas: [CADENA],
  demanda: [{ ingrediente: 'arroz', huecos: 3 }],
  coincidencias: [{ ingrediente: 'arroz', producto_id: 1 }],
  productos: [{ id: 1, cadena: CADENA, id_externo: 'p-001' }],
  precios: [],
};

function deps(tablas: Tablas, conector: SupermarketConnector) {
  const { db, lecturas } = dbFalsa(tablas);
  const registro = crearRegistro([conector]);
  return {
    lecturas,
    deps: {
      db,
      registroEnVivo: registro,
      registroCatalogos: registro,
      ahora: () => AHORA,
      esperar: async () => {},
    },
  };
}

describe('leerOpciones', () => {
  test('defaults to a dry run with the documented budget', () => {
    expect(leerOpciones([])).toEqual({ apply: false, cargarCatalogos: false, maxPeticiones: 30, maxEdadHoras: 168, pausaMs: 3000 });
  });

  test('parses flags and numeric options', () => {
    expect(leerOpciones(['--apply', '--max-peticiones=5', '--pausa-ms=0'])).toMatchObject({ apply: true, maxPeticiones: 5, pausaMs: 0 });
  });

  test('rejects an unknown or malformed option instead of ignoring it', () => {
    expect(() => leerOpciones(['--aply'])).toThrow('unknown or malformed option');
    expect(() => leerOpciones(['--max-peticiones=abc'])).toThrow('unknown or malformed option');
  });
});

describe('ejecutar, dry run', () => {
  let log: ReturnType<typeof spyOn>;
  let warn: ReturnType<typeof spyOn>;
  beforeEach(() => {
    log = spyOn(console, 'log').mockImplementation(() => {});
    warn = spyOn(console, 'warn').mockImplementation(() => {});
  });
  // bun runs every test file in one process: a spy left behind breaks other files' console assertions.
  afterEach(() => {
    log.mockRestore();
    warn.mockRestore();
  });

  test('prints the plan, writes nothing and contacts no chain', async () => {
    const { conector, contactos } = conectorEspiado();
    const { deps: d, lecturas } = deps(TABLAS, conector);

    await ejecutar(leerOpciones([]), d);

    const salida = log.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(salida).toContain(`plan ${CADENA}: 1 requests`);
    expect(salida).toContain('tracked products with demand: 1');
    expect(salida).toContain('dry run: no chain contacted, nothing written');
    expect(contactos()).toBe(0);
    expect(lecturas).toContain('get_supermarket_demand');
  });

  test('plans nothing when the chain is enabled in the database but has no connector in the code', async () => {
    const { conector, contactos } = conectorEspiado({ cadena: 'otra' });
    const { deps: d, lecturas } = deps(TABLAS, conector);

    await ejecutar(leerOpciones([]), d);

    const salida = log.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(salida).toContain('no chain is both enabled and runnable: nothing to do');
    expect(lecturas).not.toContain('get_supermarket_demand');
    expect(contactos()).toBe(0);
  });

  test('plans nothing when the connector exists in code but the chain is not enabled in the database', async () => {
    const { conector } = conectorEspiado();
    const { deps: d } = deps({ ...TABLAS, cadenas: [] }, conector);

    await ejecutar(leerOpciones([]), d);

    const salida = log.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(salida).toContain('no chain is both enabled and runnable: nothing to do');
  });

  test('an initial-load dry run counts the catalog products and writes nothing', async () => {
    const { conector } = conectorEspiado();
    const { deps: d } = deps(TABLAS, conector);

    await ejecutar(leerOpciones(['--cargar-catalogos']), d);

    const salida = log.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(salida).toContain('initial load:');
    expect(salida).toContain('dry run: nothing written (pass --apply)');
  });
});
