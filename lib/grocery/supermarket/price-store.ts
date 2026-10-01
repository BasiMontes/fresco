import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductoParaCarga } from './catalog-connectors';
import type { DecisionEscritura, ObservacionDePrecio } from './price-write';
import type { ProductoSeguido } from './refresh-plan';
import type { CadenaId, ProductoSupermercado, ZonaId } from './types';
import type { Database } from '@/lib/supabase/types';
import { demandaPorProducto, sumarDemanda } from './demand';
import { decidirEscritura } from './price-write';

/**
 * FRESCO-770 — the database side of the supermarket refresh: what the runner
 * reads and writes. Takes a `service_role` client (the tables have no write
 * policy for anyone else), so it only ever runs in the runner, never in the app.
 *
 * Every decision is made by the pure modules next to it (`demand`,
 * `price-write`, `refresh-plan`); this file only moves rows.
 */

export type Db = SupabaseClient<Database>;

/** Until a postcode is captured, every chain prices a single zone (migration 20261001180000). */
export const ZONA_BD: ZonaId = 'default';

const PAGINA = 1000;
const LOTE = 200;

function falla(contexto: string, error: { message: string } | null): void {
  if (error) {
    throw new Error(`${contexto}: ${error.message}`);
  }
}

/** Reads every row of a query, a page at a time (PostgREST caps one response at 1000). */
async function leerTodo<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null, error: { message: string } | null }>,
  contexto: string,
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await pagina(desde, desde + PAGINA - 1);
    falla(contexto, error);
    filas.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGINA) {
      return filas;
    }
  }
}

function lotes<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += LOTE) {
    out.push(items.slice(i, i + LOTE));
  }
  return out;
}

/**
 * Chains switched on in the database. The table's own CHECK guarantees each one
 * has a runnable permission with a cited reference, so this is the legal gate
 * as the database holds it.
 */
export async function leerCadenasHabilitadas(db: Db): Promise<Set<CadenaId>> {
  const { data, error } = await db.from('supermarket_chain').select('slug').eq('habilitada', true);
  falla('read enabled chains', error);
  return new Set((data ?? []).map(c => c.slug));
}

/**
 * Menu slots still to buy per ingredient, in plans starting on or after `desde`
 * (YYYY-MM-DD). Reads `get_supermarket_demand`, which is service_role only and
 * returns aggregates: the runner never sees a user's menu.
 */
export async function leerDemandaDeMenu(db: Db, desde: string): Promise<Map<string, number>> {
  const filas = await leerTodo(
    (a, b) => db.rpc('get_supermarket_demand', { p_desde: desde }).order('ingrediente').range(a, b),
    'read menu demand',
  );
  return sumarDemanda(filas.map(f => ({ ingrediente: f.ingrediente, huecos: Number(f.huecos) })));
}

/**
 * The products the plan may refresh: those of an enabled chain that some active
 * menu slot needs (through `ingredient_product_match`), with the date of their
 * last observation in `zona`.
 */
export async function leerProductosSeguidos(
  db: Db,
  demandaPorIngrediente: ReadonlyMap<string, number>,
  habilitadas: ReadonlySet<CadenaId>,
  zona: ZonaId = ZONA_BD,
): Promise<ProductoSeguido[]> {
  const coincidencias = (await leerTodo(
    (a, b) => db.from('ingredient_product_match').select('ingrediente, producto_id').order('ingrediente').order('producto_id').range(a, b),
    'read matches',
  )).map(c => ({ ingrediente: c.ingrediente, productoId: c.producto_id }));

  const demanda = demandaPorProducto(coincidencias, demandaPorIngrediente);
  if (demanda.size === 0) {
    return [];
  }

  const productos = await leerTodo(
    (a, b) => db.from('supermarket_product').select('id, cadena, id_externo').order('id').range(a, b),
    'read products',
  );
  const precios = await leerTodo(
    (a, b) => db.from('supermarket_price').select('producto_id, observado_en').eq('zona', zona).order('producto_id').range(a, b),
    'read prices',
  );
  const ultima = new Map(precios.map(p => [p.producto_id, p.observado_en]));

  return productos
    .filter(p => habilitadas.has(p.cadena) && (demanda.get(p.id) ?? 0) > 0)
    .map(p => ({
      cadena: p.cadena,
      idExterno: p.id_externo,
      zona,
      ultimaObservacion: ultima.get(p.id) ?? null,
      demanda: demanda.get(p.id)!,
    }));
}

/**
 * Stores one observation: the current price, and a history row only when the
 * price or availability changed (`decidirEscritura`). A product the database
 * does not track is an error: the runner only refreshes tracked products.
 */
