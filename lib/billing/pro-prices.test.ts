import { beforeEach, describe, expect, mock, test } from 'bun:test';

const pricesRetrieve = mock();
const realStripe = await import('@/lib/stripe');
void mock.module('@/lib/stripe', () => ({ ...realStripe, stripe: { prices: { retrieve: pricesRetrieve } } }));

const { formatEuros, readProPrices, yearlySavingsEuros } = await import('./pro-prices');

function stripePrice(overrides: Record<string, unknown> = {}) {
  return { unit_amount: 499, currency: 'eur', recurring: { interval: 'month', interval_count: 1 }, ...overrides };
}

beforeEach(() => {
  pricesRetrieve.mockReset();
  process.env.STRIPE_PRICE_ID_PRO_MONTH = 'price_month';
  process.env.STRIPE_PRICE_ID_PRO_ANUAL = 'price_year';
});

describe('readProPrices', () => {
  test('reads both prices from Stripe, in euros', async () => {
    pricesRetrieve.mockImplementation(async (id: string) => id === 'price_year'
      ? stripePrice({ unit_amount: 4499, recurring: { interval: 'year', interval_count: 1 } })
      : stripePrice());

    expect(await readProPrices()).toEqual({ month: 4.99, year: 44.99 });
  });

  test('has no annual price when the environment does not configure one', async () => {
    delete process.env.STRIPE_PRICE_ID_PRO_ANUAL;
    pricesRetrieve.mockResolvedValue(stripePrice());

    expect(await readProPrices()).toEqual({ month: 4.99, year: null });
    expect(pricesRetrieve).toHaveBeenCalledTimes(1);
  });

  test('ignores an annual price id that is really a monthly price (the original FRESCO-844 misconfiguration)', async () => {
    pricesRetrieve.mockImplementation(async (id: string) => id === 'price_year' ? stripePrice({ unit_amount: 4499 }) : stripePrice());

    expect(await readProPrices()).toEqual({ month: 4.99, year: null });
  });

  test('ignores a price that is not in euros', async () => {
    pricesRetrieve.mockImplementation(async (id: string) => id === 'price_year'
      ? stripePrice({ unit_amount: 4499, currency: 'usd', recurring: { interval: 'year', interval_count: 1 } })
      : stripePrice());

    expect((await readProPrices()).year).toBeNull();
  });

  test('throws when the monthly price is missing, so the caller falls back to the old copy', async () => {
    delete process.env.STRIPE_PRICE_ID_PRO_MONTH;
    pricesRetrieve.mockResolvedValue(stripePrice());

    await expect(readProPrices()).rejects.toThrow('monthly Pro price');
  });

  test('throws when Stripe cannot be read', async () => {
    pricesRetrieve.mockRejectedValue(new Error('stripe down'));

    await expect(readProPrices()).rejects.toThrow('stripe down');
  });
});

describe('formatEuros', () => {
  test('uses a decimal comma and no space before the symbol', () => {
    expect(formatEuros(4.99)).toBe('4,99€');
    expect(formatEuros(44.99)).toBe('44,99€');
    expect(formatEuros(5)).toBe('5,00€');
  });
});

describe('yearlySavingsEuros', () => {
  test('is what twelve monthly payments cost over the annual price', () => {
    expect(yearlySavingsEuros({ month: 4.99, year: 44.99 })).toBe(14.89);
  });

  test('is null with no annual price, or when yearly is not cheaper', () => {
    expect(yearlySavingsEuros({ month: 4.99, year: null })).toBeNull();
    expect(yearlySavingsEuros({ month: 4.99, year: 59.88 })).toBeNull();
  });
});
