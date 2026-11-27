import type { Database } from '@/lib/supabase/types';

type UserProfileRow = Database['public']['Tables']['user_profiles']['Row'];

/**
 * FRESCO-1301: whether the user is entitled to Pro/Family features right now, for the screens. It is the web copy of
 * `supabase/functions/generate-meal-plan/entitlement.ts`, which explains the rule (A4-L8, FRESCO-1003): a paid plan,
 * unless `plan_expires_at` is past with no failed payment in the last `PAYMENT_GRACE_DAYS`. The Edge bundler does not
 * resolve value imports outside `supabase/functions/`, so the copy is held in step by `pro-entitlement.test.ts`.
 */
export const PAYMENT_GRACE_DAYS = 30;
const PAYMENT_GRACE_MS = PAYMENT_GRACE_DAYS * 24 * 60 * 60 * 1000;

export type EntitlementFields = Pick<UserProfileRow, 'plan' | 'plan_expires_at' | 'payment_failed_at'>;

export function isProEntitlementActive(profile: EntitlementFields, now: number = Date.now()): boolean {
  const paidTier = profile.plan === 'pro' || profile.plan === 'family';
  if (!paidTier) {
    return false;
  }

  const graceActive = profile.payment_failed_at != null
    && now - Date.parse(profile.payment_failed_at) <= PAYMENT_GRACE_MS;
  const lapsed = profile.plan_expires_at != null
    && Date.parse(profile.plan_expires_at) < now
    && !graceActive;

  return !lapsed;
}