export async function guardarObservacion(db: Db, producto: ProductoSupermercado): Promise<DecisionEscritura> {
  const { data: fila, error: errorProducto } = await db
    .from('supermarket_product')
    .select('id')
    .eq('cadena', producto.cadena)
    .eq('id_externo', producto.idExterno)
    .maybeSingle();
  falla('read product', errorProducto);
  if (!fila) {
    throw new Error(`product ${producto.cadena}/${producto.idExterno} is not tracked`);
  }

  const { data: precio, error: errorPrecio } = await db
    .from('supermarket_price')
    .select('precio_envase, disponible, observado_en')
    .eq('producto_id', fila.id)
    .eq('zona', producto.zona)
    .maybeSingle();
  falla('read current price', errorPrecio);

  const actual: ObservacionDePrecio | null = precio
    ? { precioEnvase: precio.precio_envase, disponible: precio.disponible, observadoEn: precio.observado_en }
    : null;
  const nueva: ObservacionDePrecio = {
    precioEnvase: producto.precioEnvase,
    disponible: producto.disponible,
    observadoEn: producto.observadoEn,
  };

  const decision = decidirEscritura(actual, nueva);
  if (decision === 'ignorar') {
    return decision;
  }

  const filaPrecio = {
    producto_id: fila.id,
    zona: producto.zona,
    precio_envase: producto.precioEnvase,
    disponible: producto.disponible,
    observado_en: producto.observadoEn,
  };
  const { error: errorUpsert } = await db.from('supermarket_price').upsert(filaPrecio, { onConflict: 'producto_id,zona' });
  falla('write current price', errorUpsert);

  if (decision === 'actualizar-con-historial') {
    const { error: errorHistorial } = await db
      .from('supermarket_price_history')
      .upsert(filaPrecio, { onConflict: 'producto_id,zona,observado_en', ignoreDuplicates: true });
    falla('write price history', errorHistorial);
  }

  const { error: errorVisto } = await db
    .from('supermarket_product')
    .update({ visto_por_ultima_vez: new Date().toISOString() })
    .eq('id', fila.id);
  falla('touch product', errorVisto);
  return decision;
}

export interface ResultadoCarga {
  /** Distinct products stored (two ingredients may share one). */
  productos: number
  /** Catalog entries skipped because their price does not fit `numeric(10, 2)` above zero. */
  omitidos: number
}

/**
 * Initial load: puts the products of the committed catalogs into the database,
 * each matched to the ingredient(s) it was found for, in `zona`.
 *
 * Idempotent. Products and matches are upserted; an existing price is NEVER
 * overwritten, so re-running cannot replace a newer observation. The catalogs
 * carry no observation date, so the price is stored with the unknown date the
 * connectors report, which the refresh plan reads as stale.
 */
export async function cargarProductos(
  db: Db,
  items: readonly ProductoParaCarga[],
  zona: ZonaId = ZONA_BD,
): Promise<ResultadoCarga> {
  const clave = (p: ProductoSupermercado): string => `${p.cadena}\u0000${p.idExterno}`;
  const validos = items.filter(i => Math.round(i.producto.precioEnvase * 100) > 0);
  const unicos = new Map<string, ProductoSupermercado>();
  for (const { producto } of validos) {
    if (!unicos.has(clave(producto))) {
      unicos.set(clave(producto), producto);
    }
  }

  for (const lote of lotes([...unicos.values()])) {
    const { data, error } = await db
      .from('supermarket_product')
      .upsert(
        lote.map(p => ({
          cadena: p.cadena,
          id_externo: p.idExterno,
          nombre: p.nombre,
          marca: p.marca,
          envase_cantidad: p.envase.cantidad,
          envase_unidad: p.envase.unidad,
          url: p.url,
        })),
        { onConflict: 'cadena,id_externo' },
      )
      .select('id, cadena, id_externo');
    falla('load products', error);
    const idDe = new Map((data ?? []).map(f => [`${f.cadena}\u0000${f.id_externo}`, f.id]));

    const delLote = new Set(lote.map(clave));
    const coincidencias = validos.flatMap(({ ingrediente, producto }) => {
      const id = delLote.has(clave(producto)) ? idDe.get(clave(producto)) : undefined;
      return id === undefined ? [] : [{ ingrediente, producto_id: id, confianza: 'alta' }];
    });
    const { error: errorMatch } = await db
      .from('ingredient_product_match')
      .upsert(coincidencias, { onConflict: 'ingrediente,producto_id', ignoreDuplicates: true });
    falla('load matches', errorMatch);

    const { error: errorPrecio } = await db.from('supermarket_price').upsert(
      lote.flatMap((p) => {
        const id = idDe.get(clave(p));
        return id === undefined
          ? []
          : [{ producto_id: id, zona, precio_envase: p.precioEnvase, disponible: p.disponible, observado_en: p.observadoEn }];
      }),
      { onConflict: 'producto_id,zona', ignoreDuplicates: true },
    );
    falla('load prices', errorPrecio);
  }
  return { productos: unicos.size, omitidos: items.length - validos.length };
}
