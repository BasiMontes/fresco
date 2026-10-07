/**
 * FRESCO-816 (audit-6 A6-S9, A6-S14): privileges nobody uses, and a bounded catalog page.
 *
 * Pinned here:
 *   1. `get_catalog` still pages (a small `p_limit` returns that many rows) and a very
 *      large `p_limit` is served as one bounded page that still covers the whole active
 *      catalog, so the client's cumulative "load more" never loses rows to the ceiling.
 *   2. The migration itself revokes TRUNCATE / TRIGGER / REFERENCES / MAINTAIN and puts
 *      `pg_temp` last on `get_catalog`'s search_path (static, runs without a database).
 *
 * The table grants and the trigger-function EXECUTE grants cannot be observed through
 * PostgREST (it never exposes functions returning `trigger`), so a REST test would pass with
 * or without the revoke. They are verified against the database with `has_table_privilege`
 * and `has_function_privilege` when the migration ships (see the ticket).
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rpc, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const MIGRATION = 'supabase/migrations/20261007120000_revoke_unused_privileges_and_cap_catalog_limit.sql';
const CATALOG_CEILING = 1000;

interface CatalogPage {
  recipes: unknown[]
  total: number
}

async function catalogPage(user: DbTestUser, limit: number): Promise<{ status: number, page: CatalogPage }> {
  const result = await rpc('get_catalog', { p_user_id: user.id, p_limit: limit, p_offset: 0 }, { token: user.token });
  return { status: result.status, page: result.body as CatalogPage };
}

describe('revoked privileges migration (static)', () => {
  const sql = readFileSync(MIGRATION, 'utf8');

  test('revokes the four unused table privileges from the client roles, now and by default', () => {
    expect(sql).toContain('revoke truncate, trigger, references, maintain on all tables in schema public from anon, authenticated');
    expect(sql).toContain('revoke truncate, trigger, references, maintain on tables from anon, authenticated');
  });

  test('revokes EXECUTE on every trigger function from PUBLIC and the client roles', () => {
    expect(sql).toContain('p.prorettype = \'trigger\'::regtype');
    expect(sql).toContain('revoke execute on function %s from public, anon, authenticated');
  });

  test('get_catalog resolves pg_temp last and clamps p_limit to the ceiling', () => {
    expect(sql).toContain('SET search_path TO \'public\', \'pg_temp\'');
    expect(sql).toContain(`least(coalesce(nullif(greatest(p_limit, 0), 0), 30), ${CATALOG_CEILING})`);
  });
});

describe('definer search_path migration (static)', () => {
  const sql = readFileSync('supabase/migrations/20261007160000_definer_functions_search_path_pg_temp.sql', 'utf8');

  test('puts pg_temp last on every SECURITY DEFINER function whose search_path is exactly public', () => {
    expect(sql).toContain('p.prosecdef');
    expect(sql).toContain('\'search_path=public\' = any (coalesce(p.proconfig, \'{}\'))');
    expect(sql).toContain('set search_path = public, pg_temp');
  });
});

describe.skipIf(!(RUN && reachable))('revoked privileges and catalog limit (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;

  beforeAll(async () => {
    user = await ctx.createUser();
  });

  afterAll(async () => ctx.cleanupAll());

  describe('get_catalog page size', () => {
    test('a small p_limit still returns that many rows', async () => {
      const { status, page } = await catalogPage(user, 5);
      expect(status).toBe(200);
      expect(page.recipes).toHaveLength(5);
    });

    test('a huge p_limit returns one bounded page that covers the whole active catalog', async () => {
      const { status, page } = await catalogPage(user, 1_000_000);
      expect(status).toBe(200);
      expect(page.recipes.length).toBeLessThanOrEqual(CATALOG_CEILING);
      expect(page.recipes.length).toBe(Math.min(page.total, CATALOG_CEILING));
    });
  });
});
