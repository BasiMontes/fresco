/**
 * FRESCO-1011 (audit 7b: A7-LOGIC-06, A7-UI-07) — the Biblioteca search through `get_catalog`,
 * proven against the real database.
 *
 * Pinned here:
 *   1. Accents are ignored on both sides: 'salmon' returns the same ids as 'salmón', and the same for
 *      limón, plátano, brócoli and champiñón.
 *   2. `%`, `_` and `\` typed in the box are literal characters, not ILIKE wildcards: none of them lists
 *      the whole catalogue.
 *   3. The rest of the function is untouched: still SECURITY DEFINER with `pg_temp` last on the
 *      search_path, still clamps `p_limit`, still refuses another user's profile (the spoof itself is
 *      covered by security-definer-spoof.test.ts).
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rpc, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface CatalogPage { recipes: Array<{ id: string, nombre: string }>, total: number }

const PAIRS = [
  ['salmon', 'salmón'],
  ['limon', 'limón'],
  ['platano', 'plátano'],
  ['brocoli', 'brócoli'],
  ['champinon', 'champiñón'],
] as const;

describe.skipIf(!(RUN && reachable))('get_catalog search (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;
  let wholeCatalogue = 0;

  async function search(term: string | null): Promise<CatalogPage> {
    const result = await rpc('get_catalog', { p_user_id: user.id, p_search: term, p_limit: 1000, p_offset: 0 }, { token: user.token });
    expect(result.status).toBe(200);
    return result.body as CatalogPage;
  }

  const ids = (page: CatalogPage) => page.recipes.map(r => r.id).sort();

  beforeAll(async () => {
    user = await ctx.createUser();
    wholeCatalogue = (await search(null)).total;
  });

  afterAll(async () => ctx.cleanupAll());

  test('the local catalogue is big enough for the comparisons below to mean something', () => {
    expect(wholeCatalogue).toBeGreaterThan(50);
  });

  test.each(PAIRS)('"%s" finds the same recipes as "%s", and some', async (plain, accented) => {
    const withoutAccent = await search(plain);
    const withAccent = await search(accented);

    expect(withAccent.total).toBeGreaterThan(0);
    expect(ids(withoutAccent)).toEqual(ids(withAccent));
  });

  test('an uppercase, accented search finds them too', async () => {
    expect(ids(await search('SALMÓN'))).toEqual(ids(await search('salmon')));
  });

  test.each(['%', '_', '\\', '%%', '_%_'])('searching %p does not list the whole catalogue', async (term) => {
    const page = await search(term);

    expect(page.total).toBeLessThan(wholeCatalogue);
    expect(page.total).toBe(0);
  });

  test('a wildcard inside a word is literal: "sal%n" does not match "salmón"', async () => {
    expect((await search('sal%n')).total).toBe(0);
  });

  test('a blank search still returns the whole catalogue', async () => {
    expect((await search('   ')).total).toBe(wholeCatalogue);
  });

  test('another user\'s profile is still refused', async () => {
    const other = await ctx.createUser();
    const result = await rpc('get_catalog', { p_user_id: other.id, p_search: 'salmon' }, { token: user.token });

    expect(result.status).not.toBe(200);
  });
});
