import type { SupabaseClient } from '@supabase/supabase-js';
import type { OnboardingProfilePayload } from './user-profile';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { getShouldShowWelcomeNotice, getUserNombre, getUserPlan, markWelcomeNoticeSeen, updateNombre, upsertUserProfile, UserProfileError } from './user-profile';

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

/** Minimal mock client exposing `.update().eq()` — all `updateNombre()` calls. */
function createUpdateNombreMockClient(options: { userId?: string, updateErrorMessage?: string } = {}) {
  const updateCalls: unknown[] = [];

  const mock = {
    auth: {
      getUser: async () => (
        options.userId
          ? { data: { user: { id: options.userId } }, error: null }
          : { data: { user: null }, error: null }
      ),
    },
    from: () => ({
      update: (payload: unknown) => ({
        eq: async () => {
          updateCalls.push(payload);
          return { error: options.updateErrorMessage ? { message: options.updateErrorMessage } : null };
        },
      }),
    }),
  };

  return { client: mock as unknown as SupabaseClient<Database>, updateCalls };
}

describe('updateNombre', () => {
  test('updates the trimmed nombre for the authenticated user', async () => {
    const { client, updateCalls } = createUpdateNombreMockClient({ userId: 'user-123' });

    await updateNombre(client, '  Laura  ');

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toEqual({ nombre: 'Laura' });
  });

  test('throws UserProfileError for an empty string, without calling update', async () => {
    const { client, updateCalls } = createUpdateNombreMockClient({ userId: 'user-123' });

    await expectRejection(updateNombre(client, ''));
    expect(updateCalls).toHaveLength(0);
  });

  test('throws UserProfileError for a whitespace-only string, without calling update', async () => {
    const { client, updateCalls } = createUpdateNombreMockClient({ userId: 'user-123' });

    await expectRejection(updateNombre(client, '   '));
    expect(updateCalls).toHaveLength(0);
  });

  test('throws UserProfileError when there is no authenticated session', async () => {
    const { client } = createUpdateNombreMockClient({});

    await expectRejection(updateNombre(client, 'Laura'));
  });

  test('throws UserProfileError when the update itself fails', async () => {
    const { client } = createUpdateNombreMockClient({ userId: 'user-123', updateErrorMessage: 'constraint violation' });

    await expectRejection(updateNombre(client, 'Laura'));
  });
});

/** Minimal mock client exposing `.select().eq().maybeSingle()` — all `getUserNombre()` calls. */
function createNombreMockClient(options: { userId?: string, nombreRow?: { nombre: string | null } | null, dbErrorMessage?: string } = {}) {
  const getUserCalls: unknown[] = [];
  const eqCalls: unknown[] = [];

  const mock = {
    auth: {
      getUser: async () => {
        getUserCalls.push(undefined);
        return options.userId
          ? { data: { user: { id: options.userId } }, error: null }
          : { data: { user: null }, error: null };
      },
    },
    from: () => ({
      select: () => ({
        eq: (_column: string, value: string) => {
          eqCalls.push(value);
          return {
            maybeSingle: async () => ({
              data: options.dbErrorMessage ? null : (options.nombreRow ?? null),
              error: options.dbErrorMessage ? { message: options.dbErrorMessage } : null,
            }),
          };
        },
      }),
    }),
  };

  return { client: mock as unknown as SupabaseClient<Database>, getUserCalls, eqCalls };
}

describe('getUserNombre', () => {
  test('returns the profile\'s nombre when a row exists with a value', async () => {
    const { client } = createNombreMockClient({ userId: 'user-123', nombreRow: { nombre: 'Laura' } });

    const result = await getUserNombre(client);

    expect(result).toBe('Laura');
  });

  test('returns null when the row exists but nombre is unset', async () => {
    const { client } = createNombreMockClient({ userId: 'user-123', nombreRow: { nombre: null } });

    const result = await getUserNombre(client);

    expect(result).toBeNull();
  });

  test('returns null when no profile row exists yet', async () => {
    const { client } = createNombreMockClient({ userId: 'user-123', nombreRow: null });

    const result = await getUserNombre(client);

    expect(result).toBeNull();
  });

  test('throws UserProfileError on a real database error', async () => {
    const { client } = createNombreMockClient({ userId: 'user-123', dbErrorMessage: 'connection reset' });

    await expectRejection(getUserNombre(client));
  });

  test('throws UserProfileError when there is no authenticated session', async () => {
    const { client } = createNombreMockClient({});

    await expectRejection(getUserNombre(client));
  });

  test('without a userId argument, resolves the user via an internal auth.getUser() call', async () => {
    const { client, getUserCalls, eqCalls } = createNombreMockClient({ userId: 'user-123', nombreRow: { nombre: 'Laura' } });

    const result = await getUserNombre(client);

    expect(result).toBe('Laura');
    expect(getUserCalls).toHaveLength(1);
    expect(eqCalls).toEqual(['user-123']);
  });

  test('with a userId argument, skips the internal auth.getUser() call and queries by the given id', async () => {
    const { client, getUserCalls, eqCalls } = createNombreMockClient({ nombreRow: { nombre: 'Laura' } });

    const result = await getUserNombre(client, 'user-456');

    expect(result).toBe('Laura');
    expect(getUserCalls).toHaveLength(0);
    expect(eqCalls).toEqual(['user-456']);
  });
});

