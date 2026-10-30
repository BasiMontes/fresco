import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as mealPlan from '@/lib/api/meal-plan';
import * as userProfile from '@/lib/api/user-profile';
import { loadPreferencesPageData, loadProfilePageData } from './load-profile-page-data';

/**
 * FRESCO-991 tranche 3 — `/profile` reads six things at once. The contract worth pinning is the
 * fallback of each one: a failing read must degrade to its own safe default and never take the
 * other five down. FRESCO-822 and FRESCO-917 chose the defaults for the trial and the health-data
 * consent on purpose (neither may default to the permissive value). FRESCO-1070 moved the consent
 * read to `/profile/preferences`, so it is pinned in `loadPreferencesPageData` below.
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
    });
    expect(s.plan).toHaveBeenCalledWith(supabase, 'user-1');
  });

  test('does not read the health-data consent: the form that needs it is on another page', async () => {
    await loadProfilePageData(supabase, 'user-1');

    expect(s.consent).not.toHaveBeenCalled();
  });

  test('every failing read falls back to its own safe default', async () => {
    for (const spy of Object.values(s)) { spy.mockRejectedValue(new Error('db down')); }

    const data = await loadProfilePageData(supabase, 'user-1');

    expect(data.plan).toBe('free');
    expect(data.paymentFailedAt).toBeNull();
    expect(data.nombre).toBeNull();
    expect(data.pastWeeks).toEqual([]);
    expect(data.dietaryPreferences).toMatchObject({ num_personas: 2, adultos: 2, ninos: 0, alergenos: [], dieta_vegano: false });
    expect(consoleError).toHaveBeenCalledTimes(6);
  });

  test('an unreadable trial is never promised', async () => {
    s.trial.mockRejectedValue(new Error('boom'));

    const data = await loadProfilePageData(supabase, 'user-1');

    expect(data.trialAvailable).toBe(false);
  });

  test('one failing read does not take the others down', async () => {
    s.nombre.mockRejectedValue(new Error('boom'));

    const data = await loadProfilePageData(supabase, 'user-1');

    expect(data.nombre).toBeNull();
    expect(data.plan).toBe('pro');
    expect(data.trialAvailable).toBe(true);
  });
});

describe('loadPreferencesPageData (FRESCO-1070)', () => {
  let preferences: ReturnType<typeof spyOn>;
  let consent: ReturnType<typeof spyOn>;
  let consoleError: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleError = spyOn(console, 'error').mockImplementation(() => {});
    preferences = spyOn(userProfile, 'getUserDietaryPreferences').mockResolvedValue(PREFERENCES);
    consent = spyOn(userProfile, 'getHasHealthDataConsent').mockResolvedValue(true);
  });

  afterEach(() => {
    preferences.mockRestore();
    consent.mockRestore();
    consoleError.mockRestore();
  });

  test('returns the saved preferences and the consent', async () => {
    const data = await loadPreferencesPageData(supabase, 'user-1');

    expect(data).toEqual({ dietaryPreferences: PREFERENCES, hasHealthDataConsent: true });
    expect(preferences).toHaveBeenCalledWith(supabase, 'user-1');
    expect(consent).toHaveBeenCalledWith(supabase, 'user-1');
  });

  test('an unreadable profile falls back to empty preferences and an unreadable consent is asked again', async () => {
    preferences.mockRejectedValue(new Error('db down'));
    consent.mockRejectedValue(new Error('db down'));

    const data = await loadPreferencesPageData(supabase, 'user-1');

    expect(data.dietaryPreferences).toMatchObject({ alergenos: [], dieta_vegano: false });
    expect(data.hasHealthDataConsent).toBe(false);
    expect(consoleError).toHaveBeenCalledTimes(2);
  });

  test('one failing read does not take the other down', async () => {
    consent.mockRejectedValue(new Error('boom'));

    const data = await loadPreferencesPageData(supabase, 'user-1');

    expect(data.dietaryPreferences).toBe(PREFERENCES);
    expect(data.hasHealthDataConsent).toBe(false);
  });
});
