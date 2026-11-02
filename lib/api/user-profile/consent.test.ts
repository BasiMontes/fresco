import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { getHasHealthDataConsent } from './consent';

// FRESCO-1078 — whether the user has recorded the health-data consent. The database
// refuses allergies and diet without it, so a wrong "yes" here hides the consent
// prompt and a wrong "no" asks again. Only the Supabase client is replaced.

interface Call { table?: string, select?: string, filters: Array<[string, unknown]>, limit?: number }

function fakeClient(result: { data: unknown[] | null, error: { message: string } | null }) {
  const call: Call = { filters: [] };
  const chain: Record<string, unknown> = {
    select: (columns: string) => { call.select = columns; return chain; },
    eq: (column: string, value: unknown) => { call.filters.push([column, value]); return chain; },
    limit: async (n: number) => { call.limit = n; return result; },
  };
  const supabase = { from: (table: string) => { call.table = table; return chain; } } as unknown as SupabaseClient<Database>;
  return { supabase, call };
}

describe('getHasHealthDataConsent', () => {
  test('is false without a user id, and does not query', async () => {
    const { supabase, call } = fakeClient({ data: [], error: null });
    expect(await getHasHealthDataConsent(supabase, undefined)).toBe(false);
    expect(call.table).toBeUndefined();
  });

  test('is true when the user has a health_data consent row of any version', async () => {
    const { supabase, call } = fakeClient({ data: [{ id: 'c1' }], error: null });
    expect(await getHasHealthDataConsent(supabase, 'user-1')).toBe(true);
    expect(call.table).toBe('user_consents');
    expect(call.filters).toEqual([['user_id', 'user-1'], ['kind', 'health_data']]);
    expect(call.limit).toBe(1);
  });

  test('is false when there is no row', async () => {
    const { supabase } = fakeClient({ data: [], error: null });
    expect(await getHasHealthDataConsent(supabase, 'user-1')).toBe(false);
  });

  test('is false when the query returns no data at all', async () => {
    const { supabase } = fakeClient({ data: null, error: null });
    expect(await getHasHealthDataConsent(supabase, 'user-1')).toBe(false);
  });

  test('throws, never answers no, when the query fails, so the caller chooses the fallback', async () => {
    const { supabase } = fakeClient({ data: null, error: { message: 'rls denied' } });
    await expect(getHasHealthDataConsent(supabase, 'user-1')).rejects.toThrow('No se pudo leer el consentimiento de datos de salud: rls denied');
  });
});
