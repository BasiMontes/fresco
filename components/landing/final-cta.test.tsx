import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { FinalCta } from './final-cta';

/**
 * FRESCO-1166 — the closing section reads the Pro price from the same source as the pricing section, states no
 * amount when Stripe cannot be read, and promises "sin tarjeta" only for the first trial.
 */
describe('FinalCta', () => {
  test('shows the amount it is given, not a typed one', () => {
    renderWithProviders(<FinalCta prices={{ month: 5.99, year: null, taxIncluded: false }} />);

    expect(document.body.textContent).toContain('5,99€ al mes');
    expect(document.body.textContent).not.toContain('4,99');
  });

  test('states no amount when the prices could not be read', () => {
    renderWithProviders(<FinalCta prices={null} />);

    expect(document.body.textContent).not.toMatch(/\d+,\d{2}\s?€/);
    expect(document.body.textContent).toContain('el precio de Pro lo ves antes de pagar');
  });

  test('"sin tarjeta" is scoped to the first time', () => {
    renderWithProviders(<FinalCta prices={null} />);

    expect(screen.getByText(/Sin tarjeta la primera vez/)).toBeTruthy();
  });
});
