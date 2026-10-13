import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import * as realLazy from '@/lib/supabase/client-lazy';
import { syncAnalyticsConsent } from './identity';

/**
 * FRESCO-919 (ADR-0044) — `syncAnalyticsConsent` reads the stored decision and
 * writes only when it differs, and skips a user with no profile row yet.
 */

let stored: { analytics_consent: boolean | null } | null = null;
const updates: unknown[] = [];

const client = {
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: stored }) }) }),
    update: (values: unknown) => {
      updates.push(values);
      return { eq: async () => ({ error: null }) };
    },
  }),
};

void mock.module('@/lib/supabase/client-lazy', () => ({
  loadSupabaseClient: async () => ({ createClient: () => client }),
}));

// `mock.module` is process-wide in bun: put the real module back so later test files see it.
afterAll(() => {
  void mock.module('@/lib/supabase/client-lazy', () => realLazy);
});

beforeEach(() => {
  stored = null;
  updates.length = 0;
});

describe('syncAnalyticsConsent', () => {
  test('writes the decision when the stored one differs', async () => {
    stored = { analytics_consent: null };

    await syncAnalyticsConsent({ userId: 'user-1', accepted: false });

    expect(updates).toEqual([{ analytics_consent: false }]);
  });

  test('writes nothing when the stored decision already matches', async () => {
    stored = { analytics_consent: true };

    await syncAnalyticsConsent({ userId: 'user-1', accepted: true });

    expect(updates).toEqual([]);
  });

  test('skips a user with no profile row (onboarding carries the decision)', async () => {
    stored = null;

    await syncAnalyticsConsent({ userId: 'user-1', accepted: true });

    expect(updates).toEqual([]);
  });
});
