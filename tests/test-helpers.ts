import type { APIRequestContext } from '@playwright/test';
import Stripe from 'stripe';

/**
 * Shared REST/date helpers for `tests/steps/*.steps.ts` — extracted after
 * `getAccessToken` (near-identical body, only the account differed) had
 * accumulated 6 copies across step files, `currentUserId` 3, and the ISO-
 * week-Monday computation 2 (one bespoke pair, `isoWeekOf`/
 * `mondayOfWeekContaining`, already existed in 2 files because they needed
 * to compute dates for a week OTHER than "now" — `currentWeekMonday()`
 * below is just the "now" convenience case built on top of those).
 *
 * Lives at `tests/test-helpers.ts`, not `tests/steps/`, so `bddgen`'s
 * `steps: ['tests/fixtures.ts', 'tests/steps/*.ts']` glob (playwright.config.ts)
 * never tries to treat these as step definitions.
 */

export async function getAccessToken(request: APIRequestContext, email: string, password: string): Promise<string> {
  const response = await request.post(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      data: { email, password },
    },
  );
  const body = await response.json() as { access_token: string };
  return body.access_token;
}

export function restHeaders(accessToken: string): Record<string, string> {
  return {
    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

export async function currentUserId(request: APIRequestContext, accessToken: string): Promise<string> {
  const res = await request.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json() as { id: string };
  return body.id;
}

/** ISO 8601 week string `'YYYY-Www'` for `date` — internally normalizes to that week's Thursday per the spec (week number is defined by its Thursday), so any day of the target week produces the same correct result. */
export function isoWeekOf(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86_400_000
    - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Monday of the ISO week containing `date`. */
export function mondayOfWeekContaining(date: Date): Date {
  const day = date.getUTCDay() || 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - day + 1);
  return monday;
}

/** Monday + ISO week string for the CURRENT week — the common case most callers need. */
export function currentWeekMonday(): { semanaIso: string, fechaInicio: string } {
  const monday = mondayOfWeekContaining(new Date());
  return { semanaIso: isoWeekOf(monday), fechaInicio: monday.toISOString().slice(0, 10) };
}

let cachedTestStripe: Stripe | undefined;

function testStripe(): Stripe {
  cachedTestStripe ??= new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-07-29.dahlia' });
  return cachedTestStripe;
}

/**
 * Signs a fabricated Stripe event payload with the real `STRIPE_WEBHOOK_SECRET`
 * (via the SDK's own `generateTestHeaderString`, the mechanism Stripe
 * documents for exercising webhook handlers without waiting on a real
 * delivery) and POSTs it to `/api/stripe/webhook`, exactly as
 * `tests/steps/suscripcion.steps.ts` scenarios need — no Stripe CLI
 * (`stripe listen`) process required in CI.
 *
 * `data.object`'s ids should be REAL Stripe test-mode ids for
 * `checkout.session.completed` (the handler re-fetches the subscription from
 * Stripe's API) — `customer.subscription.updated`/`.deleted` handlers read
 * `event.data.object` directly with no extra Stripe API call, so a
 * synthetic-but-consistent object (matching ids already on the account's
 * `user_profiles` row) is enough for those.
 */
export async function postSignedStripeEvent(
  request: APIRequestContext,
  type: string,
  dataObject: Record<string, unknown>,
): Promise<import('@playwright/test').APIResponse> {
  const payload = JSON.stringify({
    id: `evt_test_${crypto.randomUUID()}`,
    object: 'event',
    type,
    data: { object: dataObject },
  });
  const signature = testStripe().webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });

  return request.post('/api/stripe/webhook', {
    headers: { 'Content-Type': 'application/json', 'stripe-signature': signature },
    data: payload,
  });
}
