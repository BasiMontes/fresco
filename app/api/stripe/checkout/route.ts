import type { NextRequest } from 'next/server';
import type { BillingState } from '@/lib/billing/billing-state';
import { NextResponse } from 'next/server';
import { getBillingState } from '@/lib/billing/billing-state';
import { checkoutSessionWindow, ensureCheckoutCustomer, expireOtherOpenCheckoutSessions, hasLiveSubscription } from '@/lib/billing/checkout-guard';
import { environmentLivemode, readDatabaseLivemode } from '@/lib/billing/stripe-mode';
import { hasRecordedConsent } from '@/lib/legal/consent-store';
import { isTrialAvailable, PRO_TRIAL_SUBSCRIPTION_DATA } from '@/lib/legal/pro-terms';
import { getProPriceId, parseProInterval, stripe } from '@/lib/stripe';
import { CHECKOUT_BRANDING } from '@/lib/stripe-checkout-branding';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const RATE_LIMIT_ENDPOINT = 'stripe-checkout';

/**
 * FRESCO-845: the hosted Checkout page is the one screen of the funnel Stripe
 * renders, so the pieces we control are set here on every session: Spanish locale,
 * a short line under the pay button in the app's voice, and the brand (name,
 * colours, icon: `lib/stripe-checkout-branding.ts`).
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
 * FRESCO-1001 (audit 7b: A7-PAY-01, ADR-0061): this deploy and the shared database must serve
 * the same Stripe mode (`stripe-mode.ts`). A test-mode deploy such as `fresco-pre` answers 503
 * and creates nothing once the database is live, instead of taking a test card for a
 * production account. A stored Stripe customer of the OTHER mode is not reused: it does not
 * exist in this mode, and passing it made the session fail (audit C-04).
 *
 * FRESCO-1002 (audit 7b: A7-PAY-02): two checkouts could end in two subscriptions, because the
 * profile says `free` until the webhook lands. Every session now has a Stripe customer
 * (created up front, keyed on the user, profile untouched: `checkout-guard.ts`), a live
 * subscription of that customer is a 409, concurrent POSTs of the same minute share one
 * idempotency key and so one session, the session expires in about 30 minutes, and creating
 * a session expires the customer's other open ones.
 *
 * FRESCO-1003 (audit 7b: A7-PAY-07, A7-PAY-10): the route refuses what the UI used to guarantee
 * alone. No profile row is a 409, and no recorded `withdrawal_waiver` for the current text
 * version is a 400 (`consent-store.ts#hasRecordedConsent`). The registry keeps one row per
 * (user, kind, version) and ignores repeats, so "recorded" means "for these texts", not "in the
 * last minutes"; per-purchase evidence would need a registry change (ADR-0040).
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

  let checkoutLivemode: boolean;
  try {
    const environment = environmentLivemode();
    const database = await readDatabaseLivemode(createServiceClient());
    if (environment !== database) {
      console.error(`[/api/stripe/checkout] refusing: this deploy uses Stripe ${environment ? 'live' : 'test'} mode but the database serves ${database ? 'live' : 'test'} mode`);
      return NextResponse.json({ error: 'Los pagos no están disponibles en este entorno.' }, { status: 503 });
    }
    checkoutLivemode = environment;
  }
  catch (modeError) {
    console.error('[/api/stripe/checkout] could not check the Stripe mode', modeError);
    return NextResponse.json({ error: 'No se pudo iniciar el pago.' }, { status: 500 });
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
  // FRESCO-1003 (audit 7b A7-PAY-10): no profile row means onboarding never finished; there is no
  // account to attach a subscription to, and the trial rules below read the profile.
  if (!profile) {
    return NextResponse.json({ error: 'Termina de configurar tu perfil antes de pasarte a Fresco Pro.' }, { status: 409 });
  }
  if (profile.plan === 'pro') {
    return NextResponse.json({ error: 'Ya tienes Fresco Pro.' }, { status: 409 });
  }

  // FRESCO-1003 (audit 7b A7-PAY-07): the summary records the withdrawal waiver before it calls
  // this route, but a request that skips the summary used to reach Stripe without it. The server
  // asks the registry (ADR-0040), and an unreadable registry is a refusal, not a pass.
  try {
    if (!(await hasRecordedConsent(supabase, 'withdrawal_waiver'))) {
      return NextResponse.json({ error: 'Para empezar el servicio de inmediato tienes que aceptar el desistimiento antes de pagar.' }, { status: 400 });
    }
  }
  catch (consentError) {
    console.error('[/api/stripe/checkout] failed to read the withdrawal waiver', consentError);
    return NextResponse.json({ error: 'No se pudo iniciar el pago.' }, { status: 500 });
  }

  const stripeCustomerId = profile.stripe_customer_id && (profile.stripe_livemode ?? false) === checkoutLivemode
    ? profile.stripe_customer_id
    : null;
  const trialAlreadyUsed = !isTrialAvailable(profile);

  const origin = request.nextUrl.origin;

  try {
    // FRESCO-1002: ask Stripe, not the profile, whether a subscription is already live: the
    // profile stays `free` until the webhook lands. Failing to ask is a 500, never a pass.
    const customerId = await ensureCheckoutCustomer(stripe, { userId: user.id, email: user.email, storedCustomerId: stripeCustomerId });
    if (await hasLiveSubscription(stripe, customerId)) {
      return NextResponse.json({ error: 'Ya tienes Fresco Pro.' }, { status: 409 });
    }

    const { idempotencyKey, expiresAt } = checkoutSessionWindow({ userId: user.id, interval });
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      ...(trialAlreadyUsed
        ? { payment_method_collection: 'always' as const }
        : { subscription_data: PRO_TRIAL_SUBSCRIPTION_DATA, payment_method_collection: 'if_required' as const }),
      customer: customerId,
      client_reference_id: user.id,
      expires_at: expiresAt,
      locale: 'es',
      custom_text: { submit: { message: CHECKOUT_SUBMIT_MESSAGE } },
      branding_settings: CHECKOUT_BRANDING,
      success_url: `${origin}/profile?checkout=success`,
      cancel_url: `${origin}/profile?checkout=cancelled`,
    }, { idempotencyKey });

    if (!session.url) {
      console.error('[/api/stripe/checkout] Stripe session created without a url', session.id);
      return NextResponse.json({ error: 'No se pudo iniciar el pago.' }, { status: 500 });
    }

    // One payable session at a time: a second tab cannot also end in a paid subscription.
    await expireOtherOpenCheckoutSessions(stripe, { customerId, keepSessionId: session.id });

    return NextResponse.json({ url: session.url });
  }
  catch (error) {
    console.error('[/api/stripe/checkout] session creation failed', error);
    return NextResponse.json({ error: 'No se pudo iniciar el pago.' }, { status: 500 });
  }
}