/** Minimal mock client exposing `.select().eq().maybeSingle()` — all `getShouldShowWelcomeNotice()` calls. */
function createWelcomeNoticeMockClient(options: { userId?: string, row?: { aviso_bienvenida_visto: boolean } | null, dbErrorMessage?: string } = {}) {
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
            data: options.dbErrorMessage ? null : (options.row ?? null),
            error: options.dbErrorMessage ? { message: options.dbErrorMessage } : null,
          }),
        }),
      }),
    }),
  };

  return { client: mock as unknown as SupabaseClient<Database> };
}

describe('getShouldShowWelcomeNotice', () => {
  test('returns true when a profile row exists and the notice is unseen', async () => {
    const { client } = createWelcomeNoticeMockClient({ userId: 'user-123', row: { aviso_bienvenida_visto: false } });

    const result = await getShouldShowWelcomeNotice(client);

    expect(result).toBe(true);
  });

  test('returns false when the notice was already seen', async () => {
    const { client } = createWelcomeNoticeMockClient({ userId: 'user-123', row: { aviso_bienvenida_visto: true } });

    const result = await getShouldShowWelcomeNotice(client);

    expect(result).toBe(false);
  });

  test('returns false when no profile row exists yet (onboarding not completed)', async () => {
    const { client } = createWelcomeNoticeMockClient({ userId: 'user-123', row: null });

    const result = await getShouldShowWelcomeNotice(client);

    expect(result).toBe(false);
  });

  test('throws UserProfileError on a real database error', async () => {
    const { client } = createWelcomeNoticeMockClient({ userId: 'user-123', dbErrorMessage: 'connection reset' });

    await expectRejection(getShouldShowWelcomeNotice(client));
  });

  test('throws UserProfileError when there is no authenticated session', async () => {
    const { client } = createWelcomeNoticeMockClient({});

    await expectRejection(getShouldShowWelcomeNotice(client));
  });
});

/** Minimal mock client exposing `.update().eq()` — all `markWelcomeNoticeSeen()` calls. */
function createMarkWelcomeNoticeSeenMockClient(options: { userId?: string, updateErrorMessage?: string } = {}) {
  const updateCalls: unknown[] = [];

  const mock = {
    auth: {
      getUser: async () => (
        options.userId
          ? { data: { user: { id: options.userId } }, error: null }
          : { data: { user: null }, error: null }
      ),
    },
    from: () => ({
      update: (payload: unknown) => ({
        eq: async () => {
          updateCalls.push(payload);
          return { error: options.updateErrorMessage ? { message: options.updateErrorMessage } : null };
        },
      }),
    }),
  };

  return { client: mock as unknown as SupabaseClient<Database>, updateCalls };
}

describe('markWelcomeNoticeSeen', () => {
  test('marks the notice as seen for the authenticated user', async () => {
    const { client, updateCalls } = createMarkWelcomeNoticeSeenMockClient({ userId: 'user-123' });

    await markWelcomeNoticeSeen(client);

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toEqual({ aviso_bienvenida_visto: true });
  });

  test('with a userId argument, skips the internal auth.getUser() call', async () => {
    const { client, updateCalls } = createMarkWelcomeNoticeSeenMockClient({});

    await markWelcomeNoticeSeen(client, 'user-456');

    expect(updateCalls).toHaveLength(1);
  });

  test('throws UserProfileError when there is no authenticated session', async () => {
    const { client } = createMarkWelcomeNoticeSeenMockClient({});

    await expectRejection(markWelcomeNoticeSeen(client));
  });

  test('throws UserProfileError when the update itself fails', async () => {
    const { client } = createMarkWelcomeNoticeSeenMockClient({ userId: 'user-123', updateErrorMessage: 'constraint violation' });

    await expectRejection(markWelcomeNoticeSeen(client));
  });
});
