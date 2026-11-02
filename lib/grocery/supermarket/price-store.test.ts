import type { Db } from './price-store';
import type { ProductoSupermercado } from './types';
import { describe, expect, test } from 'bun:test';
import {
  cargarProductos,
  guardarObservacion,
  leerCadenasHabilitadas,
  leerDemandaDeMenu,
  leerProductosSeguidos,
  ZONA_BD,
} from './price-store';

// FRESCO-1076 — the database side of the supermarket refresh. The property worth
// pinning is what lands in each table, and that a failed write is loud.

type Fila = Record<string, unknown>;
type Tablas = Record<string, Fila[]>;

interface Escritura { tabla: string, tipo: 'upsert' | 'update', payload: unknown, opciones?: unknown }

/**
 * An in-memory stand-in for the Supabase client. Reads filter with `eq` and
 * honour `range` (so pagination is real); writes are recorded and, for upsert,
 * applied by the `onConflict` key. A table named in `errores` fails every call.
 */
function dbFalsa(tablas: Tablas, errores: Record<string, string> = {}): { db: Db, escrituras: Escritura[], tablas: Tablas } {
  const escrituras: Escritura[] = [];
  const respuesta = (tabla: string, data: unknown) =>
    errores[tabla] ? { data: null, error: { message: errores[tabla] } } : { data, error: null };

  const lectura = (tabla: string, origen: Fila[]) => {
    const filtros: Array<[string, unknown]> = [];
    let rango: [number, number] | null = null;
    const filtradas = (): Fila[] => origen.filter(f => filtros.every(([c, v]) => f[c] === v));
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (c: string, v: unknown) => { filtros.push([c, v]); return builder; },
      order: () => builder,
      range: (a: number, b: number) => { rango = [a, b]; return builder; },
      maybeSingle: async () => respuesta(tabla, filtradas()[0] ?? null),
      then: async (resolver: (valor: unknown) => unknown) => {
        const todas = filtradas();
        return Promise.resolve(respuesta(tabla, rango ? todas.slice(rango[0], rango[1] + 1) : todas)).then(resolver);
      },
    };
    return builder;
  };

  const from = (tabla: string) => {
    const filas = (tablas[tabla] ??= []);
    return {
      ...lectura(tabla, filas),
      select: () => lectura(tabla, filas),
      upsert: (payload: Fila | Fila[], opciones?: { onConflict?: string }) => {
        escrituras.push({ tabla, tipo: 'upsert', payload, opciones });
        const claves = (opciones?.onConflict ?? 'id').split(',');
        const nuevas = Array.isArray(payload) ? payload : [payload];
        const guardadas = nuevas.map((n) => {
          const previa = filas.find(f => claves.every(c => f[c] === n[c]));
          if (previa) { Object.assign(previa, n); return previa; }
          const fila = { id: filas.length + 1, ...n };
          filas.push(fila);
          return fila;
        });
        // A thenable, not a promise: `await upsert(...)` and `upsert(...).select()` are both valid in the store.
        return {
          select: async () => respuesta(tabla, guardadas),
          then: async (resolver: (valor: unknown) => unknown) => Promise.resolve(respuesta(tabla, guardadas)).then(resolver),
        };
      },
      update: (payload: Fila) => {
        escrituras.push({ tabla, tipo: 'update', payload });
        return { eq: async () => respuesta(tabla, null) };
      },
    };
  };

  const rpc = (nombre: string) => lectura(nombre, tablas[nombre] ?? []);
  return { db: { from, rpc } as unknown as Db, escrituras, tablas };
}

function producto(parcial: Partial<ProductoSupermercado> = {}): ProductoSupermercado {
  return {
    cadena: 'tiendafalsa',
    idExterno: 'p1',
    nombre: 'Leche entera',
    marca: null,
    envase: { cantidad: 1000, unidad: 'ml' },
    precioEnvase: 0.9,
    url: null,
    disponible: true,
    zona: ZONA_BD,
    observadoEn: '2026-10-05T10:00:00.000Z',
    ...parcial,
  };
}

