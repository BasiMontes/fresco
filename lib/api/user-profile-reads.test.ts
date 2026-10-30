import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { createMockClient } from '@/lib/fixtures/mock-supabase-client';
import { getHasUnseenNotifications, getPaymentFailedAt, getPlanTierForAnalytics, getUserDietaryPreferences, getUserOnboardingProfile, isPaymentFailedAlertActive, UserProfileError } from './user-profile';

/**
 * FRESCO-1072 (coverage tranche 4) — the read paths of `user_profiles` that no test loaded: the plan
 * tier for analytics, the failed-payment aviso, the unseen-notifications dot, and the two preference
 * reads. What matters in each: it reads the right user's row, a missing row falls back to a SAFE
 * default, and a real failure is not mistaken for "no row".
 */

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  }
  catch (error) {
    return error;
  }
  throw new Error('expected a rejection');
}

describe('getPlanTierForAnalytics', () => {
  test('returns the plan stored for that user and reads only that row', async () => {
    const { client, callsOf } = createMockClient({ data: { plan: 'pro' } });

    expect(await getPlanTierForAnalytics(client, 'user-1')).toBe('pro');
    expect(callsOf('from')).toEqual([['user_profiles']]);
    expect(callsOf('eq')).toEqual([['id', 'user-1']]);
  });

  test('is free when the user has no profile row yet', async () => {
    const { client } = createMockClient({ data: null });

    expect(await getPlanTierForAnalytics(client, 'user-1')).toBe('free');
  });

  test('never throws: an analytics property must not break a menu generation', async () => {
    const throwing = { from: () => { throw new Error('network down'); } } as unknown as SupabaseClient<Database>;

    expect(await getPlanTierForAnalytics(throwing, 'user-1')).toBe('free');
  });
});

describe('getPaymentFailedAt', () => {
  test('returns the failed-payment timestamp of the given user without resolving the session', async () => {
    const { client, callsOf } = createMockClient({ data: { payment_failed_at: '2026-10-01T10:00:00Z' } });

    expect(await getPaymentFailedAt(client, 'user-1')).toBe('2026-10-01T10:00:00Z');
    expect(callsOf('auth.getUser')).toEqual([]);
    expect(callsOf('eq')).toEqual([['id', 'user-1']]);
  });

  test('is null when there is no row, or the column is empty', async () => {
    expect(await getPaymentFailedAt(createMockClient({ data: null }).client, 'user-1')).toBeNull();
    expect(await getPaymentFailedAt(createMockClient({ data: { payment_failed_at: null } }).client, 'user-2')).toBeNull();
  });

  test('without a userId it resolves the signed-in user first', async () => {
    const { client, callsOf } = createMockClient({ userId: 'user-9', data: { payment_failed_at: null } });

    await getPaymentFailedAt(client);

    expect(callsOf('auth.getUser')).toHaveLength(1);
    expect(callsOf('eq')).toEqual([['id', 'user-9']]);
  });

  test('a real database error is not read as "no payment problem"', async () => {
    const { client } = createMockClient({ errorMessage: 'connection reset' });

    const error = await rejectionOf(getPaymentFailedAt(client, 'user-3'));

    expect(error).toBeInstanceOf(UserProfileError);
    expect((error as Error).message).toContain('connection reset');
  });

  test('no session and no userId is an error, not an anonymous read', async () => {
    const { client } = createMockClient({});

    expect(await rejectionOf(getPaymentFailedAt(client))).toBeInstanceOf(UserProfileError);
  });
});

describe('isPaymentFailedAlertActive', () => {
  test('is on only for a Pro plan with a failed-payment date', () => {
    expect(isPaymentFailedAlertActive('pro', '2026-10-01T10:00:00Z')).toBe(true);
  });

  test('a Pro plan with no failed payment has no alert', () => {
    expect(isPaymentFailedAlertActive('pro', null)).toBe(false);
  });

  test('a Free plan never shows it, even with a stale failed-payment date (downgraded after the retries)', () => {
    expect(isPaymentFailedAlertActive('free', '2026-10-01T10:00:00Z')).toBe(false);
  });
});

