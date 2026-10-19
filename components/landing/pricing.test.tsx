import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { Pricing } from './pricing';

/**
 * FRESCO-871 — the landing's Pro column shows the prices Stripe returns; the annual
 * line appears only when there is an annual price, and a Stripe outage (`null`)
 * leaves the section as it was before the annual plan.
 */

describe('Pricing — plan labels', () => {
  // FRESCO-938 (UX-05) put the highlighted tag in Spanish. FRESCO-983: the plan itself is
  // called Free everywhere (profile badge, FAQ, help), like Pro, so the card says Free too.
  test('names the free plan Free and keeps the highlighted tag in Spanish', () => {
    renderWithProviders(<Pricing prices={{ month: 4.99, year: null, taxIncluded: false }} />);

    expect(screen.getByText('Free')).toBeTruthy();
    expect(screen.queryByText('Gratis')).toBeNull();
    expect(screen.getByText('Más elegido')).toBeTruthy();
    expect(screen.queryByText('Popular')).toBeNull();
  });
});

describe('Pricing — Pro column', () => {
  test('shows the monthly price and the annual one with what it saves', () => {
    renderWithProviders(<Pricing prices={{ month: 4.99, year: 44.99, taxIncluded: false }} />);

    expect(screen.getByText('4,99€')).toBeTruthy();
    expect(screen.getByTestId('landing_pro_annual_price').textContent).toBe('o 44,99€/año · ahorras 14,89€ al año');
  });

  test('has no annual line when Stripe has no annual price', () => {
    renderWithProviders(<Pricing prices={{ month: 4.99, year: null, taxIncluded: false }} />);

    expect(screen.queryByTestId('landing_pro_annual_price')).toBeNull();
  });

  test('falls back to the monthly copy it had before when the prices could not be read', () => {
    renderWithProviders(<Pricing prices={null} />);

    expect(screen.getByText('4,99€')).toBeTruthy();
    expect(screen.queryByTestId('landing_pro_annual_price')).toBeNull();
  });

  test('uses the amount Stripe returns, not a typed one', () => {
    renderWithProviders(<Pricing prices={{ month: 5.99, year: null, taxIncluded: false }} />);

    expect(screen.getByText('5,99€')).toBeTruthy();
    expect(screen.queryByText('4,99€')).toBeNull();
  });
});

// FRESCO-1004 (A7-LAUNCH-05): "IVA incluido" exactly when Stripe declares the prices tax-inclusive.
describe('Pricing — IVA incluido', () => {
  test('is printed when the prices are tax-inclusive', () => {
    renderWithProviders(<Pricing prices={{ month: 4.99, year: 44.99, taxIncluded: true }} />);

    expect(screen.getByTestId('landing_pro_tax_included').textContent).toBe('IVA incluido');
  });

  test('is never claimed when they are not, nor when the prices could not be read', () => {
    renderWithProviders(<Pricing prices={{ month: 4.99, year: 44.99, taxIncluded: false }} />);
    expect(screen.queryByTestId('landing_pro_tax_included')).toBeNull();
  });

  test('is never claimed by the fallback copy', () => {
    renderWithProviders(<Pricing prices={null} />);
    expect(screen.queryByTestId('landing_pro_tax_included')).toBeNull();
  });
});