describe('leerCadenasHabilitadas', () => {
  test('returns the slugs of the chains switched on, and none of the others', async () => {
    const { db } = dbFalsa({
      supermarket_chain: [
        { slug: 'mercadona', habilitada: true },
        { slug: 'consum', habilitada: false },
      ],
    });
    expect([...await leerCadenasHabilitadas(db)]).toEqual(['mercadona']);
  });

  test('throws with the context when the read fails', async () => {
    const { db } = dbFalsa({}, { supermarket_chain: 'permission denied' });
    await expect(leerCadenasHabilitadas(db)).rejects.toThrow('read enabled chains: permission denied');
  });
});

describe('leerDemandaDeMenu', () => {
  test('sums the slots per ingredient and turns the counts into numbers', async () => {
    const { db } = dbFalsa({
      get_supermarket_demand: [
        { ingrediente: 'leche', huecos: '2' },
        { ingrediente: 'leche', huecos: 3 },
        { ingrediente: 'huevos', huecos: '1' },
      ],
    });
    const demanda = await leerDemandaDeMenu(db, '2026-10-05');
    expect(demanda.get('leche')).toBe(5);
    expect(demanda.get('huevos')).toBe(1);
  });

  test('reads every page when the demand is longer than one PostgREST response', async () => {
    const filas = Array.from({ length: 1500 }, (_, i) => ({ ingrediente: `ing-${i}`, huecos: 1 }));
    const { db } = dbFalsa({ get_supermarket_demand: filas });
    expect((await leerDemandaDeMenu(db, '2026-10-05')).size).toBe(1500);
  });

  test('throws with the context when the RPC fails', async () => {
    const { db } = dbFalsa({}, { get_supermarket_demand: 'boom' });
    await expect(leerDemandaDeMenu(db, '2026-10-05')).rejects.toThrow('read menu demand: boom');
  });
});

describe('leerProductosSeguidos', () => {
  const base: Tablas = {
    ingredient_product_match: [
      { ingrediente: 'leche', producto_id: 1 },
      { ingrediente: 'arroz', producto_id: 2 },
      { ingrediente: 'sal', producto_id: 3 },
    ],
    supermarket_product: [
      { id: 1, cadena: 'mercadona', id_externo: 'm-leche' },
      { id: 2, cadena: 'consum', id_externo: 'c-arroz' },
      { id: 3, cadena: 'mercadona', id_externo: 'm-sal' },
    ],
    supermarket_price: [{ producto_id: 1, zona: 'default', observado_en: '2026-10-01T00:00:00.000Z' }],
  };

  test('returns only products of an enabled chain that a menu slot still needs, with the last observation date', async () => {
    const { db } = dbFalsa(base);
    const seguidos = await leerProductosSeguidos(db, {
      demandaPorIngrediente: new Map([['leche', 4], ['arroz', 2]]),
      habilitadas: new Set(['mercadona']),
    });
    expect(seguidos).toEqual([
      { cadena: 'mercadona', idExterno: 'm-leche', zona: 'default', ultimaObservacion: '2026-10-01T00:00:00.000Z', demanda: 4 },
    ]);
  });

  test('a product with no price yet has no last observation', async () => {
    const { db } = dbFalsa(base);
    const seguidos = await leerProductosSeguidos(db, {
      demandaPorIngrediente: new Map([['sal', 1]]),
      habilitadas: new Set(['mercadona']),
    });
    expect(seguidos[0]?.ultimaObservacion).toBeNull();
  });

  test('returns nothing, and skips the product and price reads, when no ingredient has demand', async () => {
    const { db } = dbFalsa({ ingredient_product_match: base.ingredient_product_match }, { supermarket_product: 'must not be read' });
    const seguidos = await leerProductosSeguidos(db, {
      demandaPorIngrediente: new Map(),
      habilitadas: new Set(['mercadona']),
    });
    expect(seguidos).toEqual([]);
  });
});

