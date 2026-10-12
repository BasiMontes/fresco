import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, mock, test } from 'bun:test';
import { claimWebhookEvent, completeWebhookEvent, releaseWebhookEvent, WEBHOOK_CLAIM_TTL_MS } from '@/lib/billing/webhook-events';

/**
 * FRESCO-816 / FRESCO-909 (audit-6 A6-S10, definitive audit C-03): the idempotency key of
 * the Stripe webhook, with an expirable claim and an explicit completed state. A fake
 * client records what each call asked the table to do and answers with chosen results.
 */

const INSERTED_AT = '2026-10-12T10:00:00.123456+00:00';

type DbError = { code?: string, message: string } | null;

interface Fake {
  insertError: DbError
  /** What the follow-up read of the existing row answers. */
  row: { claimed_at: string, completed_at: string | null } | null
  /** Rows the compare-and-swap update reports as changed. */
  casRows: Array<{ event_id: string }>
  writeError: DbError
}

interface Recorded {
  inserted: unknown[]
  deletedWhere: Array<[string, string, unknown]>
  updates: Array<{ patch: Record<string, unknown>, filters: Array<[string, string, unknown]> }>
}

function fakeClient(overrides: Partial<Fake> = {}): { client: SupabaseClient<Database>, recorded: Recorded } {
  const fake: Fake = { insertError: null, row: null, casRows: [], writeError: null, ...overrides };
  const recorded: Recorded = { inserted: [], deletedWhere: [], updates: [] };
  const table = mock((_name: string) => ({
    insert: (row: unknown) => {
      recorded.inserted.push(row);
      return {
        select: () => ({
          single: async () => ({ data: fake.insertError ? null : { claimed_at: INSERTED_AT }, error: fake.insertError }),
        }),
      };
    },
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: fake.row, error: null }) }),
    }),
    update: (patch: Record<string, unknown>) => {
      const entry = { patch, filters: [] as Array<[string, string, unknown]> };
      recorded.updates.push(entry);
      const chain = {
        eq: (column: string, value: unknown) => {
          entry.filters.push(['eq', column, value]);
          return chain;
        },
        is: (column: string, value: unknown) => {
          entry.filters.push(['is', column, value]);
          return chain;
        },
        select: async () => ({ data: fake.casRows, error: fake.writeError }),
        then: (resolve: (v: { error: DbError }) => void) => resolve({ error: fake.writeError }),
      };
      return chain;
    },
    delete: () => {
      const chain = {
        eq: (column: string, value: unknown) => {
          recorded.deletedWhere.push(['eq', column, value]);
          return chain;
        },
        is: (column: string, value: unknown) => {
          recorded.deletedWhere.push(['is', column, value]);
          return chain;
        },
        then: (resolve: (v: { error: DbError }) => void) => resolve({ error: fake.writeError }),
      };
      return chain;
    },
  }));
  return { client: { from: table } as unknown as SupabaseClient<Database>, recorded };
}

const EVENT = { eventId: 'evt_1', eventType: 'checkout.session.completed' };
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

