/**
 * FRESCO-896 — no active recipe may keep the generic step script.
 *
 * About half the catalog once carried "Preparar X / Cocinar con ... / Sazonar al gusto /
 * Servir caliente", the same four steps whatever the dish (a cold muesli included). Batch A
 * rewrote the 83 that still had it; this guards the catalog so a re-seed or a new import
 * cannot bring it back. Inactive recipes are ignored: the seed still carries old rows that
 * production deactivated.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` and the local stack answers — `bun run test:db`.
 */

import { describe, expect, test } from 'bun:test';
import { rest, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const GENERIC_STEP = encodeURIComponent('["Sazonar al gusto"]');

describe.skipIf(!(RUN && reachable))('recipe steps quality (real DB)', () => {
  test('no active recipe uses the generic "Sazonar al gusto" step', async () => {
    const res = await rest('recipes', { serviceRole: true, query: `select=nombre&activo=eq.true&pasos_resumen=cs.${GENERIC_STEP}` });

    expect(res.status).toBe(200);
    expect((res.body as Array<{ nombre: string }>).map(r => r.nombre)).toEqual([]);
  });
});
