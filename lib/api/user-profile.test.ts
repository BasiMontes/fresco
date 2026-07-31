import type { SupabaseClient } from '@supabase/supabase-js';
import type { OnboardingProfilePayload } from './user-profile';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { getUserPlan, upsertUserProfile, UserProfileError } from './user-profile';

const SAMPLE_PAYLOAD: OnboardingProfilePayload = {
  num_personas: 3,
  adultos: 2,
  ninos: 1,
  dieta_vegetariano: true,
  dieta_vegano: true,
  dieta_sin_gluten: false,
  dieta_sin_lactosa: false,
  dieta_sin_huevo: false,
  dieta_keto: false,
  dieta_halal: false,
  alergenos: ['gluten'],
  ingredientes_odiados: ['cebolla'],
  cocinas_favoritas: ['española'],
};

function createMockClient(options: { userId?: string, upsertErrorMessage?: string } = {}) {
  const upsertCalls: unknown[] = [];

  const mock = {
    auth: {
      getUser: async () => (
        options.userId
          ? { data: { user: { id: options.userId } }, error: null }
          : { data: { user: null }, error: null }
      ),
    },
    from: () => ({
      upsert: async (payload: unknown) => {
        upsertCalls.push(payload);
        return { error: options.upsertErrorMessage ? { message: options.upsertErrorMessage } : null };
      },
    }),
  };

  return { client: mock as unknown as SupabaseClient<Database>, upsertCalls };
}

/**
 * bun-types' `.rejects.toThrow()` is typed as returning `void` (not a
 * `Promise`), so `await expect(promise).rejects.toThrow(...)` trips this
 * repo's `ts/await-thenable` lint rule. A plain try/catch avoids the false
 * positive without weakening the assertion.
 */
async function expectRejection(promise: Promise<unknown>): Promise<void> {
  let thrownError: unknown;
  try {
    await promise;
  }
  catch (error) {
    thrownError = error;
  }
  expect(thrownError).toBeInstanceOf(UserProfileError);
}

describe('upsertUserProfile', () => {
  test('builds the expected payload shape, keyed by the authenticated user id', async () => {
    const { client, upsertCalls } = createMockClient({ userId: 'user-123' });

    await upsertUserProfile(client, SAMPLE_PAYLOAD);

    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0]).toEqual({ id: 'user-123', ...SAMPLE_PAYLOAD });
  });

  test('throws UserProfileError when there is no authenticated session', async () => {
    const { client } = createMockClient({});

    await expectRejection(upsertUserProfile(client, SAMPLE_PAYLOAD));
  });

  test('throws UserProfileError when the upsert itself fails', async () => {
    const { client } = createMockClient({ userId: 'user-123', upsertErrorMessage: 'constraint violation' });

    await expectRejection(upsertUserProfile(client, SAMPLE_PAYLOAD));
  });

  test('throws UserProfileError for an allergen outside the curated allow-list, without calling upsert', async () => {
    const { client, upsertCalls } = createMockClient({ userId: 'user-123' });

    await expectRejection(upsertUserProfile(client, { ...SAMPLE_PAYLOAD, alergenos: ['not-a-real-allergen'] }));
    expect(upsertCalls).toHaveLength(0);
  });

  test('throws UserProfileError for a disliked ingredient outside the curated allow-list, without calling upsert', async () => {
    const { client, upsertCalls } = createMockClient({ userId: 'user-123' });

    await expectRejection(upsertUserProfile(client, { ...SAMPLE_PAYLOAD, ingredientes_odiados: ['not-a-real-ingredient'] }));
    expect(upsertCalls).toHaveLength(0);
  });
});

/** Minimal mock client exposing `.select().eq().maybeSingle()` — all `getUserPlan()` calls. */
function createPlanMockClient(options: { userId?: string, planRow?: { plan: string } | null, dbErrorMessage?: string } = {}) {
  const mock = {
    auth: {
      getUser: async () => (
        options.userId
          ? { data: { user: { id: options.userId } }, error: null }
          : { data: { user: null }, error: null }
      ),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: options.dbErrorMessage ? null : (options.planRow ?? null),
            error: options.dbErrorMessage ? { message: options.dbErrorMessage } : null,
          }),
        }),
      }),
    }),
  };

  return { client: mock as unknown as SupabaseClient<Database> };
}

describe('getUserPlan', () => {
  test('returns the profile\'s plan when a row exists', async () => {
    const { client } = createPlanMockClient({ userId: 'user-123', planRow: { plan: 'pro' } });

    const result = await getUserPlan(client);

    expect(result).toBe('pro');
  });

  test('defaults to \'free\' when no profile row exists yet', async () => {
    const { client } = createPlanMockClient({ userId: 'user-123', planRow: null });

    const result = await getUserPlan(client);

    expect(result).toBe('free');
  });

  test('throws UserProfileError on a real database error', async () => {
    const { client } = createPlanMockClient({ userId: 'user-123', dbErrorMessage: 'connection reset' });

    await expectRejection(getUserPlan(client));
  });

  test('throws UserProfileError when there is no authenticated session', async () => {
    const { client } = createPlanMockClient({});

    await expectRejection(getUserPlan(client));
  });
});
