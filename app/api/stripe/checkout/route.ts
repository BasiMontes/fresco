import type { NextRequest } from 'next/server';
import type { BillingState } from '@/lib/billing/billing-state';
import { NextResponse } from 'next/server';
import { getBillingState } from '@/lib/billing/billing-state';
import { isTrialAvailable, PRO_TRIAL_SUBSCRIPTION_DATA } from '@/lib/legal/pro-terms';
import { getProPriceId, parseProInterval, stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

const RATE_LIMIT_ENDPOINT = 'stripe-checkout';

/**
 * FRESCO-845: the hosted Checkout page is the one screen of the funnel Stripe
 * renders, so the few pieces we control are set here: Spanish locale and a short
 * line under the pay button in the app's voice. The logo, colours and account name
 * live in the Stripe Dashboard (Settings > Branding), not in code.
 */
const CHECKOUT_SUBMIT_MESSAGE = 'Cancelas cuando quieras desde tu perfil, en «Gestionar mi suscripción». Gracias por cocinar con Fresco.';
const RATE_LIMIT_PER_HOUR = 10;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

/**
 * POST /api/stripe/checkout — `/profile`'s "Pásate a Fresco Pro" CTA
 * (STORY-FRESCO-228). Creates a Stripe Checkout Session in `subscription`
 * mode for the Pro price (€4.99/mes) and returns its hosted-page URL for the
 * client to redirect to (ADR-0007: Checkout, not Elements, not a bare
 * Payment Link).
 *
 * `trial_period_days: 7` + `payment_method_collection: 'if_required'` covers
 * the "trial sin tarjeta" AC with zero custom trial-state code — Stripe
 * doesn't ask for a card until the trial converts.
 *
 * FRESCO-778 (audit-6 A6-S3): that trial is once per account. The route used
 * to open a fresh card-less trial on every call — no customer, no look at the
 * user's subscription history, no guest check, no rate limit — so one account
 * (or a swarm of anonymous guests) could re-trial Pro forever. Now: guests are
 * refused, an already-Pro user gets a 409, and a user whose profile carries a
 * Stripe customer or subscription id (the webhook writes them on the first
 * completed checkout and nothing clears them, so they are the "trial used"
 * marker) re-subscribes through the same Checkout WITHOUT a trial and with a
 * card, reusing their Stripe customer instead of creating another.
 *
 * `client_reference_id` is the authenticated Supabase user id, so the
 * webhook (`app/api/stripe/webhook/route.ts`) can map the eventual
 * `checkout.session.completed` event back to a `user_profiles` row without
 * an extra lookup table. This route only ever *reads* the session — it never
 * writes `plan`/`stripe_customer_id`/etc.; the webhook is the sole writer.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No hay una sesión autenticada.' }, { status: 401 });
  }

  if (user.is_anonymous) {
    return NextResponse.json({ error: 'Crea una cuenta para pasarte a Fresco Pro.' }, { status: 403 });
  }

  // FRESCO-844: the body is optional; no body (or anything but 'year') is the monthly plan.
  const body: unknown = await request.json().catch(() => null);
  const interval = parseProInterval((body as { interval?: unknown } | null)?.interval);
  const priceId = getProPriceId(interval);
  if (!priceId) {
    console.error(`[/api/stripe/checkout] no Stripe price configured for interval ${interval}`);
    return NextResponse.json({ error: 'No se pudo iniciar el pago.' }, { status: interval === 'year' ? 400 : 500 });
  }

  // ADR-0010: atomic check-and-increment, fail closed — only an explicit `true` passes.
  const { data: allowed, error: rateLimitError } = await supabase.rpc('check_and_increment_rate_limit', {
    p_user_id: user.id,
    p_endpoint: RATE_LIMIT_ENDPOINT,
    p_limit: RATE_LIMIT_PER_HOUR,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (rateLimitError) {
    console.error('[/api/stripe/checkout] rate-limit check failed', rateLimitError);
    return NextResponse.json({ error: 'No se pudo iniciar el pago.' }, { status: 500 });
  }
  if (allowed !== true) {
    return NextResponse.json({ error: 'Has alcanzado el límite de intentos, inténtalo de nuevo en unos minutos.' }, { status: 429 });
  }

  let profile: BillingState | null;
  try {
    profile = await getBillingState(supabase, user.id);
  }
  catch (profileError) {
    console.error('[/api/stripe/checkout] failed to read profile', profileError);
    return NextResponse.json({ error: 'No se pudo iniciar el pago.' }, { status: 500 });
  }
  if (profile?.plan === 'pro') {
    return NextResponse.json({ error: 'Ya tienes Fresco Pro.' }, { status: 409 });
  }

  const stripeCustomerId = profile?.stripe_customer_id ?? null;
  const trialAlreadyUsed = !isTrialAvailable(profile);

  const origin = request.nextUrl.origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      ...(trialAlreadyUsed
        ? { payment_method_collection: 'always' as const }
        : { subscription_data: PRO_TRIAL_SUBSCRIPTION_DATA, payment_method_collection: 'if_required' as const }),
      ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
      client_reference_id: user.id,
      locale: 'es',
      custom_text: { submit: { message: CHECKOUT_SUBMIT_MESSAGE } },
      success_url: `${origin}/profile?checkout=success`,
      cancel_url: `${origin}/profile?checkout=cancelled`,
    });

    if (!session.url) {
      console.error('[/api/stripe/checkout] Stripe session created without a url', session.id);
      return NextResponse.json({ error: 'No se pudo iniciar el pago.' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  }
  catch (error) {
    console.error('[/api/stripe/checkout] session creation failed', error);
    return NextResponse.json({ error: 'No se pudo iniciar el pago.' }, { status: 500 });
  }
}
