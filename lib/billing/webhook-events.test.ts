import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, mock, test } from 'bun:test';
import { claimWebhookEvent, releaseWebhookEvent } from '@/lib/billing/webhook-events';

/**
 * FRESCO-816 (audit-6 A6-S10): the idempotency key of the Stripe webhook. A fake client
 * records what each call asked the table to do and answers with a chosen error.
 */

interface Recorded {
  inserted: unknown[]
  deletedWhere: Array<[string, unknown]>
}

function fakeClient(result: { error: { code?: string, message: string } | null }): { client: SupabaseClient<Database>, recorded: Recorded, table: ReturnType<typeof mock> } {
  const recorded: Recorded = { inserted: [], deletedWhere: [] };
  const table = mock((_name: string) => ({
    insert: async (row: unknown) => {
      recorded.inserted.push(row);
      return result;
    },
    delete: () => ({
      eq: async (column: string, value: unknown) => {
        recorded.deletedWhere.push([column, value]);
        return result;
      },
    }),
  }));
  return { client: { from: table } as unknown as SupabaseClient<Database>, recorded, table };
}

describe('claimWebhookEvent', () => {
  test('inserts the event id and type, and reports it as newly claimed', async () => {
    const { client, recorded, table } = fakeClient({ error: null });

    expect(await claimWebhookEvent(client, { eventId: 'evt_1', eventType: 'checkout.session.completed' })).toBe(true);
    expect(table).toHaveBeenCalledWith('stripe_webhook_events');
    expect(recorded.inserted).toEqual([{ event_id: 'evt_1', event_type: 'checkout.session.completed' }]);
  });

  test('reports false, without throwing, when an earlier delivery already holds the event', async () => {
    const { client } = fakeClient({ error: { code: '23505', message: 'duplicate key value' } });

    expect(await claimWebhookEvent(client, { eventId: 'evt_1', eventType: 'customer.subscription.updated' })).toBe(false);
  });

  test('throws on any other database error, so the caller can answer 500 and let Stripe retry', async () => {
    const { client } = fakeClient({ error: { code: '08006', message: 'connection failure' } });

    await expect(claimWebhookEvent(client, { eventId: 'evt_1', eventType: 'customer.subscription.updated' })).rejects.toMatchObject({ message: 'connection failure' });
  });
});

describe('releaseWebhookEvent', () => {
  test('deletes the row for that event id only', async () => {
    const { client, recorded } = fakeClient({ error: null });

    await releaseWebhookEvent(client, 'evt_9');

    expect(recorded.deletedWhere).toEqual([['event_id', 'evt_9']]);
  });

  test('throws on a write error', async () => {
    const { client } = fakeClient({ error: { message: 'boom' } });

    await expect(releaseWebhookEvent(client, 'evt_9')).rejects.toMatchObject({ message: 'boom' });
  });
});