describe('guardarObservacion', () => {
  const seguido = { supermarket_product: [{ id: 7, cadena: 'tiendafalsa', id_externo: 'p1' }] };

  test('a first observation stores the price, a history row and touches the product', async () => {
    const { db, escrituras } = dbFalsa({ ...seguido });
    expect(await guardarObservacion(db, producto())).toBe('actualizar-con-historial');
    expect(escrituras.map(e => `${e.tipo}:${e.tabla}`)).toEqual([
      'upsert:supermarket_price',
      'upsert:supermarket_price_history',
      'update:supermarket_product',
    ]);
    expect(escrituras[0]?.payload).toMatchObject({ producto_id: 7, zona: 'default', precio_envase: 0.9, disponible: true });
  });

  test('the same price on a later date moves the date but writes no history', async () => {
    const { db, escrituras } = dbFalsa({
      ...seguido,
      supermarket_price: [{ producto_id: 7, zona: 'default', precio_envase: 0.9, disponible: true, observado_en: '2026-10-01T00:00:00.000Z' }],
    });
    expect(await guardarObservacion(db, producto())).toBe('actualizar');
    expect(escrituras.some(e => e.tabla === 'supermarket_price_history')).toBe(false);
  });

  test('an observation that is not newer writes nothing at all', async () => {
    const { db, escrituras } = dbFalsa({
      ...seguido,
      supermarket_price: [{ producto_id: 7, zona: 'default', precio_envase: 0.9, disponible: true, observado_en: '2026-10-09T00:00:00.000Z' }],
    });
    expect(await guardarObservacion(db, producto())).toBe('ignorar');
    expect(escrituras).toEqual([]);
  });

  test('a product the database does not track is an error, not a silent insert', async () => {
    const { db, escrituras } = dbFalsa({ supermarket_product: [] });
    await expect(guardarObservacion(db, producto())).rejects.toThrow('product tiendafalsa/p1 is not tracked');
    expect(escrituras).toEqual([]);
  });

  test('a failed price write is thrown with its context', async () => {
    const { db } = dbFalsa({ ...seguido }, { supermarket_price: 'disk full' });
    await expect(guardarObservacion(db, producto())).rejects.toThrow('read current price: disk full');
  });
});

describe('cargarProductos', () => {
  const item = (ingrediente: string, parcial: Partial<ProductoSupermercado> = {}) => ({ ingrediente, producto: producto(parcial) });

  test('stores each distinct product once, matched to every ingredient it was found for', async () => {
    const { db, tablas } = dbFalsa({});
    const resultado = await cargarProductos(db, { items: [item('leche'), item('nata'), item('arroz', { idExterno: 'p2', nombre: 'Arroz' })] });
    expect(resultado).toEqual({ productos: 2, omitidos: 0 });
    expect(tablas.supermarket_product).toHaveLength(2);
    expect(tablas.ingredient_product_match?.map(m => m.ingrediente).sort()).toEqual(['arroz', 'leche', 'nata']);
  });

  test('skips entries whose price is not above zero and counts them as omitted', async () => {
    const { db, tablas } = dbFalsa({});
    const resultado = await cargarProductos(db, { items: [item('leche'), item('gratis', { idExterno: 'p3', precioEnvase: 0 })] });
    expect(resultado).toEqual({ productos: 1, omitidos: 1 });
    expect(tablas.supermarket_product).toHaveLength(1);
  });

  test('never overwrites an existing price: the price upsert ignores duplicates', async () => {
    const { db, escrituras } = dbFalsa({});
    await cargarProductos(db, { items: [item('leche')] });
    const precio = escrituras.find(e => e.tabla === 'supermarket_price');
    expect(precio?.opciones).toEqual({ onConflict: 'producto_id,zona', ignoreDuplicates: true });
  });

  test('loads in batches of 200 products', async () => {
    const items = Array.from({ length: 450 }, (_, i) => item(`ing-${i}`, { idExterno: `p-${i}` }));
    const { db, escrituras } = dbFalsa({});
    expect((await cargarProductos(db, { items })).productos).toBe(450);
    expect(escrituras.filter(e => e.tabla === 'supermarket_product')).toHaveLength(3);
  });

  test('throws with the context when the product upsert fails', async () => {
    const { db } = dbFalsa({}, { supermarket_product: 'constraint' });
    await expect(cargarProductos(db, { items: [item('leche')] })).rejects.toThrow('load products: constraint');
  });
});
