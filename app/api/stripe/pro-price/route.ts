import { NextResponse } from 'next/server';
import { isTrialAvailable, PRO_TRIAL_DAYS } from '@/lib/legal/pro-terms';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/stripe/pro-price — what the pre-contract summary shows before the
 * redirect to Stripe Checkout (FRESCO-794, ADR-0040): the price Stripe will
 * actually charge, its billing period, whether the free trial applies to THIS
 * user, and whether Stripe declares the price tax-inclusive.
 *
 * The price is read from Stripe, never typed into the UI, so the summary cannot
 * drift from the amount the checkout charges. `taxIncluded` is true only when the
 * Price says `tax_behavior: 'inclusive'`; with `unspecified` the UI must not claim
 * "IVA incluido" (the lawyer draft leaves the VAT treatment open, clause 6.2).
 *
 * Same gate as `checkout/route.ts`: a signed-in, non-guest user. Read-only.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No hay una sesión autenticada.' }, { status: 401 });
  }

  if (user.is_anonymous) {
    return NextResponse.json({ error: 'Crea una cuenta para pasarte a Fresco Pro.' }, { status: 403 });
  }

  const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTH;
  if (!priceId) {
    console.error('[/api/stripe/pro-price] STRIPE_PRICE_ID_PRO_MONTH is not set');
    return NextResponse.json({ error: 'No se pudo cargar el precio.' }, { status: 500 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    console.error('[/api/stripe/pro-price] failed to read profile', profileError);
    return NextResponse.json({ error: 'No se pudo cargar el precio.' }, { status: 500 });
  }

  try {
    const price = await stripe.prices.retrieve(priceId);
    if (price.unit_amount === null || !price.recurring) {
      console.error('[/api/stripe/pro-price] price is not a fixed recurring amount', priceId);
      return NextResponse.json({ error: 'No se pudo cargar el precio.' }, { status: 500 });
    }

    return NextResponse.json({
      amount: price.unit_amount / 100,
      currency: price.currency,
      interval: price.recurring.interval,
      intervalCount: price.recurring.interval_count,
      taxIncluded: price.tax_behavior === 'inclusive',
      trialDays: isTrialAvailable(profile) ? PRO_TRIAL_DAYS : null,
    });
  }
  catch (error) {
    console.error('[/api/stripe/pro-price] could not read the price from Stripe', error);
    return NextResponse.json({ error: 'No se pudo cargar el precio.' }, { status: 500 });
  }
}
