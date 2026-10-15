import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { RoutesNotice } from './routes-notice';

/**
 * FRESCO-968 (UX-16, UX-27) — the dismiss control must clear the WCAG 2.2
 * SC 2.5.8 24px target minimum (20px icon + p-2 = 36px, offset by -m-2 so the
 * layout does not move), and the card title sits one level under the page h1.
 */

describe('RoutesNotice', () => {
  test('dismiss button has a padded hit area of at least 24px', () => {
    renderWithProviders(<RoutesNotice />);

    const dismiss = screen.getByTestId('notifications_routes_notice_dismiss');
    expect(dismiss).toHaveClass('p-2');
    expect(dismiss).toHaveClass('-m-2');
  });

  test('card title is an h2 (no jump from the page h1)', () => {
    renderWithProviders(<RoutesNotice />);

    expect(screen.getByRole('heading', { name: 'Explora Fresco', level: 2 })).toBeInTheDocument();
  });
});
