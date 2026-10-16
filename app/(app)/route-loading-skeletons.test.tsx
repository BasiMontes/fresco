import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import FavoritesLoading from './favorites/loading';
import HistorialLoading from './historial/loading';
import NotificationsLoading from './notifications/loading';

/**
 * FRESCO-980 (UX-27) — `/notifications`, `/favorites` and `/historial` used to
 * fall back to the generic `(app)/loading.tsx`. Each now has its own skeleton:
 * decorative (hidden from assistive tech), shaped like its page and animated
 * only when the person has not asked for reduced motion.
 */

const SKELETONS = [
  { name: 'notifications', Component: NotificationsLoading, testId: 'notifications_loading_skeleton' },
  { name: 'favorites', Component: FavoritesLoading, testId: 'favorites_loading_skeleton' },
  { name: 'historial', Component: HistorialLoading, testId: 'historial_loading_skeleton' },
];

describe('route loading skeletons', () => {
  for (const { name, Component, testId } of SKELETONS) {
    test(`${name} renders its own decorative skeleton`, () => {
      renderWithProviders(<Component />);

      const skeleton = screen.getByTestId(testId);

      expect(skeleton).toHaveAttribute('aria-hidden', 'true');
      expect(skeleton.querySelectorAll('.motion-safe\\:animate-pulse').length).toBeGreaterThan(3);
      // Never animates unconditionally: every pulse is behind `motion-safe:`.
      expect(skeleton.querySelectorAll('.animate-pulse:not([class*="motion-safe:animate-pulse"])')).toHaveLength(0);
    });
  }

  test('the favorites skeleton keeps the 2 / 3 / 4 column grid of the real page', () => {
    renderWithProviders(<FavoritesLoading />);

    const grid = screen.getByTestId('favorites_loading_skeleton').querySelector('.grid');

    expect(grid?.className).toContain('grid-cols-2');
    expect(grid?.className).toContain('sm:grid-cols-3');
    expect(grid?.className).toContain('lg:grid-cols-4');
  });
});
