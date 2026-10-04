/**
 * FRESCO-794 (ADR-0040) — formatting for the pre-contract summary. The figures
 * come from Stripe's Price through `GET /api/stripe/pro-price`; these helpers
 * only turn them into Spanish copy, so the UI never hardcodes an amount.
 */

export interface ProPriceInfo {
  amount: number
  currency: string
  interval: string
  intervalCount: number
  taxIncluded: boolean
  /** Days of free trial this user is entitled to, or `null` when the trial is already used. */
  trialDays: number | null
}

const INTERVAL_LABEL: Record<string, { one: string, many: string }> = {
  day: { one: 'día', many: 'días' },
  week: { one: 'semana', many: 'semanas' },
  month: { one: 'mes', many: 'meses' },
  year: { one: 'año', many: 'años' },
};

/** "4,99 €" for `4.99` / `eur`. */
export function formatProAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: currency.toUpperCase() }).format(amount);
}

/** "al mes" for a monthly price, "cada 3 meses" for a quarterly one. */
export function formatProPeriod(interval: string, intervalCount: number): string {
  const label = INTERVAL_LABEL[interval];
  if (!label) {
    return `cada ${intervalCount} ${interval}`;
  }
  if (intervalCount === 1) {
    return interval === 'month' ? 'al mes' : `por ${label.one}`;
  }
  return `cada ${intervalCount} ${label.many}`;
}

/** The sentence about the price: "4,99 € al mes" plus "(IVA incluido)" only when Stripe declares the price tax-inclusive. */
export function describeProPrice(info: Pick<ProPriceInfo, 'amount' | 'currency' | 'interval' | 'intervalCount' | 'taxIncluded'>): string {
  const base = `${formatProAmount(info.amount, info.currency)} ${formatProPeriod(info.interval, info.intervalCount)}`;
  return info.taxIncluded ? `${base} (IVA incluido)` : base;
}
