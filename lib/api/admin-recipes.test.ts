import { describe, expect, test } from 'bun:test';
import { createMockClient } from '@/lib/fixtures/mock-supabase-client';
import { searchCatalogRecipes } from './admin-recipes';

describe('searchCatalogRecipes — A4-L6 .or() injection', () => {
  test('a needle with an OR-injection payload is quoted, not interpolated as syntax', async () => {
    const { client, callsOf } = createMockClient({ data: [] });

    await searchCatalogRecipes(client, 'x,id.eq.00000000-0000-0000-0000-000000000000');

    // The comma / dots land INSIDE a double-quoted value, so PostgREST reads
    // the whole thing as one ilike pattern instead of an extra OR term.
    expect(callsOf('or')[0]?.[0]).toBe(
      'nombre.ilike."%x,id.eq.00000000-0000-0000-0000-000000000000%",slug.ilike."%x,id.eq.00000000-0000-0000-0000-000000000000%"',
    );
  });

  test('embedded double quotes and backslashes are escaped', async () => {
    const { client, callsOf } = createMockClient({ data: [] });

    await searchCatalogRecipes(client, 'a"b\\c');

    expect(callsOf('or')[0]?.[0]).toBe('nombre.ilike."%a\\"b\\\\c%",slug.ilike."%a\\"b\\\\c%"');
  });

  test('a plain needle still works', async () => {
    const { client, callsOf } = createMockClient({ data: [] });

    await searchCatalogRecipes(client, 'lentejas');

    expect(callsOf('or')[0]?.[0]).toBe('nombre.ilike."%lentejas%",slug.ilike."%lentejas%"');
  });

  test('an empty / whitespace needle short-circuits with no query', async () => {
    const { client, callsOf } = createMockClient({ data: [] });

    const result = await searchCatalogRecipes(client, '   ');

    expect(result).toEqual([]);
    expect(callsOf('or')).toHaveLength(0);
  });
});
