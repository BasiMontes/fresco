import { describe, expect, test } from 'bun:test';
import { isProEntitlementActive } from '../supabase/functions/generate-meal-plan/entitlement';
import { endOfDayUtc, MAX_GRANT_DAYS, parseArgs, planGrant, planRevoke } from './grant-pro';

const NOW = Date.parse('2026-10-28T10:00:00Z');
const free = { plan: 'free', plan_expires_at: null, stripe_subscription_id: null };

describe('planGrant', () => {
  test('sets pro until the end of the given day', () => {
    expect(planGrant(free, '2026-11-30', NOW)).toEqual({ ok: true, set: { plan: 'pro', plan_expires_at: '2026-11-30T23:59:59.000Z' } });
  });

  test('refuses a past date, today after the day ended, and malformed dates', () => {
    expect(planGrant(free, '2026-10-27', NOW).ok).toBe(false);
    expect(planGrant(free, '2026-02-30', NOW).ok).toBe(false);
    expect(planGrant(free, '30/11/2026', NOW).ok).toBe(false);
  });

  test('accepts exactly the limit and refuses one day more', () => {
    const limit = new Date(NOW + (MAX_GRANT_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
    const over = new Date(NOW + (MAX_GRANT_DAYS + 1) * 86_400_000).toISOString().slice(0, 10);
    expect(planGrant(free, limit, NOW).ok).toBe(true);
    expect(planGrant(free, over, NOW).ok).toBe(false);
  });

  test('refuses an account with a Stripe subscription, which the reconcile cron would overwrite', () => {
    const paying = { ...free, plan: 'pro', stripe_subscription_id: 'sub_123' };
    expect(planGrant(paying, '2026-11-30', NOW)).toMatchObject({ ok: false });
  });

  test('the granted state is entitled before the end date and not after it', () => {
    const plan = planGrant(free, '2026-11-30', NOW);
    if (!plan.ok) {
      throw new Error('expected a grant');
    }
    const profile = { plan: plan.set.plan as 'pro', plan_expires_at: plan.set.plan_expires_at, payment_failed_at: null };
    expect(isProEntitlementActive(profile, Date.parse('2026-11-30T12:00:00Z'))).toBe(true);
    expect(isProEntitlementActive(profile, Date.parse('2026-12-01T00:00:01Z'))).toBe(false);
  });
});

describe('planRevoke', () => {
  test('returns a granted account to free with no expiry', () => {
    expect(planRevoke({ ...free, plan: 'pro', plan_expires_at: '2026-11-30T23:59:59.000Z' })).toEqual({ ok: true, set: { plan: 'free', plan_expires_at: null } });
  });

  test('refuses a free account and a subscribed one', () => {
    expect(planRevoke(free).ok).toBe(false);
    expect(planRevoke({ ...free, plan: 'pro', stripe_subscription_id: 'sub_1' }).ok).toBe(false);
  });
});

describe('parseArgs', () => {
  test('grant needs an end date', () => {
    expect(typeof parseArgs(['grant', 'a@b.es'])).toBe('string');
    expect(parseArgs(['grant', 'A@B.es', '--until', '2026-11-30'])).toEqual({ action: 'grant', email: 'a@b.es', until: '2026-11-30', yes: false });
  });

  test('writes only with --yes', () => {
    expect(parseArgs(['revoke', 'a@b.es', '--yes'])).toMatchObject({ yes: true });
    expect(parseArgs(['revoke', 'a@b.es'])).toMatchObject({ yes: false });
  });

  test('rejects an unknown action', () => {
    expect(typeof parseArgs(['delete', 'a@b.es'])).toBe('string');
  });
});

test('endOfDayUtc rejects impossible calendar days', () => {
  expect(endOfDayUtc('2026-13-01')).toBeNull();
  expect(endOfDayUtc('2026-11-30')).toBe('2026-11-30T23:59:59.000Z');
});
