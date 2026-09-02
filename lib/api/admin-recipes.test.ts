import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { searchCatalogRecipes } from './admin-recipes';

/**
 * Mock the `.from().select().or().order().limit()` chain and capture the
 * exact filter string handed to `.or()` (A4-L6 — that string is where raw
 * user input used to be interpolated).
 */
function createMockClient() {
  const orCalls: string[] = [];
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.or = (filter: string) => { orCalls.push(filter); return builder; };
  builder.order = () => builder;
  builder.limit = async () => ({ data: [], error: null });

  const client = { from: () => builder } as unknown as SupabaseClient<Database>;
  return { client, orCalls };
}

describe('searchCatalogRecipes — A4-L6 .or() injection', () => {
  test('a needle with an OR-injection payload is quoted, not interpolated as syntax', async () => {
    const { client, orCalls } = createMockClient();

    await searchCatalogRecipes(client, 'x,id.eq.00000000-0000-0000-0000-000000000000');

    // The comma / dots land INSIDE a double-quoted value, so PostgREST reads
    // the whole thing as one ilike pattern instead of an extra OR term.
    expect(orCalls[0]).toBe(
      'nombre.ilike."%x,id.eq.00000000-0000-0000-0000-000000000000%",slug.ilike."%x,id.eq.00000000-0000-0000-0000-000000000000%"',
    );
  });

  test('embedded double quotes and backslashes are escaped', async () => {
    const { client, orCalls } = createMockClient();

    await searchCatalogRecipes(client, 'a"b\\c');

    expect(orCalls[0]).toBe('nombre.ilike."%a\\"b\\\\c%",slug.ilike."%a\\"b\\\\c%"');
  });

  test('a plain needle still works', async () => {
    const { client, orCalls } = createMockClient();

    await searchCatalogRecipes(client, 'lentejas');

    expect(orCalls[0]).toBe('nombre.ilike."%lentejas%",slug.ilike."%lentejas%"');
  });

  test('an empty / whitespace needle short-circuits with no query', async () => {
    const { client, orCalls } = createMockClient();

    const result = await searchCatalogRecipes(client, '   ');

    expect(result).toEqual([]);
    expect(orCalls).toHaveLength(0);
  });
});
