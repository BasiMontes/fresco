import { describe, expect, test } from 'bun:test';
import { describeProPrice, formatProAmount, formatProPeriod } from './pro-summary';

// Intl uses a no-break space between the amount and the euro sign.
const norm = (text: string) => text.replaceAll(/\s/g, ' ');

describe('formatProAmount', () => {
  test('formats euros the Spanish way', () => {
    expect(norm(formatProAmount(4.99, 'eur'))).toBe('4,99 €');
  });
});

describe('formatProPeriod', () => {
  test.each([
    ['month', 1, 'al mes'],
    ['year', 1, 'por año'],
    ['month', 3, 'cada 3 meses'],
    ['week', 2, 'cada 2 semanas'],
  ])('%s x %i is "%s"', (interval, count, expected) => {
    expect(formatProPeriod(interval, count)).toBe(expected);
  });

  test('falls back to the raw interval for one it does not know', () => {
    expect(formatProPeriod('decade', 1)).toBe('cada 1 decade');
  });
});

describe('describeProPrice', () => {
  const base = { amount: 4.99, currency: 'eur', interval: 'month', intervalCount: 1 };

  test('never says the tax is included unless Stripe declares it', () => {
    expect(norm(describeProPrice({ ...base, taxIncluded: false }))).toBe('4,99 € al mes');
  });

  test('adds "IVA incluido" when the price is tax-inclusive', () => {
    expect(norm(describeProPrice({ ...base, taxIncluded: true }))).toBe('4,99 € al mes (IVA incluido)');
  });
});
