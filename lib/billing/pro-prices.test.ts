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

    expect(await readProPrices()).toEqual({ month: 4.99, year: 44.99, taxIncluded: false });
  });

  test('taxIncluded is true only when every price shown is tax-inclusive (FRESCO-1004)', async () => {
    const inclusive = (over: Record<string, unknown> = {}) => stripePrice({ tax_behavior: 'inclusive', ...over });
    const year = { unit_amount: 4499, recurring: { interval: 'year', interval_count: 1 } };

    pricesRetrieve.mockImplementation(async (id: string) => id === 'price_year' ? inclusive(year) : inclusive());
    expect((await readProPrices()).taxIncluded).toBe(true);

    pricesRetrieve.mockImplementation(async (id: string) => id === 'price_year' ? inclusive({ ...year, tax_behavior: 'exclusive' }) : inclusive());
    expect((await readProPrices()).taxIncluded).toBe(false);

    pricesRetrieve.mockImplementation(async (id: string) => id === 'price_year' ? inclusive(year) : stripePrice({ tax_behavior: 'unspecified' }));
    expect((await readProPrices()).taxIncluded).toBe(false);
  });

  test('taxIncluded follows the monthly price alone when there is no annual one (FRESCO-1004)', async () => {
    delete process.env.STRIPE_PRICE_ID_PRO_ANUAL;
    pricesRetrieve.mockResolvedValue(stripePrice({ tax_behavior: 'inclusive' }));

    expect((await readProPrices()).taxIncluded).toBe(true);
  });

  test('has no annual price when the environment does not configure one', async () => {
    delete process.env.STRIPE_PRICE_ID_PRO_ANUAL;
    pricesRetrieve.mockResolvedValue(stripePrice());

    expect(await readProPrices()).toEqual({ month: 4.99, year: null, taxIncluded: false });
    expect(pricesRetrieve).toHaveBeenCalledTimes(1);
  });

  test('ignores an annual price id that is really a monthly price (the original FRESCO-844 misconfiguration)', async () => {
    pricesRetrieve.mockImplementation(async (id: string) => id === 'price_year' ? stripePrice({ unit_amount: 4499 }) : stripePrice());

    expect(await readProPrices()).toEqual({ month: 4.99, year: null, taxIncluded: false });
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
    expect(yearlySavingsEuros({ month: 4.99, year: 44.99, taxIncluded: false })).toBe(14.89);
  });

  test('is null with no annual price, or when yearly is not cheaper', () => {
    expect(yearlySavingsEuros({ month: 4.99, year: null, taxIncluded: false })).toBeNull();
    expect(yearlySavingsEuros({ month: 4.99, year: 59.88, taxIncluded: false })).toBeNull();
  });
});
