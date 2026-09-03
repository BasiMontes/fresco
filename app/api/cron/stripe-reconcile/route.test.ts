import type { createServiceClient } from '@/lib/supabase/service';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import * as realStripe from '@/lib/stripe';
import { fakeSupabase } from '@/tests/mocks/supabase-query-builder';

/**
 * FRESCO-360: unit coverage for the orphan-plan sweep — the second safety net
 * behind the `protect_subscription_columns` INSERT guard. Kept as a unit test
 * (not e2e) on purpose: exercising it through the real cron route would run
 * the global reconcile loop against every `user_profiles` row and could
 * downgrade a parallel e2e scenario's seeded Pro fixture mid-test.
 *
 * FRESCO-410: plus the `GET` handler's auth + config gate.
 */

let supa = fakeSupabase();
void mock.module('@/lib/supabase/service', () => ({ createServiceClient: () => supa.client }));
void mock.module('@/lib/stripe', () => ({
  ...realStripe,
  stripe: { subscriptions: { retrieve: async () => ({}) } },
}));

const { GET, sweepOrphanPaidPlans } = await import('./route');

interface OrphanRow { id: string, plan: 'pro' | 'family' }

function fakeClient(opts: { orphans?: OrphanRow[], loadError?: unknown, failIds?: string[] }) {
  const updated: string[] = [];
  const client = {
    from() {
      return {
        select() {
          return {
            in() {
              return {
                is: async () => ({ data: opts.orphans ?? [], error: opts.loadError ?? null }),
              };
            },
          };
        },
        update() {
          return {
            eq: async (_col: string, id: string) => {
              if (opts.failIds?.includes(id)) { return { error: new Error(`update failed for ${id}`) }; }
              updated.push(id);
              return { error: null };
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as ReturnType<typeof createServiceClient>, updated };
}

describe('sweepOrphanPaidPlans', () => {
  test('downgrades every pro/family row that has no stripe_subscription_id', async () => {
    const { client, updated } = fakeClient({
      orphans: [
        { id: 'a', plan: 'pro' },
        { id: 'b', plan: 'family' },
      ],
    });

    const swept = await sweepOrphanPaidPlans(client);

    expect(swept).toBe(2);
    expect(updated).toEqual(['a', 'b']);
  });

  test('returns 0 and writes nothing when there are no orphans', async () => {
    const { client, updated } = fakeClient({ orphans: [] });

    expect(await sweepOrphanPaidPlans(client)).toBe(0);
    expect(updated).toEqual([]);
  });

  test('returns 0 on a load error without attempting any update', async () => {
    const { client, updated } = fakeClient({ loadError: new Error('boom'), orphans: [{ id: 'a', plan: 'pro' }] });

    expect(await sweepOrphanPaidPlans(client)).toBe(0);
    expect(updated).toEqual([]);
  });

  test('skips a row whose update fails and still sweeps the rest', async () => {
    const { client, updated } = fakeClient({
      orphans: [
        { id: 'a', plan: 'pro' },
        { id: 'b', plan: 'pro' },
        { id: 'c', plan: 'family' },
      ],
      failIds: ['b'],
    });

    const swept = await sweepOrphanPaidPlans(client);

    expect(swept).toBe(2);
    expect(updated).toEqual(['a', 'c']);
  });
});

describe('GET /api/cron/stripe-reconcile — auth + config gate', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    process.env.CRON_SECRET = 'cron_test';
    process.env.STRIPE_PRICE_ID_PRO_MONTH = 'price_pro_month';
    supa = fakeSupabase({ user_profiles: { rows: [] } });
  });
  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  function req(headers: Record<string, string> = {}) {
    return new Request('https://test.fresco.local/api/cron/stripe-reconcile', { headers });
  }

  test('500 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req({ authorization: 'Bearer cron_test' }));
    expect(res.status).toBe(500);
  });

  test('401 when the Authorization header does not match', async () => {
    const res = await GET(req({ authorization: 'Bearer wrong' }));
    expect(res.status).toBe(401);
  });

  test('401 when there is no Authorization header', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  test('500 when STRIPE_PRICE_ID_PRO_MONTH is not set', async () => {
    delete process.env.STRIPE_PRICE_ID_PRO_MONTH;
    const res = await GET(req({ authorization: 'Bearer cron_test' }));
    expect(res.status).toBe(500);
  });

  test('200 with a zero-drift summary when authorised and no profiles carry a subscription', async () => {
    const res = await GET(req({ authorization: 'Bearer cron_test' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ checked: 0, reconciled: 0, sweptOrphans: 0 });
  });
});
