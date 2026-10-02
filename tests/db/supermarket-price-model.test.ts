/**
 * FRESCO-770 — proves the supermarket price model against the real database:
 * who can read and write it, that the legal gate holds in the database and not
 * only in code, and what `get_supermarket_prices` will and will not return.
 *
 * Doctrine: `.agents/skills/sprint-development/references/rpc-authorization.md`
 * §5. The function has no identity parameter, so there is no actor to spoof
 * (the strongest fix, §2); the equivalent proof is that an extra identity
 * argument is rejected by the API, writes are denied to a real user token, and
 * a chain that is not runnable never leaks through the read path.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { registroSupermercados } from '../../lib/grocery/supermarket/registry';
import { createDbTestContext, rest, rpc, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const PREFIX = 'it-770-';
const INGREDIENTE = 'ingrediente-prueba-770';

interface ChainRow { slug: string, permiso: string, permiso_ref: string | null, habilitada: boolean }
interface PriceRow { cadena: string, id_externo: string, precio_envase: number, ingrediente: string }

/** Chain state as the system sees it. Users cannot read this table since FRESCO-798, so it is a service-role read. */
async function chains(): Promise<ChainRow[]> {
  const res = await rest('supermarket_chain', { serviceRole: true, query: 'select=*&order=slug.asc' });
  expect(res.status).toBe(200);
  return res.body as ChainRow[];
}

async function seedProduct(cadena: string, idExterno: string, precio: number): Promise<number> {
  const created = await rest('supermarket_product', {
    method: 'POST',
    serviceRole: true,
    prefer: 'return=representation',
    body: { cadena, id_externo: `${PREFIX}${idExterno}`, nombre: `Producto ${idExterno}`, envase_cantidad: 500, envase_unidad: 'g' },
  });
  expect(created.status).toBe(201);
  const id = (created.body as { id: number }[])[0].id;
  const price = await rest('supermarket_price', {
    method: 'POST',
    serviceRole: true,
    prefer: 'return=minimal',
    body: { producto_id: id, zona: 'default', precio_envase: precio, disponible: true, observado_en: new Date().toISOString() },
  });
  expect(price.status).toBe(201);
  const match = await rest('ingredient_product_match', {
    method: 'POST',
    serviceRole: true,
    prefer: 'return=minimal',
    body: { ingrediente: INGREDIENTE, producto_id: id, confianza: 'alta' },
  });
  expect(match.status).toBe(201);
  return id;
}

async function setChain(slug: string, patch: Record<string, unknown>) {
  return rest('supermarket_chain', {
    method: 'PATCH',
    serviceRole: true,
    query: `slug=eq.${slug}`,
    prefer: 'return=minimal',
    body: patch,
  });
}

