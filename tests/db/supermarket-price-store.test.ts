/**
 * FRESCO-770 — proves the refresh runner's database side against the real
 * database: the initial load, the write decision, what the plan is allowed to
 * track, and the whole loop end to end with a fake connector.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. Uses a `service_role` client, like the runner does.
 */

import type { ProductoParaCarga } from '../../lib/grocery/supermarket/catalog-connectors';
import type { ProductoSupermercado } from '../../lib/grocery/supermarket/types';
import type { Database } from '../../lib/supabase/types';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { crearRegistro } from '../../lib/grocery/supermarket/connector';
import { crearConectorFalso } from '../../lib/grocery/supermarket/fake-connector';
import {
  cargarProductos,
  guardarObservacion,
  leerCadenasHabilitadas,
  leerProductosSeguidos,
  ZONA_BD,
} from '../../lib/grocery/supermarket/price-store';
import { planificarRefresco } from '../../lib/grocery/supermarket/refresh-plan';
import { ejecutarRefresco } from '../../lib/grocery/supermarket/refresh-run';
import { nativeFetch, resolveUrl, serviceRoleKey, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const PREFIX = 'it-770b-';
const DESCONOCIDO = '1970-01-01T00:00:00.000Z';

function producto(idExterno: string, extra: Partial<ProductoSupermercado> = {}): ProductoSupermercado {
  return {
    cadena: 'mercadona',
    idExterno: `${PREFIX}${idExterno}`,
    nombre: `Producto ${idExterno}`,
    marca: null,
    envase: { cantidad: 500, unidad: 'g' as const },
    precioEnvase: 2.5,
    url: `https://tienda.example/${idExterno}`,
    disponible: true,
    zona: 'catalogo',
    observadoEn: DESCONOCIDO,
    ...extra,
  };
}

/** A catalog entry for the initial load: the product, matched to the ingredient it is named after. */
function carga(idExterno: string, extra: Partial<ProductoSupermercado> = {}, ingrediente = `${PREFIX}${idExterno}`): ProductoParaCarga {
  return { ingrediente, producto: producto(idExterno, extra) };
}

describe.skipIf(!(RUN && reachable))('supermarket price store (real DB)', () => {
  let db: ReturnType<typeof createClient<Database>>;

  async function precioActual(idExterno: string) {
    const { data: p } = await db.from('supermarket_product').select('id').eq('cadena', 'mercadona').eq('id_externo', `${PREFIX}${idExterno}`).single();
    const { data: precio } = await db.from('supermarket_price').select('precio_envase, disponible, observado_en').eq('producto_id', p!.id).eq('zona', ZONA_BD).maybeSingle();
    const { count } = await db.from('supermarket_price_history').select('*', { count: 'exact', head: true }).eq('producto_id', p!.id);
    return { precio, historial: count ?? 0 };
  }

  beforeAll(async () => {
    db = createClient<Database>(resolveUrl(), await serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: nativeFetch },
    });
  });

  afterAll(async () => {
    // Cascades to supermarket_price, supermarket_price_history and ingredient_product_match.
    await db.from('supermarket_product').delete().like('id_externo', `${PREFIX}%`);
  });

  test('only the chains switched on in the database are enabled', async () => {
    const habilitadas = await leerCadenasHabilitadas(db);
    expect([...habilitadas].sort()).toEqual(['consum', 'mercadona']);
  });

  describe('initial load', () => {
    test('stores products, one match each and an unknown-date price, in the default zone', async () => {
      const resultado = await cargarProductos(db, [carga('a'), carga('b')]);
      expect(resultado).toEqual({ productos: 2, omitidos: 0 });

      const { precio, historial } = await precioActual('a');
      expect(precio).toMatchObject({ precio_envase: 2.5, disponible: true });
      expect(new Date(precio!.observado_en).getTime()).toBe(0);
      expect(historial).toBe(0);

      const { data: coincidencias } = await db.from('ingredient_product_match').select('ingrediente, confianza').eq('ingrediente', `${PREFIX}a`);
      expect(coincidencias).toEqual([{ ingrediente: `${PREFIX}a`, confianza: 'alta' }]);
    });

    test('is idempotent: running it twice leaves one row per product', async () => {
      await cargarProductos(db, [carga('a'), carga('b')]);
      const { count } = await db.from('supermarket_product').select('*', { count: 'exact', head: true }).like('id_externo', `${PREFIX}%`);
      expect(count).toBe(2);
    });

    test('two ingredients that share one product give one product and a match each', async () => {
      const resultado = await cargarProductos(db, [
        carga('compartido', {}, `${PREFIX}aceite`),
        carga('compartido', {}, `${PREFIX}aceite de oliva`),
      ]);
      expect(resultado).toEqual({ productos: 1, omitidos: 0 });

      const { count } = await db.from('supermarket_product').select('*', { count: 'exact', head: true }).eq('id_externo', `${PREFIX}compartido`);
      expect(count).toBe(1);
      const { data: coincidencias } = await db.from('ingredient_product_match').select('ingrediente').like('ingrediente', `${PREFIX}aceite%`).order('ingrediente');
      expect(coincidencias?.map(c => c.ingrediente)).toEqual([`${PREFIX}aceite`, `${PREFIX}aceite de oliva`]);
    });

    test('skips a price that does not survive numeric(10, 2) above zero', async () => {
      const resultado = await cargarProductos(db, [carga('barato', { precioEnvase: 0.004 })]);
      expect(resultado).toEqual({ productos: 0, omitidos: 1 });
    });
  });

  describe('guardarObservacion', () => {
    const ahora = '2026-10-01T12:00:00.000Z';

    test('the same price, newer: only the date moves, no history row', async () => {
      const decision = await guardarObservacion(db, producto('a', { zona: ZONA_BD, observadoEn: ahora }));
      expect(decision).toBe('actualizar');
      const { precio, historial } = await precioActual('a');
      expect(new Date(precio!.observado_en).toISOString()).toBe(ahora);
      expect(historial).toBe(0);
    });

    test('a changed price: the current price updates and the history gets a row', async () => {
      const decision = await guardarObservacion(db, producto('a', { zona: ZONA_BD, observadoEn: '2026-10-02T12:00:00.000Z', precioEnvase: 3 }));
      expect(decision).toBe('actualizar-con-historial');
      const { precio, historial } = await precioActual('a');
      expect(precio?.precio_envase).toBe(3);
      expect(historial).toBe(1);
    });

    test('an older observation is ignored', async () => {
      const decision = await guardarObservacion(db, producto('a', { zona: ZONA_BD, observadoEn: '2026-09-01T12:00:00.000Z', precioEnvase: 9 }));
      expect(decision).toBe('ignorar');
      expect((await precioActual('a')).precio?.precio_envase).toBe(3);
    });

    test('re-running the initial load never overwrites a newer observation', async () => {
      await cargarProductos(db, [carga('a')]);
      const { precio } = await precioActual('a');
      expect(precio?.precio_envase).toBe(3);
      expect(new Date(precio!.observado_en).toISOString()).toBe('2026-10-02T12:00:00.000Z');
    });

    test('a product the database does not track is an error', async () => {
      await expect(guardarObservacion(db, producto('no-existe', { zona: ZONA_BD, observadoEn: ahora }))).rejects.toThrow('not tracked');
    });
  });

  describe('leerProductosSeguidos', () => {
    test('tracks only products of an enabled chain that a menu needs', async () => {
      const demanda = new Map([[`${PREFIX}a`, 3]]);
      const seguidos = await leerProductosSeguidos(db, demanda, new Set(['mercadona']));
      const propios = seguidos.filter(s => s.idExterno.startsWith(PREFIX));
      expect(propios.map(s => s.idExterno)).toEqual([`${PREFIX}a`]);
      expect(propios[0]).toMatchObject({ cadena: 'mercadona', zona: ZONA_BD, demanda: 3 });
      expect(propios[0].ultimaObservacion).not.toBeNull();
    });

    test('a chain that is not enabled is never tracked, whatever the demand', async () => {
      const demanda = new Map([[`${PREFIX}a`, 3]]);
      expect(await leerProductosSeguidos(db, demanda, new Set(['consum']))).toEqual([]);
      expect(await leerProductosSeguidos(db, demanda, new Set())).toEqual([]);
    });

    test('with no demand there is nothing to track', async () => {
      expect(await leerProductosSeguidos(db, new Map(), new Set(['mercadona']))).toEqual([]);
    });
  });

  test('the whole loop: plan, run with a connector, and the price lands in the database', async () => {
    const ahora = new Date('2026-10-10T12:00:00.000Z');
    const demanda = new Map([[`${PREFIX}b`, 2]]);
    const seguidos = (await leerProductosSeguidos(db, demanda, new Set(['mercadona']))).filter(s => s.idExterno.startsWith(PREFIX));
    expect(seguidos).toHaveLength(1);

    const plan = planificarRefresco({
      productos: seguidos,
      ahora,
      politica: { maxEdadPrecioHoras: 24, maxPeticionesPorCadena: 5, pausaEntrePeticionesMs: 0 },
    });
    expect(plan.porCadena.mercadona.map(p => p.idExterno)).toEqual([`${PREFIX}b`]);

    const conector = crearConectorFalso({
      cadena: 'mercadona',
      productos: [producto('b', { zona: ZONA_BD, precioEnvase: 4.2, observadoEn: ahora.toISOString() })],
    });
    const informe = await ejecutarRefresco(plan, {
      registro: crearRegistro([conector]),
      guardar: async (p) => { await guardarObservacion(db, p); },
      esperar: async () => {},
    });

    expect(informe.porCadena[0]).toMatchObject({ estado: 'completada', observaciones: 1, fallos: 0 });
    const { precio, historial } = await precioActual('b');
    expect(precio?.precio_envase).toBe(4.2);
    expect(historial).toBe(1);
  });
});