describe('getHasUnseenNotifications', () => {
  const seen = { aviso_bienvenida_visto: true, aviso_rutas_descartado: true, payment_failed_at: null, plan: 'free' };

  test('is false when there is no profile row yet: nothing is unseen', async () => {
    expect(await getHasUnseenNotifications(createMockClient({ data: null }).client, 'user-1')).toBe(false);
  });

  test('is false when everything was seen and nothing failed', async () => {
    expect(await getHasUnseenNotifications(createMockClient({ data: seen }).client, 'user-1')).toBe(false);
  });

  test('is true while the welcome notice is unseen', async () => {
    const { client } = createMockClient({ data: { ...seen, aviso_bienvenida_visto: false } });

    expect(await getHasUnseenNotifications(client, 'user-1')).toBe(true);
  });

  test('is true while the routes notice has not been dismissed', async () => {
    const { client } = createMockClient({ data: { ...seen, aviso_rutas_descartado: false } });

    expect(await getHasUnseenNotifications(client, 'user-1')).toBe(true);
  });

  test('is true for a Pro user with a failed payment, even when both notices were seen', async () => {
    const { client } = createMockClient({ data: { ...seen, plan: 'pro', payment_failed_at: '2026-10-01T10:00:00Z' } });

    expect(await getHasUnseenNotifications(client, 'user-1')).toBe(true);
  });

  test('is false for a Free user with a stale failed-payment date', async () => {
    const { client } = createMockClient({ data: { ...seen, payment_failed_at: '2026-10-01T10:00:00Z' } });

    expect(await getHasUnseenNotifications(client, 'user-1')).toBe(false);
  });

  test('reads the row of the given user, or of the signed-in one when none is given', async () => {
    const given = createMockClient({ data: seen });
    await getHasUnseenNotifications(given.client, 'user-1');
    expect(given.callsOf('auth.getUser')).toEqual([]);
    expect(given.callsOf('eq')).toEqual([['id', 'user-1']]);

    const signedIn = createMockClient({ userId: 'user-7', data: seen });
    await getHasUnseenNotifications(signedIn.client);
    expect(signedIn.callsOf('eq')).toEqual([['id', 'user-7']]);
  });

  test('a database error or a missing session is an error, never "nothing unseen"', async () => {
    expect(await rejectionOf(getHasUnseenNotifications(createMockClient({ errorMessage: 'boom' }).client, 'user-1'))).toBeInstanceOf(UserProfileError);
    expect(await rejectionOf(getHasUnseenNotifications(createMockClient({}).client))).toBeInstanceOf(UserProfileError);
  });
});

describe('getUserDietaryPreferences', () => {
  const saved = {
    num_personas: 4,
    adultos: 2,
    ninos: 2,
    dieta_vegetariano: true,
    dieta_vegano: false,
    dieta_sin_gluten: true,
    dieta_sin_lactosa: false,
    dieta_sin_huevo: false,
    dieta_keto: false,
    dieta_halal: false,
    alergenos: ['gluten', 'huevo'],
    ingredientes_odiados: ['cebolla'],
    cocinas_favoritas: ['española'],
  };

  test('returns the saved profile whole, so a save does not wipe fields the editor does not show', async () => {
    const { client, callsOf } = createMockClient({ data: saved });

    expect(await getUserDietaryPreferences(client, 'user-1')).toEqual(saved);
    expect(callsOf('eq')).toEqual([['id', 'user-1']]);
  });

  test('with no profile row it falls back to the onboarding defaults: nothing selected, two adults', async () => {
    const preferences = await getUserDietaryPreferences(createMockClient({ data: null }).client, 'user-1');

    expect(preferences).toMatchObject({ num_personas: 2, adultos: 2, ninos: 0, alergenos: [], ingredientes_odiados: [], cocinas_favoritas: [] });
    expect(Object.entries(preferences).filter(([key, value]) => key.startsWith('dieta_') && value === true)).toEqual([]);
  });

  test('a database error is an error: the editor must not show an empty profile as if it were the saved one', async () => {
    const error = await rejectionOf(getUserDietaryPreferences(createMockClient({ errorMessage: 'rls' }).client, 'user-1'));

    expect(error).toBeInstanceOf(UserProfileError);
    expect((error as Error).message).toContain('rls');
  });

  test('without a userId it resolves the signed-in user; with no session it is an error', async () => {
    const signedIn = createMockClient({ userId: 'user-5', data: saved });
    await getUserDietaryPreferences(signedIn.client);
    expect(signedIn.callsOf('auth.getUser')).toHaveLength(1);
    expect(signedIn.callsOf('eq')).toEqual([['id', 'user-5']]);

    expect(await rejectionOf(getUserDietaryPreferences(createMockClient({}).client))).toBeInstanceOf(UserProfileError);
  });
});

describe('getUserOnboardingProfile', () => {
  test('returns the saved onboarding profile of that user', async () => {
    const { client, callsOf } = createMockClient({ data: { nombre: 'Ana', adultos: 2 } });

    expect(await getUserOnboardingProfile(client, 'user-1')).toEqual({ nombre: 'Ana', adultos: 2 });
    expect(callsOf('eq')).toEqual([['id', 'user-1']]);
  });

  test('is null for a first-time visitor, so the wizard can start empty', async () => {
    expect(await getUserOnboardingProfile(createMockClient({ data: null }).client, 'user-1')).toBeNull();
  });

  test('a read failure throws: "Empezar" must not overwrite a profile it could not read', async () => {
    const error = await rejectionOf(getUserOnboardingProfile(createMockClient({ errorMessage: 'timeout' }).client, 'user-1'));

    expect(error).toBeInstanceOf(UserProfileError);
    expect((error as Error).message).toContain('timeout');
  });
});
