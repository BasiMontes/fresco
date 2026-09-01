import type { createServiceClient } from '@/lib/supabase/service';
import { describe, expect, test } from 'bun:test';
import { sweepOrphanPaidPlans } from './route';

/**
 * FRESCO-360: unit coverage for the orphan-plan sweep — the second safety net
 * behind the `protect_subscription_columns` INSERT guard. Kept as a unit test
 * (not e2e) on purpose: exercising it through the real cron route would run
 * the global reconcile loop against every `user_profiles` row and could
 * downgrade a parallel e2e scenario's seeded Pro fixture mid-test.
 */

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
