import { describe, expect, test } from 'bun:test';
import { PAYMENT_GRACE_DAYS as EDGE_GRACE_DAYS, isProEntitlementActive as isActiveOnEdge } from '../../supabase/functions/generate-meal-plan/entitlement';
import { isProEntitlementActive, PAYMENT_GRACE_DAYS } from './pro-entitlement';

/**
 * FRESCO-1301: the web copy of the Edge entitlement rule (the Edge bundler does not resolve value imports outside
 * `supabase/functions/`, FRESCO-382). Change both sides and extend the corpus.
 */
const NOW = Date.parse('2026-11-27T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(NOW + days * DAY).toISOString();

const CORPUS = (['free', 'pro', 'family'] as const).flatMap(plan =>
  [null, at(-1), at(1)].flatMap(plan_expires_at =>
    [null, at(-1), at(-PAYMENT_GRACE_DAYS), at(-PAYMENT_GRACE_DAYS - 1), 'not a date'].map(payment_failed_at => ({ plan, plan_expires_at, payment_failed_at })),
  ),
);

describe('isProEntitlementActive — web and Edge parity', () => {
  test('uses the same grace period', () => {
    expect(PAYMENT_GRACE_DAYS).toBe(EDGE_GRACE_DAYS);
  });

  test('answers the same as the menu generator for every combination', () => {
    for (const profile of CORPUS) {
      expect({ profile, active: isProEntitlementActive(profile, NOW) }).toEqual({ profile, active: isActiveOnEdge(profile, NOW) });
    }
  });
});
