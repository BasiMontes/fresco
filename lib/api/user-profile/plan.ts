import type { UserProfile } from '@schemas';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { cache } from 'react';
import { isTrialAvailable } from '@/lib/legal/pro-terms';
import { UserProfileError } from './errors';

/**
 * Reads the CURRENTLY authenticated user's plan tier (FRESCO-15 — gates the
 * "esto es una función Pro" notice shown to Free users). Defaults to
 * `'free'` when no profile row exists yet (onboarding not completed) rather
 * than throwing — a missing profile isn't an error for this read, callers
 * that need the profile itself already fail fast via other paths.
 *
 * Wrapped in `React.cache()` so repeated calls with the *same* arguments
 * within a single render pass (e.g. `(app)/layout.tsx` and
 * `(app)/profile/page.tsx` both resolving the signed-in user's `plan`)
 * dedupe to one underlying read. Note: this only dedupes when the `client`
 * argument is reference-equal across call sites — today each caller builds
 * its own client via `createClient()`, so the two calls still miss this
 * cache in practice. Making `createClient()` itself request-memoized would
 * close that gap, but it's called from Route Handlers too
 * (`app/api/profile/export/route.ts`, `app/auth/confirm/route.ts`), which
 * sit outside the React render tree — `React.cache()` there would not reset
 * per-request and could leak one request's client into another. Left as-is;
 * the safe half of this fix (memoizing this function's own work per
 * matching arguments) still ships.
 */
export const getUserPlan = cache(async (
  client: SupabaseClient<Database>,
  userId?: string,
): Promise<UserProfile['plan']> => {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new UserProfileError('No hay una sesión autenticada para leer el perfil.');
    }

    resolvedUserId = user.id;
  }

  const { data, error } = await client
    .from('user_profiles')
    .select('plan')
    .eq('id', resolvedUserId)
    .maybeSingle();

  if (error) {
    throw new UserProfileError(`No se pudo leer el perfil: ${error.message}`);
  }

  return data?.plan ?? 'free';
});

/**
 * Whether the CURRENTLY authenticated user still has the Pro free trial
 * (FRESCO-822). A profile that carries a Stripe customer or subscription id has
 * already been through a checkout, so the trial is used up (`isTrialAvailable`,
 * the same rule `/api/stripe/checkout` applies). Same read pattern as
 * `getUserPlan`; callers decide what a failed read means, and for a promise the
 * safe answer is "not available".
 */
export const getUserTrialAvailable = cache(async (
  client: SupabaseClient<Database>,
  userId?: string,
): Promise<boolean> => {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new UserProfileError('No hay una sesión autenticada para leer el perfil.');
    }

    resolvedUserId = user.id;
  }

  const { data, error } = await client
    .from('user_profiles')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('id', resolvedUserId)
    .maybeSingle();

  if (error) {
    throw new UserProfileError(`No se pudo leer el perfil: ${error.message}`);
  }

  return isTrialAvailable(data);
});

/**
 * FRESCO-366 / A4-B4: the plan tier for an analytics property (the `tier` on
 * `menu_generation_completed`, `is_guest`/`plan` person properties). Unlike
 * `getUserPlan` this NEVER throws and is NOT `React.cache`-wrapped, so it is
 * safe to call from a client component or event handler: any failure (no
 * session, RLS blip, no profile row) returns `'free'`, because an analytics
 * property must never be the thing that breaks a menu-generation flow.
 */
export async function getPlanTierForAnalytics(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<UserProfile['plan']> {
  try {
    const { data } = await client
      .from('user_profiles')
      .select('plan')
      .eq('id', userId)
      .maybeSingle();
    return data?.plan ?? 'free';
  }
  catch {
    return 'free';
  }
}

/**
 * Reads the CURRENTLY authenticated user's failed-payment aviso timestamp
 * (`/profile`'s Pro banner, FRESCO-232) — set by the Stripe webhook when a
 * renewal charge fails, cleared on a successful retry or a final downgrade to
 * Free. Same conservative-default pattern as `getUserPlan`: a missing profile
 * row is not an error, it just means no aviso.
 */
export const getPaymentFailedAt = cache(async (
  client: SupabaseClient<Database>,
  userId?: string,
): Promise<string | null> => {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new UserProfileError('No hay una sesión autenticada para leer el perfil.');
    }

    resolvedUserId = user.id;
  }

  const { data, error } = await client
    .from('user_profiles')
    .select('payment_failed_at')
    .eq('id', resolvedUserId)
    .maybeSingle();

  if (error) {
    throw new UserProfileError(`No se pudo leer el perfil: ${error.message}`);
  }

  return data?.payment_failed_at ?? null;
});

/**
 * Single source of truth for "is the payment-failed alert active" — Pro plan
 * AND a non-null `payment_failed_at`. Shared by `/profile`'s card,
 * `/notifications`'s notice, and the `/menu` badge (FRESCO-234) so the three
 * surfaces can't drift out of sync if the eligibility rule ever changes.
 */
export function isPaymentFailedAlertActive(
  plan: UserProfile['plan'],
  paymentFailedAt: string | null,
): boolean {
  return plan === 'pro' && Boolean(paymentFailedAt);
}
