import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { addIsoWeeks, getIsoWeek } from '@/lib/date/iso-week';
import { getSpendTrend, SpendTrendError } from './get-spend-trend';

const CURRENT_WEEK = getIsoWeek();

function createMockClient(options: {
  userId?: string
  rows?: { semana_iso: string, coste_estimado: number | null }[]
  errorMessage?: string
} = {}) {
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
          in: async () => ({
            data: options.errorMessage ? null : (options.rows ?? []),
            error: options.errorMessage ? { message: options.errorMessage } : null,
          }),
        }),
      }),
    }),
  };

  return { client: mock as unknown as SupabaseClient<Database> };
}

async function expectRejection(promise: Promise<unknown>) {
  let threw = false;
  try {
    await promise;
  }
  catch (error) {
    threw = true;
    expect(error).toBeInstanceOf(SpendTrendError);
  }
  expect(threw).toBe(true);
}

describe('getSpendTrend', () => {
  test('returns exactly 8 points, chronological, current week last', async () => {
    const { client } = createMockClient({ userId: 'user-123', rows: [] });

    const result = await getSpendTrend(client, CURRENT_WEEK);

    expect(result).toHaveLength(8);
    expect(result[7].semanaIso).toBe(CURRENT_WEEK);
    expect(result[0].semanaIso).toBe(addIsoWeeks(CURRENT_WEEK, -7));
  });

  test('a week with no meal_plans row surfaces as an explicit gap, not 0', async () => {
    const weekWithData = addIsoWeeks(CURRENT_WEEK, -1);
    const { client } = createMockClient({
      userId: 'user-123',
      rows: [{ semana_iso: weekWithData, coste_estimado: 42.5 }],
    });

    const result = await getSpendTrend(client, CURRENT_WEEK);

    const gapWeek = result.find(point => point.semanaIso === CURRENT_WEEK);
    const dataWeek = result.find(point => point.semanaIso === weekWithData);

    expect(gapWeek?.costeEstimado).toBeNull();
    expect(dataWeek?.costeEstimado).toBe(42.5);
  });

  test('a meal_plans row with coste_estimado still null surfaces as a gap too', async () => {
    const { client } = createMockClient({
      userId: 'user-123',
      rows: [{ semana_iso: CURRENT_WEEK, coste_estimado: null }],
    });

    const result = await getSpendTrend(client, CURRENT_WEEK);

    expect(result.find(point => point.semanaIso === CURRENT_WEEK)?.costeEstimado).toBeNull();
  });

  test('throws SpendTrendError when the read fails', async () => {
    const { client } = createMockClient({ userId: 'user-123', errorMessage: 'connection reset' });

    await expectRejection(getSpendTrend(client, CURRENT_WEEK));
  });

  test('throws SpendTrendError when there is no authenticated session', async () => {
    const { client } = createMockClient({});

    await expectRejection(getSpendTrend(client, CURRENT_WEEK));
  });
});
