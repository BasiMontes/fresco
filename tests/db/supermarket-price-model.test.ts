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

async function chains(token: string): Promise<ChainRow[]> {
  const res = await rest('supermarket_chain', { token, query: 'select=*&order=slug.asc' });
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
    test('an authenticated user can read the chains', async () => {
      const rows = await chains(user.token);
      expect(rows.map(r => r.slug)).toEqual(['alcampo', 'consum', 'dia', 'mercadona']);
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
      const dia = (await chains(user.token)).find(c => c.slug === 'dia');
      expect(dia?.habilitada).toBe(false);
    });

    test('the anonymous role cannot call the RPC', async () => {
      const res = await rpc('get_supermarket_prices', { p_ingredientes: [INGREDIENTE] });
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('the legal gate lives in the database', () => {
    test('a chain cannot be enabled while its permission is pending', async () => {
      const res = await setChain('dia', { habilitada: true });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect((await chains(user.token)).find(c => c.slug === 'dia')?.habilitada).toBe(false);
    });

    test('a runnable permission without a cited reference is rejected', async () => {
      const res = await setChain('dia', { permiso: 'concedido', permiso_ref: '   ' });
      expect(res.status).toBeGreaterThanOrEqual(400);
      const dia = (await chains(user.token)).find(c => c.slug === 'dia');
      expect(dia?.permiso).toBe('pendiente');
    });

    test('an enabled chain cannot be moved back to a non-runnable permission', async () => {
      const res = await setChain('mercadona', { permiso: 'pendiente' });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect((await chains(user.token)).find(c => c.slug === 'mercadona')?.permiso).toBe('riesgo-aceptado');
    });

    test('the seed matches the code registry: same permission, same reference, enabled exactly when runnable', async () => {
      const rows = await chains(user.token);
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
      const sinConector = (await chains(user.token)).filter(c => !conectores.has(c.slug));
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
