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
    renderWithProviders(<ProUpsellCard trialAvailable />);

    expect(card().textContent).toContain('7 días de prueba gratis, sin tarjeta');
    expect(card().textContent).toContain('€4.99/mes');
    expect(card().textContent).toContain('Pásate a Fresco Pro');
    expect(cta().textContent).toBe('Empezar prueba gratis');
  });
});

describe('ProUpsellCard — trial already used', () => {
  test('never says "prueba gratis" anywhere in the card or the button', () => {
    renderWithProviders(<ProUpsellCard trialAvailable={false} />);

    expect(card().textContent?.toLowerCase()).not.toContain('prueba gratis');
    expect(card().textContent).not.toContain('7 días');
    expect(cta().textContent?.toLowerCase()).not.toContain('gratis');
  });

  test('says what is true instead: the price and the charge from the first day', () => {
    renderWithProviders(<ProUpsellCard trialAvailable={false} />);

    expect(card().textContent).toContain('Vuelve a Fresco Pro');
    expect(card().textContent).toContain('€4.99/mes');
    expect(card().textContent).toContain('se cobra desde el primer día');
    expect(cta().textContent).toBe('Volver a Pro');
  });
});
