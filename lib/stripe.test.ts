import type Stripe from 'stripe';
import { describe, expect, test } from 'bun:test';
import { resolveProUpdateFromSession } from './stripe';

/**
 * `resolveProUpdateFromSession` is a pure function — no network, no Stripe
 * SDK calls — so these fixtures only need the fields the function actually
 * reads. Cast via `as unknown as Stripe.X` (same pattern as
 * `lib/api/meal-plan.test.ts`/`lib/api/user-profile.test.ts` for their
 * Supabase client fixtures) rather than filling out the SDK's full, deeply
 * nested response shape.
 */
function fakeSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    client_reference_id: 'user-123',
    customer: 'cus_abc',
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

const PRO_PRICE_ID = 'price_pro_test';

function fakeSubscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: 'sub_xyz',
    trial_end: 1_700_000_000, // 2023-11-14T22:13:20.000Z
    items: { data: [{ price: { id: PRO_PRICE_ID } }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe('resolveProUpdateFromSession', () => {
  test('maps a completed session + subscription to the expected user_profiles update', () => {
    const result = resolveProUpdateFromSession(fakeSession(), fakeSubscription(), PRO_PRICE_ID);

    expect(result).toEqual({
      userId: 'user-123',
      stripeCustomerId: 'cus_abc',
      stripeSubscriptionId: 'sub_xyz',
      planExpiresAt: '2023-11-14T22:13:20.000Z',
    });
  });

  test('reads the customer id off an expanded customer object, not just a bare string', () => {
    const result = resolveProUpdateFromSession(
      fakeSession({ customer: { id: 'cus_expanded' } as Stripe.Customer }),
      fakeSubscription(),
      PRO_PRICE_ID,
    );

    expect(result.stripeCustomerId).toBe('cus_expanded');
  });

  test('throws when client_reference_id is missing', () => {
    expect(() => resolveProUpdateFromSession(fakeSession({ client_reference_id: null }), fakeSubscription(), PRO_PRICE_ID))
      .toThrow('client_reference_id');
  });

  test('throws when the session has no Stripe customer', () => {
    expect(() => resolveProUpdateFromSession(fakeSession({ customer: null }), fakeSubscription(), PRO_PRICE_ID))
      .toThrow('Stripe customer id');
  });

  test('throws when the subscription has no trial_end', () => {
    expect(() => resolveProUpdateFromSession(fakeSession(), fakeSubscription({ trial_end: null }), PRO_PRICE_ID))
      .toThrow('trial_end');
  });

  test('throws when the subscription price does not match the expected Pro price', () => {
    expect(() => resolveProUpdateFromSession(
      fakeSession(),
      fakeSubscription({ items: { data: [{ price: { id: 'price_some_other_product' } }] } as unknown as Stripe.Subscription['items'] }),
      PRO_PRICE_ID,
    )).toThrow('does not match expected Pro price');
  });
});
