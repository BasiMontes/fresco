// Pure Pro-entitlement check, kept out of index.ts so it runs under
// `bun test` without importing index.ts (which calls Deno.serve() at module
// scope) — same "extract the pure logic" pattern as validation.ts /
// menu-selector.ts.
//
// A4-L8 (audit-4): the Pro gate read `profile.plan` alone. A lost
// `customer.subscription.deleted` webhook (delivery failure past Stripe's
// retry window — the exact case ADR-0015's daily reconciliation cron exists
// for) leaves `plan: 'pro'` stale until the next cron pass, up to 24h of
// free Pro. Checking `plan_expires_at` as defence in depth closes that gap.

import type { UserProfile } from './types.ts'

/**
 * FRESCO-1003 (audit 7b A7-PAY-06): how long a failed payment keeps Pro. Stripe's own dunning
 * retries for a few weeks; past that the person has not paid for a month and stops having the
 * entitlement even if the subscription event that would downgrade them never arrived.
 */
export const PAYMENT_GRACE_DAYS = 30
const PAYMENT_GRACE_MS = PAYMENT_GRACE_DAYS * 24 * 60 * 60 * 1000

type EntitlementFields = Pick<UserProfile, 'plan' | 'plan_expires_at' | 'payment_failed_at'>

/**
 * Whether the user is entitled to Pro/Family features right now.
 *
 * `plan` must be a paid tier AND the entitlement must not have lapsed. It has
 * lapsed only when `plan_expires_at` is both set and in the past AND there is
 * no active payment-failed grace (`payment_failed_at`) — Stripe's `past_due`
 * dunning state deliberately keeps `plan: 'pro'` with a stale
 * `plan_expires_at`, and downgrading those users here would be wrong.
 * The grace is capped (`PAYMENT_GRACE_DAYS`): `payment_failed_at` is the first failure of the
 * cycle (the webhook never renews it), so 30 days past it the entitlement is gone. A timestamp
 * that cannot be read gives no grace.
 *
 * `plan_expires_at == null` never lapses: seed / e2e / family-member / manual
 * grants carry no expiry.
 */
export function isProEntitlementActive(
  profile: EntitlementFields,
  now: number = Date.now(),
): boolean {
  const paidTier = profile.plan === 'pro' || profile.plan === 'family'
  if (!paidTier) return false

  const graceActive =
    profile.payment_failed_at != null &&
    now - Date.parse(profile.payment_failed_at) <= PAYMENT_GRACE_MS

  const lapsed =
    profile.plan_expires_at != null &&
    Date.parse(profile.plan_expires_at) < now &&
    !graceActive

  return !lapsed
}
