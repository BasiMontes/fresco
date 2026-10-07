import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { ProUpsellCard } from './pro-upsell-card';

/**
 * FRESCO-822 — a user who already used the Pro trial must never be shown "prueba
 * gratis", in the card or in the CTA: the checkout charges them from day one
 * (FRESCO-778), so the promise would be false.
 */

const card = () => screen.getByTestId('pro_upsell_card');
const cta = () => screen.getByTestId('upgrade_to_pro_button');

describe('ProUpsellCard — trial available', () => {
  test('promises the 7-day trial, with the price after it', () => {
    renderWithProviders(<ProUpsellCard trialAvailable prices={null} />);

    expect(card().textContent).toContain('7 días de prueba gratis, sin tarjeta');
    expect(card().textContent).toContain('4,99€/mes');
    expect(card().textContent).toContain('Pásate a Fresco Pro');
    expect(cta().textContent).toBe('Empezar prueba gratis');
  });
});

describe('ProUpsellCard — trial already used', () => {
  test('never says "prueba gratis" anywhere in the card or the button', () => {
    renderWithProviders(<ProUpsellCard trialAvailable={false} prices={null} />);

    expect(card().textContent?.toLowerCase()).not.toContain('prueba gratis');
    expect(card().textContent).not.toContain('7 días');
    expect(cta().textContent?.toLowerCase()).not.toContain('gratis');
  });

  test('says what is true instead: the price and the charge from the first day', () => {
    renderWithProviders(<ProUpsellCard trialAvailable={false} prices={null} />);

    expect(card().textContent).toContain('Vuelve a Fresco Pro');
    expect(card().textContent).toContain('4,99€/mes');
    expect(card().textContent).toContain('se cobra desde el primer día');
    expect(cta().textContent).toBe('Volver a Pro');
  });
});

/**
 * FRESCO-871 — the amounts come from Stripe; the annual plan is offered only when
 * Stripe has an annual price, and the card keeps its old monthly copy when it has none.
 */
describe('ProUpsellCard — prices from Stripe', () => {
  test('offers the annual plan, with what it saves, next to the monthly one', () => {
    renderWithProviders(<ProUpsellCard trialAvailable prices={{ month: 4.99, year: 44.99 }} />);

    expect(card().textContent).toContain('Después, 4,99€/mes.');
    expect(card().textContent).toContain('O 44,99€/año (ahorras 14,89€).');
  });

  test('shows the annual price to someone who already used the trial, still charged from day one', () => {
    renderWithProviders(<ProUpsellCard trialAvailable={false} prices={{ month: 4.99, year: 44.99 }} />);

    expect(card().textContent).toContain('4,99€/mes o 44,99€/año');
    expect(card().textContent).toContain('se cobra desde el primer día');
    expect(card().textContent?.toLowerCase()).not.toContain('prueba gratis');
  });

  test('stays monthly-only when Stripe has no annual price', () => {
    renderWithProviders(<ProUpsellCard trialAvailable prices={{ month: 4.99, year: null }} />);

    expect(card().textContent).toContain('Después, 4,99€/mes.');
    expect(card().textContent).not.toContain('/año');
  });

  test('uses the amount Stripe returns, not a typed one', () => {
    renderWithProviders(<ProUpsellCard trialAvailable prices={{ month: 5.99, year: null }} />);

    expect(card().textContent).toContain('5,99€/mes');
    expect(card().textContent).not.toContain('4,99€');
  });
});
