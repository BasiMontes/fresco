import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { Pricing } from './pricing';

/**
 * FRESCO-871 — the landing's Pro column shows the prices Stripe returns; the annual
 * line appears only when there is an annual price, and a Stripe outage (`null`)
 * leaves the section as it was before the annual plan.
 */

describe('Pricing — Pro column', () => {
  test('shows the monthly price and the annual one with what it saves', () => {
    renderWithProviders(<Pricing prices={{ month: 4.99, year: 44.99 }} />);

    expect(screen.getByText('4,99€')).toBeTruthy();
    expect(screen.getByTestId('landing_pro_annual_price').textContent).toBe('o 44,99€/año · ahorras 14,89€ al año');
  });

  test('has no annual line when Stripe has no annual price', () => {
    renderWithProviders(<Pricing prices={{ month: 4.99, year: null }} />);

    expect(screen.queryByTestId('landing_pro_annual_price')).toBeNull();
  });

  test('falls back to the monthly copy it had before when the prices could not be read', () => {
    renderWithProviders(<Pricing prices={null} />);

    expect(screen.getByText('4,99€')).toBeTruthy();
    expect(screen.queryByTestId('landing_pro_annual_price')).toBeNull();
  });

  test('uses the amount Stripe returns, not a typed one', () => {
    renderWithProviders(<Pricing prices={{ month: 5.99, year: null }} />);

    expect(screen.getByText('5,99€')).toBeTruthy();
    expect(screen.queryByText('4,99€')).toBeNull();
  });
});
