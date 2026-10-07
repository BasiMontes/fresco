import { unstable_cache } from 'next/cache';
import { annualSavings } from '@/lib/legal/pro-summary';
import { getProPriceId, stripe } from '@/lib/stripe';

export interface ProPrices {
  /** Monthly price in euros. Always present: without it there is nothing to show. */
  month: number
  /** Annual price in euros, or `null` when this environment has no annual price configured. */
  year: number | null
}

/** The Pro prices are public marketing copy: an hour of staleness is fine, and it spares Stripe a read per visit. */
const PRICES_REVALIDATE_SECONDS = 3600;

/**
 * Reads one recurring Pro price from Stripe, or `null` when it is not usable as
 * a plain "X €/period" figure (not configured, not euros, or a period that does
 * not match the one we asked for, which is a misconfigured price id).
 */
async function readPrice(interval: 'month' | 'year'): Promise<number | null> {
  const priceId = getProPriceId(interval);
  if (!priceId) {
    return null;
  }
  const price = await stripe.prices.retrieve(priceId);
  if (price.unit_amount === null || price.currency !== 'eur' || price.recurring?.interval !== interval || price.recurring.interval_count !== 1) {
    console.error(`[pro-prices] ${priceId} is not a plain ${interval}ly euro price`);
    return null;
  }
  return price.unit_amount / 100;
}

/**
 * FRESCO-871: the Pro prices the landing and `/profile` show, read from Stripe so
 * they cannot drift from what the checkout charges (the same reason
 * `GET /api/stripe/pro-price` exists, but without its sign-in gate: the landing is
 * public). Throws when Stripe cannot be read or the monthly price is unusable.
 */
export async function readProPrices(): Promise<ProPrices> {
  const [month, year] = await Promise.all([readPrice('month'), readPrice('year')]);
  if (month === null) {
    throw new Error('The monthly Pro price is not available.');
  }
  return { month, year };
}

// Cached only on success: `unstable_cache` does not store a thrown error, so a
// Stripe outage is retried on the next request instead of pinning a fallback for an hour.
const readCachedProPrices = unstable_cache(readProPrices, ['pro-prices'], { revalidate: PRICES_REVALIDATE_SECONDS });

/**
 * The cached Pro prices, or `null` when they cannot be read. Callers fall back to
 * the monthly-only copy they had before the annual plan, so a Stripe hiccup never
 * breaks the landing or the profile.
 */
export async function getProPrices(): Promise<ProPrices | null> {
  try {
    return await readCachedProPrices();
  }
  catch (error) {
    console.error('[pro-prices] could not read the Pro prices from Stripe', error);
    return null;
  }
}

/** "4,99€": the compact form the landing and the profile card already use (no space before the symbol). */
export function formatEuros(amount: number): string {
  return `${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;
}

/** What paying yearly saves against twelve monthly payments, in euros, or `null` when there is no annual price or no saving. */
export function yearlySavingsEuros(prices: ProPrices): number | null {
  if (prices.year === null) {
    return null;
  }
  return annualSavings({ amount: prices.month, currency: 'eur' }, { amount: prices.year, currency: 'eur' });
}
