import { describe, expect, test } from 'bun:test';
import { describeModeVerdict, environmentLivemode, judgeEventMode, judgeStripeEventMode, readDatabaseLivemode } from '@/lib/billing/stripe-mode';
import { fakeSupabase } from '@/tests/mocks/supabase-query-builder';

/**
 * FRESCO-1001 (audit 7b: A7-PAY-01, ADR-0061): the Stripe mode guard. Pure verdicts, the mode of
 * a deploy from its key prefix, and the mode of the shared database from `billing_mode`.
 */

function databaseOf(row: unknown, selectError?: unknown) {
  return fakeSupabase({ billing_mode: { rows: row, selectError } }).client as never;
}

describe('environmentLivemode', () => {
  test.each([
    ['sk_live_abc', true],
    ['rk_live_abc', true],
    ['sk_test_abc', false],
    ['rk_test_abc', false],
  ])('%s is live=%s', (key, expected) => {
    expect(environmentLivemode(key)).toBe(expected);
  });

  test.each(['', 'pk_live_abc', 'whsec_abc', 'live_sk'])('refuses to guess the mode of "%s"', (key) => {
    expect(() => environmentLivemode(key)).toThrow('Stripe mode of this deploy is unknown');
  });
});

describe('environmentLivemode without a key', () => {
  test('a deploy with no STRIPE_SECRET_KEY has an unknown mode', () => {
    const previous = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      expect(() => environmentLivemode()).toThrow('Stripe mode of this deploy is unknown');
    }
    finally {
      if (previous !== undefined) { process.env.STRIPE_SECRET_KEY = previous; }
    }
  });
});

describe('readDatabaseLivemode', () => {
  test('reads the one row of billing_mode', async () => {
    expect(await readDatabaseLivemode(databaseOf({ stripe_livemode: true }))).toBe(true);
    expect(await readDatabaseLivemode(databaseOf({ stripe_livemode: false }))).toBe(false);
  });

  test('fails closed: a missing row or a read error throws, never a default', async () => {
    await expect(readDatabaseLivemode(databaseOf(null))).rejects.toThrow('billing_mode has no row');
    await expect(readDatabaseLivemode(databaseOf(null, new Error('permission denied')))).rejects.toThrow('permission denied');
  });
});

describe('judgeEventMode', () => {
  test('an event that matches the deploy and the database is accepted', () => {
    expect(judgeEventMode({ eventLivemode: true, environmentLivemode: true, databaseLivemode: true })).toEqual({ ok: true });
    expect(judgeEventMode({ eventLivemode: false, environmentLivemode: false, databaseLivemode: false })).toEqual({ ok: true });
  });

  test('a test event on a live deploy is refused by the environment layer, and the reverse', () => {
    expect(judgeEventMode({ eventLivemode: false, environmentLivemode: true, databaseLivemode: true }))
      .toEqual({ ok: false, layer: 'environment', eventLivemode: false, expectedLivemode: true });
    expect(judgeEventMode({ eventLivemode: true, environmentLivemode: false, databaseLivemode: false }))
      .toEqual({ ok: false, layer: 'environment', eventLivemode: true, expectedLivemode: false });
  });

  test('fresco-pre: a test deploy receiving a test event is refused once the DATABASE is live (the A7-PAY-01 case)', () => {
    expect(judgeEventMode({ eventLivemode: false, environmentLivemode: false, databaseLivemode: true }))
      .toEqual({ ok: false, layer: 'database', eventLivemode: false, expectedLivemode: true });
  });
});

describe('judgeStripeEventMode', () => {
  test('reads the key of this deploy and billing_mode, then judges', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_x';
    expect(await judgeStripeEventMode(databaseOf({ stripe_livemode: true }), true)).toEqual({ ok: true });
    expect((await judgeStripeEventMode(databaseOf({ stripe_livemode: true }), false)).ok).toBe(false);
  });

  test('an event without a boolean livemode is refused', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    expect((await judgeStripeEventMode(databaseOf({ stripe_livemode: false }), undefined)).ok).toBe(false);
  });

  test('a deploy with an unknown key mode throws, so the caller fails closed', async () => {
    process.env.STRIPE_SECRET_KEY = 'whsec_nope';
    await expect(judgeStripeEventMode(databaseOf({ stripe_livemode: false }), false)).rejects.toThrow('Stripe mode of this deploy is unknown');
  });
});

describe('describeModeVerdict', () => {
  test('says which mode and which layer, with no ids', () => {
    expect(describeModeVerdict({ ok: false, layer: 'database', eventLivemode: false, expectedLivemode: true }))
      .toBe('a test-mode Stripe event does not belong to this database (live mode)');
  });
});
