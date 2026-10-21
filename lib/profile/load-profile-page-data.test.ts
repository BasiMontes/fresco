import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as mealPlan from '@/lib/api/meal-plan';
import * as userProfile from '@/lib/api/user-profile';
import { loadProfilePageData } from './load-profile-page-data';

/**
 * FRESCO-991 tranche 3 — `/profile` reads seven things at once. The contract worth pinning is the
 * fallback of each one: a failing read must degrade to its own safe default and never take the
 * other six down. FRESCO-822 and FRESCO-917 chose the defaults for the trial and the health-data
 * consent on purpose (neither may default to the permissive value).
 */

const supabase = {} as SupabaseClient<Database>;
const PREFERENCES = { num_personas: 3 } as never;

function spies() {
  return {
    plan: spyOn(userProfile, 'getUserPlan'),
    paymentFailedAt: spyOn(userProfile, 'getPaymentFailedAt'),
    nombre: spyOn(userProfile, 'getUserNombre'),
    preferences: spyOn(userProfile, 'getUserDietaryPreferences'),
    trial: spyOn(userProfile, 'getUserTrialAvailable'),
    consent: spyOn(userProfile, 'getHasHealthDataConsent'),
    weeks: spyOn(mealPlan, 'listPastMealPlanWeeks'),
  };
}

describe('loadProfilePageData', () => {
  let s: ReturnType<typeof spies>;
  let consoleError: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleError = spyOn(console, 'error').mockImplementation(() => {});
    s = spies();
    s.plan.mockResolvedValue('pro');
    s.paymentFailedAt.mockResolvedValue('2026-10-01T00:00:00Z');
    s.nombre.mockResolvedValue('Ana');
    s.preferences.mockResolvedValue(PREFERENCES);
    s.trial.mockResolvedValue(true);
    s.consent.mockResolvedValue(true);
    s.weeks.mockResolvedValue([{ semana_iso: '2026-W41' }] as never);
  });

  afterEach(() => {
    for (const spy of Object.values(s)) { spy.mockRestore(); }
    consoleError.mockRestore();
  });

  test('returns every read when all succeed', async () => {
    const data = await loadProfilePageData(supabase, 'user-1');

    expect(data).toEqual({
      plan: 'pro',
      paymentFailedAt: '2026-10-01T00:00:00Z',
      nombre: 'Ana',
      dietaryPreferences: PREFERENCES,
      pastWeeks: [{ semana_iso: '2026-W41' }],
      trialAvailable: true,
      hasHealthDataConsent: true,
    });
    expect(s.plan).toHaveBeenCalledWith(supabase, 'user-1');
  });

  test('every failing read falls back to its own safe default', async () => {
    for (const spy of Object.values(s)) { spy.mockRejectedValue(new Error('db down')); }

    const data = await loadProfilePageData(supabase, 'user-1');

    expect(data.plan).toBe('free');
    expect(data.paymentFailedAt).toBeNull();
    expect(data.nombre).toBeNull();
    expect(data.pastWeeks).toEqual([]);
    expect(data.dietaryPreferences).toMatchObject({ num_personas: 2, adultos: 2, ninos: 0, alergenos: [], dieta_vegano: false });
    expect(consoleError).toHaveBeenCalledTimes(7);
  });

  test('an unreadable trial is never promised and an unreadable consent is asked again', async () => {
    s.trial.mockRejectedValue(new Error('boom'));
    s.consent.mockRejectedValue(new Error('boom'));

    const data = await loadProfilePageData(supabase, 'user-1');

    expect(data.trialAvailable).toBe(false);
    expect(data.hasHealthDataConsent).toBe(false);
  });

  test('one failing read does not take the others down', async () => {
    s.nombre.mockRejectedValue(new Error('boom'));

    const data = await loadProfilePageData(supabase, 'user-1');

    expect(data.nombre).toBeNull();
    expect(data.plan).toBe('pro');
    expect(data.trialAvailable).toBe(true);
  });
});
