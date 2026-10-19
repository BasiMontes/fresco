import type { NextRequest } from 'next/server';
import type { BillingState } from '@/lib/billing/billing-state';
import { NextResponse } from 'next/server';
import { getBillingState } from '@/lib/billing/billing-state';
import { getProPriceDetail } from '@/lib/billing/pro-prices';
import { isTrialAvailable, PRO_TRIAL_DAYS } from '@/lib/legal/pro-terms';
import { getProPriceId, parseProInterval } from '@/lib/stripe';
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
 *
 * FRESCO-1003 (audit 7b A7-API-04): the Price comes from `getProPriceDetail`, cached for an hour
 * per Price id (`pro-prices.ts`), so a signed-in user reloading the page cannot turn this endpoint
 * into a stream of Stripe reads. The per-user figures (the trial) are still computed per request.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No hay una sesión autenticada.' }, { status: 401 });
  }

  if (user.is_anonymous) {
    return NextResponse.json({ error: 'Crea una cuenta para pasarte a Fresco Pro.' }, { status: 403 });
  }

  // FRESCO-844: `?interval=year` asks for the annual price; anything else is monthly.
  const interval = parseProInterval(request.nextUrl.searchParams.get('interval'));
  const priceId = getProPriceId(interval);
  if (!priceId) {
    console.error(`[/api/stripe/pro-price] no Stripe price configured for interval ${interval}`);
    return NextResponse.json({ error: 'No se pudo cargar el precio.' }, { status: 500 });
  }

  let profile: BillingState | null;
  try {
    profile = await getBillingState(supabase, user.id);
  }
  catch (profileError) {
    console.error('[/api/stripe/pro-price] failed to read profile', profileError);
    return NextResponse.json({ error: 'No se pudo cargar el precio.' }, { status: 500 });
  }

  try {
    const price = await getProPriceDetail(priceId);

    return NextResponse.json({
      amount: price.amount,
      currency: price.currency,
      interval: price.interval,
      intervalCount: price.intervalCount,
      taxIncluded: price.taxIncluded,
      trialDays: isTrialAvailable(profile) ? PRO_TRIAL_DAYS : null,
    });
  }
  catch (error) {
    console.error('[/api/stripe/pro-price] could not read the price from Stripe', error);
    return NextResponse.json({ error: 'No se pudo cargar el precio.' }, { status: 500 });
  }
}
