import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

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

  const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTH;
  if (!priceId) {
    console.error('[/api/stripe/checkout] STRIPE_PRICE_ID_PRO_MONTH is not set');
    return NextResponse.json({ error: 'No se pudo iniciar el pago.' }, { status: 500 });
  }

  const origin = request.nextUrl.origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 7 },
      payment_method_collection: 'if_required',
      client_reference_id: user.id,
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
