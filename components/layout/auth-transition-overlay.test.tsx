import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { AuthTransitionOverlay } from './auth-transition-overlay';

/**
 * FRESCO-482 — the cover the login / signup pages mount after a successful
 * auth call. It must be an announced status region (so a screen reader hears
 * the wait) and carry the caller's label.
 */
describe('AuthTransitionOverlay', () => {
  test('renders the label inside a polite status region', () => {
    renderWithProviders(<AuthTransitionOverlay label="Entrando en tu cuenta…" />);
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Entrando en tu cuenta…');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  test('covers the viewport', () => {
    renderWithProviders(<AuthTransitionOverlay label="Preparando tu cuenta…" />);
    expect(screen.getByTestId('auth_transition_overlay').className).toContain('fixed');
  });
});
