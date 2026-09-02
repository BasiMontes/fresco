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

type EntitlementFields = Pick<UserProfile, 'plan' | 'plan_expires_at' | 'payment_failed_at'>

/**
 * Whether the user is entitled to Pro/Family features right now.
 *
 * `plan` must be a paid tier AND the entitlement must not have lapsed. It has
 * lapsed only when `plan_expires_at` is both set and in the past AND there is
 * no active payment-failed grace (`payment_failed_at`) — Stripe's `past_due`
 * dunning state deliberately keeps `plan: 'pro'` with a stale
 * `plan_expires_at`, and downgrading those users here would be wrong.
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

  const lapsed =
    profile.plan_expires_at != null &&
    Date.parse(profile.plan_expires_at) < now &&
    profile.payment_failed_at == null

  return !lapsed
}
