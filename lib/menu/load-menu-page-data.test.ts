import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as favorites from '@/lib/api/favorites';
import * as mealPlan from '@/lib/api/meal-plan';
import * as recipes from '@/lib/api/recipes';
import * as userProfile from '@/lib/api/user-profile';
import * as spendTrend from '@/lib/menu/get-spend-trend';
import { loadMenuPageData } from './load-menu-page-data';

/**
 * FRESCO-991 tranche 3 — `/menu` reads eight things at once, each with its own conservative
 * fallback. The one worth pinning hardest: a failed meal-plan read falls back to the empty state
 * instead of crashing the page, and a failed count hides the card instead of showing a "0" that
 * would read as an empty catalog.
 */

const supabase = {} as SupabaseClient<Database>;
const ARGS = { userId: 'user-1', semanaIso: '2026-W43' };

function spies() {
  return {
    nombre: spyOn(userProfile, 'getUserNombre'),
    count: spyOn(recipes, 'getAvailableRecipesCount'),
    latest: spyOn(recipes, 'getLatestAvailableRecipes'),
    plan: spyOn(mealPlan, 'getMealPlanForWeek'),
    favorites: spyOn(favorites, 'getFavoriteRecipeIds'),
    preferences: spyOn(userProfile, 'getUserDietaryPreferences'),
    unseen: spyOn(userProfile, 'getHasUnseenNotifications'),
    trend: spyOn(spendTrend, 'getSpendTrend'),
  };
}

describe('loadMenuPageData', () => {
  let s: ReturnType<typeof spies>;
  let consoleError: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleError = spyOn(console, 'error').mockImplementation(() => {});
    s = spies();
    s.nombre.mockResolvedValue('Ana');
    s.count.mockResolvedValue(540);
    s.latest.mockResolvedValue([{ id: 'r1' }] as never);
    s.plan.mockResolvedValue({ semana_iso: '2026-W43' } as never);
    s.favorites.mockResolvedValue(new Set(['r1']));
    s.preferences.mockResolvedValue({ num_personas: 2 } as never);
    s.unseen.mockResolvedValue(true);
    s.trend.mockResolvedValue([{ semana: '2026-W42', coste: 40 }] as never);
  });

  afterEach(() => {
    for (const spy of Object.values(s)) { spy.mockRestore(); }
    consoleError.mockRestore();
  });

  test('returns every read when all succeed and passes the week to the spend trend', async () => {
    const data = await loadMenuPageData(supabase, ARGS);

    expect(data.nombre).toBe('Ana');
    expect(data.recetasDisponibles).toBe(540);
    expect(data.ultimasRecetas).toEqual([{ id: 'r1' }]);
    expect(data.plan).toEqual({ semana_iso: '2026-W43' });
    expect(data.favoriteIds).toEqual(new Set(['r1']));
    expect(data.hasUnseenNotifications).toBe(true);
    expect(s.trend).toHaveBeenCalledWith(supabase, { semanaIso: '2026-W43', userId: 'user-1' });
  });

  test('every failing read falls back to its own conservative default', async () => {
    for (const spy of Object.values(s)) { spy.mockRejectedValue(new Error('db down')); }

    const data = await loadMenuPageData(supabase, ARGS);

    expect(data).toEqual({
      nombre: null,
      recetasDisponibles: null,
      ultimasRecetas: [],
      plan: null,
      favoriteIds: new Set(),
      dietaryPreferences: null,
      hasUnseenNotifications: false,
      spendTrend: [],
    });
    expect(consoleError).toHaveBeenCalledTimes(8);
  });

  test('a failed meal-plan read shows the empty state and leaves the rest intact', async () => {
    s.plan.mockRejectedValue(new Error('network'));

    const data = await loadMenuPageData(supabase, ARGS);

    expect(data.plan).toBeNull();
    expect(data.recetasDisponibles).toBe(540);
    expect(data.nombre).toBe('Ana');
  });
});