describe.skipIf(!(RUN && reachable))('supermarket price model (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;

  beforeAll(async () => {
    user = await ctx.createUser();
    await seedProduct('mercadona', 'merc', 2.5);
    await seedProduct('consum', 'cons', 3.1);
    await seedProduct('dia', 'dia', 1.9);
  });

  afterAll(async () => {
    // Cascades to supermarket_price and ingredient_product_match.
    await rest('supermarket_product', { method: 'DELETE', serviceRole: true, query: `id_externo=like.${PREFIX}*` });
    await setChain('consum', { habilitada: true });
    await ctx.cleanupAll();
  });

  describe('access', () => {
    test('an authenticated user cannot read supermarket_chain at all (permiso / permiso_ref stay internal)', async () => {
      const res = await rest('supermarket_chain', { token: user.token, query: 'select=slug,permiso,permiso_ref' });
      expect([401, 403]).toContain(res.status);
      expect(JSON.stringify(res.body)).not.toContain('ADR-0028');
    });

    test('an authenticated user cannot write a product, and nothing is created', async () => {
      const res = await rest('supermarket_product', {
        method: 'POST',
        token: user.token,
        body: { cadena: 'mercadona', id_externo: `${PREFIX}intruso`, nombre: 'Intruso', envase_cantidad: 1, envase_unidad: 'g' },
      });
      expect([401, 403]).toContain(res.status);

      const check = await rest('supermarket_product', { serviceRole: true, query: `id_externo=eq.${PREFIX}intruso&select=id` });
      expect(check.body).toEqual([]);
    });

    test('an authenticated user cannot enable a chain', async () => {
      const res = await rest('supermarket_chain', {
        method: 'PATCH',
        token: user.token,
        query: 'slug=eq.dia',
        prefer: 'return=representation',
        body: { habilitada: true },
      });
      // RLS has no update policy: the PATCH matches zero rows or is refused outright.
      expect(res.status === 200 ? res.body : []).toEqual([]);
      const dia = (await chains()).find(c => c.slug === 'dia');
      expect(dia?.habilitada).toBe(false);
    });

    test('the anonymous role cannot call the RPC', async () => {
      const res = await rpc('get_supermarket_prices', { p_ingredientes: [INGREDIENTE] });
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('direct reads honour the legal gate (FRESCO-798)', () => {
    async function direct(table: string, query: string) {
      return rest(table, { token: user.token, query });
    }

    test('supermarket_product: only the products of runnable chains are readable, the pending chain returns 0 rows', async () => {
      const res = await direct('supermarket_product', `select=cadena,id_externo&id_externo=like.${PREFIX}*&order=cadena.asc`);
      expect(res.status).toBe(200);
      expect((res.body as { cadena: string }[]).map(r => r.cadena)).toEqual(['consum', 'mercadona']);

      const dia = await direct('supermarket_product', `select=id&cadena=eq.dia&id_externo=like.${PREFIX}*`);
      expect(dia.body).toEqual([]);
    });

    test('supermarket_price: the pending chain price is not readable, the runnable ones are', async () => {
      const dia = await rest('supermarket_product', { serviceRole: true, query: `select=id&cadena=eq.dia&id_externo=like.${PREFIX}*` });
      const diaId = (dia.body as { id: number }[])[0].id;

      const hidden = await direct('supermarket_price', `select=producto_id&producto_id=eq.${diaId}`);
      expect(hidden.status).toBe(200);
      expect(hidden.body).toEqual([]);

      const visible = await direct('supermarket_price', 'select=producto_id,precio_envase&precio_envase=in.(2.5,3.1)');
      expect((visible.body as unknown[]).length).toBeGreaterThanOrEqual(2);
    });

    test('ingredient_product_match: only matches of runnable chains are readable', async () => {
      const res = await direct('ingredient_product_match', `select=producto_id&ingrediente=eq.${INGREDIENTE}`);
      expect(res.status).toBe(200);
      expect((res.body as unknown[]).length).toBe(2);
    });

    test('supermarket_zone: only the zones of runnable chains are readable', async () => {
      const res = await direct('supermarket_zone', 'select=cadena&order=cadena.asc');
      expect(res.status).toBe(200);
      expect((res.body as { cadena: string }[]).map(r => r.cadena)).toEqual(['consum', 'mercadona']);
    });

    test('supermarket_price_history is service_role only: a user gets no access and no rows', async () => {
      const merc = await rest('supermarket_product', { serviceRole: true, query: `select=id&cadena=eq.mercadona&id_externo=like.${PREFIX}*` });
      const mercId = (merc.body as { id: number }[])[0].id;
      const seeded = await rest('supermarket_price_history', {
        method: 'POST',
        serviceRole: true,
        prefer: 'return=minimal',
        body: { producto_id: mercId, zona: 'default', precio_envase: 2.5, disponible: true, observado_en: new Date().toISOString() },
      });
      expect(seeded.status).toBe(201);

      const res = await direct('supermarket_price_history', 'select=producto_id');
      expect([401, 403]).toContain(res.status);
      expect(Array.isArray(res.body) ? res.body : []).toEqual([]);
    });

    test('a chain switched off hides its rows from a direct read too, even though they are still stored', async () => {
      expect((await setChain('consum', { habilitada: false })).status).toBeLessThan(300);
      const res = await direct('supermarket_product', `select=cadena&id_externo=like.${PREFIX}*&order=cadena.asc`);
      expect((res.body as { cadena: string }[]).map(r => r.cadena)).toEqual(['mercadona']);
      expect((await setChain('consum', { habilitada: true })).status).toBeLessThan(300);
    });

    test('the private gate function is not reachable through the Data API', async () => {
      const res = await rpc('supermarket_chain_activa', { p_cadena: 'mercadona' }, { token: user.token });
      expect([404, 406]).toContain(res.status);
    });
  });

  describe('the legal gate lives in the database', () => {
    test('a chain cannot be enabled while its permission is pending', async () => {
      const res = await setChain('dia', { habilitada: true });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect((await chains()).find(c => c.slug === 'dia')?.habilitada).toBe(false);
    });

    test('a runnable permission without a cited reference is rejected', async () => {
      const res = await setChain('dia', { permiso: 'concedido', permiso_ref: '   ' });
      expect(res.status).toBeGreaterThanOrEqual(400);
      const dia = (await chains()).find(c => c.slug === 'dia');
      expect(dia?.permiso).toBe('pendiente');
    });

    test('an enabled chain cannot be moved back to a non-runnable permission', async () => {
      const res = await setChain('mercadona', { permiso: 'pendiente' });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect((await chains()).find(c => c.slug === 'mercadona')?.permiso).toBe('riesgo-aceptado');
    });

    test('the seed matches the code registry: same permission, same reference, enabled exactly when runnable', async () => {
      const rows = await chains();
      const estado = registroSupermercados.estado();
      expect(estado.length).toBeGreaterThan(0);
      for (const conector of estado) {
        const fila = rows.find(r => r.slug === conector.cadena);
        expect(fila).toBeDefined();
        expect(fila?.permiso).toBe(conector.permiso);
        expect(fila?.permiso_ref).toBe(conector.permisoRef);
        expect(fila?.habilitada).toBe(conector.ejecutable);
      }
    });

    test('chains with no connector yet are seeded as pending and disabled', async () => {
      const conectores = new Set(registroSupermercados.estado().map(c => c.cadena));
      const sinConector = (await chains()).filter(c => !conectores.has(c.slug));
      expect(sinConector.length).toBeGreaterThan(0);
      for (const c of sinConector) {
        expect(c.permiso).toBe('pendiente');
        expect(c.habilitada).toBe(false);
      }
    });
  });

  describe('get_supermarket_prices', () => {
    test('returns the prices of runnable chains only, never a pending one', async () => {
      const res = await rpc('get_supermarket_prices', { p_ingredientes: [INGREDIENTE] }, { token: user.token });
      expect(res.status).toBe(200);
      const rows = res.body as PriceRow[];
      expect(rows.map(r => r.cadena).sort()).toEqual(['consum', 'mercadona']);
      expect(rows.find(r => r.cadena === 'mercadona')?.precio_envase).toBe(2.5);
    });

    test('a chain switched off stops being returned even though its rows are still there', async () => {
      expect((await setChain('consum', { habilitada: false })).status).toBeLessThan(300);
      const res = await rpc('get_supermarket_prices', { p_ingredientes: [INGREDIENTE] }, { token: user.token });
      expect((res.body as PriceRow[]).map(r => r.cadena)).toEqual(['mercadona']);
      expect((await setChain('consum', { habilitada: true })).status).toBeLessThan(300);
    });

    test('unknown ingredients, an unknown zone and empty input return an empty array, never an error', async () => {
      for (const args of [
        { p_ingredientes: ['no-existe-xyz'] },
        { p_ingredientes: [INGREDIENTE], p_zona: 'otra-zona' },
        { p_ingredientes: [] as string[] },
      ]) {
        const res = await rpc('get_supermarket_prices', args, { token: user.token });
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      }
    });

    test('reads at most 200 keys per call', async () => {
      const relleno = Array.from({ length: 200 }, (_, i) => `relleno-${i}`);
      const res = await rpc('get_supermarket_prices', { p_ingredientes: [...relleno, INGREDIENTE] }, { token: user.token });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('takes no identity parameter: passing one is refused by the API', async () => {
      const res = await rpc('get_supermarket_prices', { p_ingredientes: [INGREDIENTE], p_user_id: user.id }, { token: user.token });
      expect(res.status).toBe(404);
    });
  });
});
