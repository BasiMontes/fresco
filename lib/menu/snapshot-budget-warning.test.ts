import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as nextServer from 'next/server';
import { snapshotBudgetWarning } from './snapshot-budget-warning';

// FRESCO-1269 (QAFRESCO-2) — the budget warning the page shows is also what `meal_plans.advertencias` holds,
// written only when it changed, and a failed write never reaches the page. `after` runs its callback at once.

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
        // The second `.eq` ends the chain and is awaited; the first returns the chain itself, so it cannot be `async`.
        // eslint-disable-next-line ts/promise-function-async
        eq: (column: string, value: unknown) => {
          call.filters.push(['eq', column, value]);
          return call.filters.length === 2 ? Promise.resolve({ error: updateError }) : chain;
        },
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

const AVISO = 'El menú supera tu presupuesto semanal en aproximadamente 7.32€';
const args = { mealPlanId: 'plan-1', userId: 'user-1', stored: ['otra'], shown: ['otra', AVISO] };

describe('snapshotBudgetWarning', () => {
  test('stores the warnings shown, on the user\'s own plan', async () => {
    snapshotBudgetWarning(fakeSupabase(), args);
    await Promise.all(pending);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.table).toBe('meal_plans');
    expect(calls[0]?.payload).toEqual({ advertencias: ['otra', AVISO] });
    expect(calls[0]?.filters).toEqual([['eq', 'id', 'plan-1'], ['eq', 'user_id', 'user-1']]);
  });

  test('writes nothing when what is stored already is what is shown', async () => {
    snapshotBudgetWarning(fakeSupabase(), { ...args, stored: ['otra', AVISO] });
    await Promise.all(pending);

    expect(calls).toHaveLength(0);
  });

  test('clears a stored budget warning once the menu is back within budget', async () => {
    snapshotBudgetWarning(fakeSupabase(), { ...args, stored: ['otra', AVISO], shown: ['otra'] });
    await Promise.all(pending);

    expect(calls[0]?.payload).toEqual({ advertencias: ['otra'] });
  });

  test('writes nothing without a user', async () => {
    snapshotBudgetWarning(fakeSupabase(), { ...args, userId: undefined });
    await Promise.all(pending);

    expect(calls).toHaveLength(0);
  });

  test('does not send a list the table would reject (more than 20 entries)', async () => {
    snapshotBudgetWarning(fakeSupabase(), { ...args, stored: [], shown: Array.from({ length: 21 }, (_, i) => `aviso ${i}`) });
    await Promise.all(pending);

    expect(calls).toHaveLength(0);
  });

  test('a failed write is logged and never thrown', async () => {
    updateError = { message: 'boom' };
    snapshotBudgetWarning(fakeSupabase(), args);
    await Promise.all(pending);

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