describe('claimWebhookEvent', () => {
  test('a free event is inserted with its id and type and reported as claimed', async () => {
    const { client, recorded } = fakeClient();

    expect(await claimWebhookEvent(client, EVENT)).toEqual({ state: 'claimed', claimedAt: INSERTED_AT });
    expect(recorded.inserted).toEqual([{ event_id: 'evt_1', event_type: 'checkout.session.completed' }]);
  });

  test('an event whose earlier run completed is already_done', async () => {
    const { client, recorded } = fakeClient({
      insertError: { code: '23505', message: 'duplicate key value' },
      row: { claimed_at: ago(2 * WEBHOOK_CLAIM_TTL_MS), completed_at: ago(WEBHOOK_CLAIM_TTL_MS) },
    });

    expect(await claimWebhookEvent(client, EVENT)).toEqual({ state: 'already_done' });
    expect(recorded.updates).toEqual([]);
  });

  test('a claim younger than the TTL with no completion is in_flight and is left alone', async () => {
    const { client, recorded } = fakeClient({
      insertError: { code: '23505', message: 'duplicate key value' },
      row: { claimed_at: ago(WEBHOOK_CLAIM_TTL_MS / 2), completed_at: null },
    });

    expect(await claimWebhookEvent(client, EVENT)).toEqual({ state: 'in_flight' });
    expect(recorded.updates).toEqual([]);
  });

  test('a claim older than the TTL with no completion is taken over by a compare-and-swap on the observed claimed_at', async () => {
    const observed = ago(WEBHOOK_CLAIM_TTL_MS + 60_000);
    const { client, recorded } = fakeClient({
      insertError: { code: '23505', message: 'duplicate key value' },
      row: { claimed_at: observed, completed_at: null },
      casRows: [{ event_id: 'evt_1' }],
    });

    const result = await claimWebhookEvent(client, EVENT);
    expect(recorded.updates).toHaveLength(1);

    expect(result.state).toBe('taken_over');
    expect(result).toMatchObject({ claimAgeSeconds: 360, claimedAt: recorded.updates[0].patch.claimed_at });
    expect(recorded.updates).toHaveLength(1);
    expect(recorded.updates[0].patch).toHaveProperty('claimed_at');
    expect(recorded.updates[0].filters).toEqual([
      ['eq', 'event_id', 'evt_1'],
      ['is', 'completed_at', null],
      ['eq', 'claimed_at', observed],
    ]);
  });

  test('losing the compare-and-swap (0 rows) means another worker took it: in_flight', async () => {
    const { client } = fakeClient({
      insertError: { code: '23505', message: 'duplicate key value' },
      row: { claimed_at: ago(WEBHOOK_CLAIM_TTL_MS + 60_000), completed_at: null },
      casRows: [],
    });

    expect(await claimWebhookEvent(client, EVENT)).toEqual({ state: 'in_flight' });
  });

  test('throws on any other database error, so the caller can answer 500 and let Stripe retry', async () => {
    const { client } = fakeClient({ insertError: { code: '08006', message: 'connection failure' } });

    await expect(claimWebhookEvent(client, EVENT)).rejects.toMatchObject({ message: 'connection failure' });
  });
});

describe('claim retries', () => {
  test('a row that keeps vanishing between the insert and the read gives up after 3 attempts and throws', async () => {
    const { client, recorded } = fakeClient({ insertError: { code: '23505', message: 'duplicate key value' }, row: null });

    await expect(claimWebhookEvent(client, EVENT)).rejects.toBeDefined();
    expect(recorded.inserted).toHaveLength(3);
  });
});

describe('completeWebhookEvent', () => {
  test('stamps completed_at only on the claim this worker holds', async () => {
    const { client, recorded } = fakeClient();

    await completeWebhookEvent(client, { eventId: 'evt_9', claimedAt: INSERTED_AT });

    expect(recorded.updates).toHaveLength(1);
    expect(recorded.updates[0].patch).toHaveProperty('completed_at');
    expect(recorded.updates[0].filters).toEqual([['eq', 'event_id', 'evt_9'], ['eq', 'claimed_at', INSERTED_AT]]);
  });

  test('throws on a write error', async () => {
    const { client } = fakeClient({ writeError: { message: 'boom' } });

    await expect(completeWebhookEvent(client, { eventId: 'evt_9', claimedAt: INSERTED_AT })).rejects.toMatchObject({ message: 'boom' });
  });
});

describe('releaseWebhookEvent', () => {
  test('deletes the row only while it is still the uncompleted claim this worker holds', async () => {
    const { client, recorded } = fakeClient();

    await releaseWebhookEvent(client, { eventId: 'evt_9', claimedAt: INSERTED_AT });

    expect(recorded.deletedWhere).toEqual([['eq', 'event_id', 'evt_9'], ['eq', 'claimed_at', INSERTED_AT], ['is', 'completed_at', null]]);
  });

  test('throws on a write error', async () => {
    const { client } = fakeClient({ writeError: { message: 'boom' } });

    await expect(releaseWebhookEvent(client, { eventId: 'evt_9', claimedAt: INSERTED_AT })).rejects.toMatchObject({ message: 'boom' });
  });
});
