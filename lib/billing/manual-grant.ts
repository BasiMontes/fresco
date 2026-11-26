/**
 * Pro without a charge (FRESCO-1033, `scripts/grant-pro.ts`): `plan = 'pro'`,
 * an end date and no Stripe subscription. Shared by the script that writes the
 * grant and the reconcile sweep that must not take it away early
 * (FRESCO-1313/QAFRESCO-7).
 */

export const MAX_GRANT_DAYS = 60;

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a row without a subscription is a grant still in force. The upper
 * bound matters: the script never writes a date farther than `MAX_GRANT_DAYS`,
 * so a farther one did not come from it (the FRESCO-360 bypass planted
 * far-future dates). Clients cannot write `plan_expires_at`
 * (`protect_subscription_columns`, ADR-0007).
 */
export function isManualGrantInForce(
  { plan, plan_expires_at }: { plan: string, plan_expires_at?: string | null },
  now: number,
): boolean {
  if (plan !== 'pro' || !plan_expires_at) {
    return false;
  }
  const remaining = Date.parse(plan_expires_at) - now;
  return remaining > 0 && remaining <= MAX_GRANT_DAYS * DAY_MS;
}
