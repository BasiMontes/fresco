import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as nextServer from 'next/server';
import { snapshotWeeklyCost } from './snapshot-weekly-cost';

// FRESCO-1078 — the first cost computed for a week is stored once and never overwritten,
// and a failed write must never reach the page. `after` is replaced to run the callback at once.

interface UpdateCall { table?: string, payload?: unknown, filters: Array<[string, string, unknown]> }

let calls: UpdateCall[];
let updateError: { message: string } | null;
let afterSpy: ReturnType<typeof spyOn<typeof nextServer, 'after'>>;
let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;
let pending: Array<Promise<unknown>>;

function fakeSupabase() {
  return {
    from: (table: string) => {
      const call: UpdateCall = { table, filters: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {
        update: (payload: unknown) => { call.payload = payload; return chain; },
        eq: (column: string, value: unknown) => { call.filters.push(['eq', column, value]); return chain; },
        is: async (column: string, value: unknown) => { call.filters.push(['is', column, value]); return { error: updateError }; },
      };
      return chain;
    },
  } as unknown as SupabaseClient<Database>;
}

beforeEach(() => {
  calls = [];
  pending = [];
  updateError = null;
  afterSpy = spyOn(nextServer, 'after').mockImplementation((task: unknown) => { pending.push((task as () => Promise<unknown>)()); });
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  afterSpy.mockRestore();
  errorSpy.mockRestore();
});

const args = { userId: 'user-1', semanaIso: '2026-W45', costeEstimado: 42.5, spendTrend: [{ costeEstimado: null }] };

describe('snapshotWeeklyCost', () => {
  test('stores the cost of the week once, only where it is still empty', async () => {
    snapshotWeeklyCost(fakeSupabase(), args);
    await Promise.all(pending);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.table).toBe('meal_plans');
    expect(calls[0]?.payload).toEqual({ coste_estimado: 42.5 });
    expect(calls[0]?.filters).toEqual([['eq', 'user_id', 'user-1'], ['eq', 'semana_iso', '2026-W45'], ['is', 'coste_estimado', null]]);
  });

  test('does nothing when the week was already stored: no write is even scheduled', () => {
    snapshotWeeklyCost(fakeSupabase(), { ...args, spendTrend: [{ costeEstimado: 10 }, { costeEstimado: 12 }] });
    expect(afterSpy).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  test('a stored cost of zero still counts as stored', () => {
    snapshotWeeklyCost(fakeSupabase(), { ...args, spendTrend: [{ costeEstimado: 0 }] });
    expect(afterSpy).not.toHaveBeenCalled();
  });

  test('does nothing without a cost to store', () => {
    snapshotWeeklyCost(fakeSupabase(), { ...args, costeEstimado: undefined });
    expect(afterSpy).not.toHaveBeenCalled();
  });

  test('does nothing without a user', () => {
    snapshotWeeklyCost(fakeSupabase(), { ...args, userId: undefined });
    expect(afterSpy).not.toHaveBeenCalled();
  });

  test('an empty trend counts as not stored yet', async () => {
    snapshotWeeklyCost(fakeSupabase(), { ...args, spendTrend: [] });
    await Promise.all(pending);
    expect(calls).toHaveLength(1);
  });

  test('a failed write is logged and never thrown', async () => {
    updateError = { message: 'rls denied' };
    snapshotWeeklyCost(fakeSupabase(), args);
    await expect(Promise.all(pending)).resolves.toBeDefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('failed to persist coste_estimado'), { message: 'rls denied' });
  });
});
