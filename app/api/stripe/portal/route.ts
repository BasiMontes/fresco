import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/stripe/portal — `/profile`'s "Gestionar mi suscripción" CTA
 * (STORY-FRESCO-231). Creates a Stripe Billing Portal Session for the
 * authenticated user's existing customer and returns its hosted-page url for
 * the client to redirect to — same "hosted surface over custom UI"
 * philosophy as `checkout/route.ts` (STORY-FRESCO-228, ADR-0007). The portal
 * itself (configured out-of-band via the Stripe API, `bpc_1U65aCGyXX8lW4CXCuJ71BCn`)
 * natively shows the next invoice date/amount and lets the user cancel
 * (at period end) or reactivate — no custom UI needed for any of that here.
 *
 * Reads `stripe_customer_id` via the cookie-scoped (RLS) client — this is
 * always the caller's OWN row, so no service-role client is needed for the
 * read, mirroring `checkout/route.ts`'s inline-query posture rather than
 * introducing a new `user-profile.ts` helper for a single-column read.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No hay una sesión autenticada.' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('plan, stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[/api/stripe/portal] failed to read profile', profileError);
    return NextResponse.json({ error: 'No se pudo comprobar tu suscripción.' }, { status: 500 });
  }

  // Code review on PR #102: the UI only renders this CTA for plan === 'pro',
  // but that alone doesn't stop a direct POST here -- a user who was Pro and
  // later downgraded retains a stale stripe_customer_id (the cancellation
  // webhook clears `plan`, not the Stripe ids), so without this check she
  // could still open a live portal session for her now-defunct customer.
  if (profile?.plan !== 'pro') {
    return NextResponse.json({ error: 'No se encontró tu suscripción.' }, { status: 404 });
  }

  const stripeCustomerId = profile.stripe_customer_id;
  if (!stripeCustomerId) {
    return NextResponse.json({ error: 'No se encontró tu suscripción.' }, { status: 404 });
  }

  const origin = request.nextUrl.origin;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/profile`,
    });

    return NextResponse.json({ url: session.url });
  }
  catch (error) {
    console.error('[/api/stripe/portal] session creation failed', error);
    return NextResponse.json({ error: 'No se pudo abrir la gestión de tu suscripción.' }, { status: 500 });
  }
}
