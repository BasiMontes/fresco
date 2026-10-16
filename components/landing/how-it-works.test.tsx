import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { HowItWorks } from './how-it-works';

/**
 * FRESCO-934 — the fourth card said Fresco learns "sin que tengas que decir nada". It does
 * not: the Pro learning loop reads the dishes the person marks as cooked or discarded
 * (ADR-0006) and only applies in Pro. The card now says what the app does.
 */
describe('HowItWorks — the learning card tells the truth (FRESCO-934)', () => {
  test('says the learning comes from what the person marks, and that it is a Pro thing', () => {
    renderWithProviders(<HowItWorks />);

    expect(screen.getByText('Cada semana mejora contigo')).toBeTruthy();
    expect(screen.getByText(/Marca lo que cocinas y lo que descartas/)).toBeTruthy();
    expect(screen.getByText(/En Pro, Fresco lo usa para afinar tus menús/)).toBeTruthy();
  });

  test('no longer claims it learns on its own', () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const text = container.textContent ?? '';

    expect(text).not.toContain('Sin que tengas que decir nada');
    expect(text).not.toContain('mejora solo');
  });
});
