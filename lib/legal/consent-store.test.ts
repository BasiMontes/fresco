import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { LEGAL_TEXTS_VERSION } from './consent';
import { getHealthDataConsentDate } from './consent-store';

/**
 * FRESCO-856 (ADR-0040) — reading back a health-data consent the user already
 * gave, so the wizard can say so instead of asking again.
 */

function clientReturning(result: { data: unknown, error: { message: string } | null }) {
  const filters: [string, unknown][] = [];
  const chain = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      filters.push([column, value]);
      return chain;
    },
    maybeSingle: async () => result,
  };
  const client = { from: (table: string) => { filters.push(['table', table]); return chain; } } as unknown as SupabaseClient<Database>;
  return { client, filters };
}

describe('getHealthDataConsentDate', () => {
  test('returns when the user consented, asking only for the current texts version', async () => {
    const { client, filters } = clientReturning({ data: { accepted_at: '2026-10-06T10:00:00Z' }, error: null });

    expect(await getHealthDataConsentDate(client)).toBe('2026-10-06T10:00:00Z');
    expect(filters).toContainEqual(['table', 'user_consents']);
    expect(filters).toContainEqual(['kind', 'health_data']);
    expect(filters).toContainEqual(['version', LEGAL_TEXTS_VERSION]);
  });

  test('null when there is no consent for the current version (never given, or given for an older text)', async () => {
    const { client } = clientReturning({ data: null, error: null });

    expect(await getHealthDataConsentDate(client)).toBeNull();
  });

  test('a read error means "ask again", never a silent consent and never a crash', async () => {
    const { client } = clientReturning({ data: null, error: { message: 'boom' } });

    expect(await getHealthDataConsentDate(client)).toBeNull();
  });
});
