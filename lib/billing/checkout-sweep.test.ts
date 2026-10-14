import type Stripe from 'stripe';
import type { createServiceClient } from '@/lib/supabase/service';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { sweepPaidCheckoutsWithoutPro } from '@/lib/billing/checkout-sweep';

/**
 * FRESCO-909 (audit C-03): the inverse sweep. The Stripe listing and the grant are
 * stubbed through the sweep's own seams (no `mock.module`, which would leak into the
 * webhook tests that use the real grant); what is under test is WHICH sessions reach it.
 */

let sessions: Stripe.Checkout.Session[] = [];
const list = mock((_params: unknown) => (async function* () {
  for (const session of sessions) {
    yield session;
  }
})());
const grant = mock(async (_client: unknown, _session: Stripe.Checkout.Session): Promise<void> => {});

type Client = ReturnType<typeof createServiceClient>;
type SweepDeps = NonNullable<Parameters<typeof sweepPaidCheckoutsWithoutPro>[1]>;

const run = async (client: Client) => sweepPaidCheckoutsWithoutPro(client, {
  stripeClient: { checkout: { sessions: { list } } } as unknown as SweepDeps['stripeClient'],
  grant,
});

/** `stored` maps a user id to the `stripe_subscription_id` on its row (absent = no row value). */
function clientWithStored(stored: Record<string, string | null>, opts: { failFor?: string } = {}): Client {
  return {
    from: () => ({
      select: () => ({
        eq: (_column: string, userId: string) => ({
          maybeSingle: async () => userId === opts.failFor
            ? { data: null, error: new Error('read failed') }
            : { data: { stripe_subscription_id: stored[userId] ?? null }, error: null },
        }),
      }),
    }),
  } as unknown as Client;
}

function session(overrides: Partial<{ id: string, userId: string | null, subscription: string | null, mode: string, status: string }> = {}): Stripe.Checkout.Session {
  return {
    id: overrides.id ?? 'cs_1',
    client_reference_id: overrides.userId === undefined ? 'user_1' : overrides.userId,
    subscription: overrides.subscription === undefined ? 'sub_1' : overrides.subscription,
    mode: overrides.mode ?? 'subscription',
    status: overrides.status ?? 'complete',
  } as unknown as Stripe.Checkout.Session;
}

beforeEach(() => {
  sessions = [];
  list.mockClear();
  grant.mockReset();
  grant.mockResolvedValue(undefined);
});

describe('sweepPaidCheckoutsWithoutPro (FRESCO-909, C-03)', () => {
  test('grants Pro to a paid session whose user has no subscription on file', async () => {
    sessions = [session()];

    const result = await run(clientWithStored({ user_1: null }));

    expect(result).toEqual({ scanned: 1, granted: 1, failed: 0 });
    expect(grant).toHaveBeenCalledTimes(1);
    expect(grant.mock.calls[0]?.[1]).toBe(sessions[0]);
  });

  test('asks Stripe only for the last 48 hours of sessions', async () => {
    const before = Math.floor(Date.now() / 1000);

    await run(clientWithStored({}));

    const params = list.mock.calls[0]?.[0] as { created: { gte: number }, limit: number };
    expect(params.limit).toBe(100);
    expect(before - params.created.gte).toBeGreaterThanOrEqual(48 * 3600);
    expect(before - params.created.gte).toBeLessThan(48 * 3600 + 5);
  });

  test('leaves alone a user whose stored subscription is already the one they paid for', async () => {
    sessions = [session({ subscription: 'sub_1' })];

    const result = await run(clientWithStored({ user_1: 'sub_1' }));

    expect(result).toEqual({ scanned: 1, granted: 0, failed: 0 });
    expect(grant).not.toHaveBeenCalled();
  });

  test('grants when the stored subscription is a different, older one', async () => {
    sessions = [session({ subscription: 'sub_new' })];

    const result = await run(clientWithStored({ user_1: 'sub_old' }));

    expect(result.granted).toBe(1);
  });

  test('considers only the newest session of a user, so an older one never overwrites it', async () => {
    sessions = [session({ id: 'cs_new', subscription: 'sub_new' }), session({ id: 'cs_old', subscription: 'sub_old' })];

    const result = await run(clientWithStored({ user_1: 'sub_new' }));

    expect(result).toEqual({ scanned: 1, granted: 0, failed: 0 });
    expect(grant).not.toHaveBeenCalled();
  });

  test('skips sessions that are not a completed subscription checkout with a user', async () => {
    sessions = [
      session({ id: 'cs_payment', mode: 'payment' }),
      session({ id: 'cs_open', status: 'open', userId: 'user_2' }),
      session({ id: 'cs_anon', userId: null }),
      session({ id: 'cs_nosub', userId: 'user_3', subscription: null }),
    ];

    const result = await run(clientWithStored({}));

    expect(result).toEqual({ scanned: 0, granted: 0, failed: 0 });
    expect(grant).not.toHaveBeenCalled();
  });

  test('counts a refused grant as failed and keeps going with the next user', async () => {
    sessions = [session({ id: 'cs_a', userId: 'user_a', subscription: 'sub_a' }), session({ id: 'cs_b', userId: 'user_b', subscription: 'sub_b' })];
    grant.mockRejectedValueOnce(new Error('Subscription sub_a is canceled, not trialing or active — refusing to grant Pro.'));

    const result = await run(clientWithStored({}));

    expect(result).toEqual({ scanned: 2, granted: 1, failed: 1 });
    expect(grant).toHaveBeenCalledTimes(2);
  });

  test('counts a failed profile read as failed, without granting for that user', async () => {
    sessions = [session({ id: 'cs_a', userId: 'user_a', subscription: 'sub_a' }), session({ id: 'cs_b', userId: 'user_b', subscription: 'sub_b' })];

    const result = await run(clientWithStored({}, { failFor: 'user_a' }));

    expect(result).toEqual({ scanned: 2, granted: 1, failed: 1 });
    expect(grant).toHaveBeenCalledTimes(1);
    expect(grant.mock.calls[0]?.[1].id).toBe('cs_b');
  });

  test('reads the subscription id off an expanded subscription object too', async () => {
    sessions = [{ ...session(), subscription: { id: 'sub_expanded' } } as unknown as Stripe.Checkout.Session];

    const result = await run(clientWithStored({ user_1: 'sub_expanded' }));

    expect(result).toEqual({ scanned: 1, granted: 0, failed: 0 });
  });
});
