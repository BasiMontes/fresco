import { describe, expect, test } from 'bun:test';
import { applyReconciledState, listSubscribedProfiles } from '@/lib/billing/reconcile';
import { createMockClient } from '@/lib/fixtures/mock-supabase-client';

// `sweepOrphanPaidPlans` is covered by `app/api/cron/stripe-reconcile/route.test.ts`.

/**
 * A fake of the query `listSubscribedProfiles` builds. It records what was asked (columns, filter, order, each
 * range) and serves `rows` by range like PostgREST does, optionally capped at `maxRows` per response.
 */
function pagedClient({ rows, maxRows = Infinity, errorOnPage }: { rows: unknown[], maxRows?: number, errorOnPage?: number }) {
  const asked = { select: [] as string[], not: [] as unknown[][], order: [] as string[], ranges: [] as Array<[number, number]> };
  let calls = 0;
  const chain = {
    select: (columns: string) => { asked.select.push(columns); return chain; },
    not: (...args: unknown[]) => { asked.not.push(args); return chain; },
    order: (column: string) => { asked.order.push(column); return chain; },
    range: async (from: number, to: number) => {
      asked.ranges.push([from, to]);
      calls++;
      if (errorOnPage === calls) { return { data: null, error: { message: 'boom' } }; }
      return { data: rows.slice(from, Math.min(to, from + maxRows - 1) + 1), error: null };
    },
  };
  const client = { from: () => chain } as unknown as Parameters<typeof listSubscribedProfiles>[0];
  return { client, asked };
}

const profileRow = (i: number) => ({ id: `u${String(i).padStart(5, '0')}`, plan: 'pro', plan_expires_at: null, payment_failed_at: null, stripe_subscription_id: `sub_${i}`, stripe_customer_id: `cus_${i}`, stripe_livemode: false });

describe('listSubscribedProfiles', () => {
  test('selects the comparison columns of every profile that has a Stripe subscription, ordered by id', async () => {
    const rows = [profileRow(1)];
    const { client, asked } = pagedClient({ rows });

    expect(await listSubscribedProfiles(client)).toEqual(rows);
    // The query is built once per page (here two: the rows and the empty page that ends the read): every one asks the same.
    expect(new Set(asked.select)).toEqual(new Set(['id, plan, plan_expires_at, payment_failed_at, stripe_subscription_id, stripe_customer_id, stripe_livemode']));
    expect(asked.not.every(args => args[0] === 'stripe_subscription_id' && args[1] === 'is' && args[2] === null)).toBe(true);
    expect(new Set(asked.order)).toEqual(new Set(['id']));
  });

  // FRESCO-1165 (integral review PAY-N6): the query had no range, so PostgREST's `max_rows` (1000) cut the list
  // and the profiles past it were never reconciled.
  test('returns every profile when there are more than one page of them', async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => profileRow(i));
    const { client, asked } = pagedClient({ rows });

    const listed = await listSubscribedProfiles(client);

    expect(listed).toHaveLength(2500);
    expect(new Set(listed.map(row => row.id)).size).toBe(2500);
    expect(asked.ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999], [2500, 3499]]);
  });

  test('exactly one full page still ends: the next, empty page says there is no more', async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => profileRow(i));
    const { client, asked } = pagedClient({ rows });

    expect(await listSubscribedProfiles(client)).toHaveLength(1000);
    expect(asked.ranges).toEqual([[0, 999], [1000, 1999]]);
  });

  test('a server cap lower than the page does not skip rows', async () => {
    const rows = Array.from({ length: 1200 }, (_, i) => profileRow(i));
    const { client } = pagedClient({ rows, maxRows: 500 });

    const listed = await listSubscribedProfiles(client);

    expect(listed).toHaveLength(1200);
    expect(new Set(listed.map(row => row.id)).size).toBe(1200);
  });

  test('returns an empty list when nothing matches', async () => {
    expect(await listSubscribedProfiles(pagedClient({ rows: [] }).client)).toEqual([]);
  });

  test('throws on a read failure, also in a later page, instead of reconciling half the list', async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => profileRow(i));

    for (const errorOnPage of [1, 2]) {
      let error: unknown;
      try {
        await listSubscribedProfiles(pagedClient({ rows, errorOnPage }).client);
      }
      catch (caught) {
        error = caught;
      }
      expect((error as Error).message).toContain('boom');
    }
  });
});

describe('applyReconciledState', () => {
  test('writes the desired state onto that one profile and nothing else', async () => {
    const { client, callsOf } = createMockClient();
    const desired = { plan: 'pro' as const, payment_failed_at: null, plan_expires_at: '2026-12-01T00:00:00.000Z' };

    await applyReconciledState(client, { profileId: 'user-1', desired });

    expect(callsOf('update')).toEqual([[desired]]);
    expect(callsOf('eq')).toEqual([['id', 'user-1']]);
  });
});
