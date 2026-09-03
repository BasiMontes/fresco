import { afterEach, describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { navState } from '@/tests/mocks/next-navigation';
import { BottomTabBar } from './bottom-tab-bar';

/**
 * FRESCO-409 — `BottomTabBar` marks the tab whose href prefixes the current
 * path as `aria-current="page"`. Tests pin that active-tab derivation.
 */

describe('BottomTabBar', () => {
  afterEach(() => {
    navState.pathname = '/';
  });

  test('renders the five app destinations', () => {
    renderWithProviders(<BottomTabBar />);

    ['Menú', 'Calendario', 'Recetas', 'Lista', 'Perfil'].forEach(label =>
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument(),
    );
  });

  test('marks the tab matching the current path as current', () => {
    navState.pathname = '/calendar';
    renderWithProviders(<BottomTabBar />);

    expect(screen.getByRole('link', { name: /Calendario/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Menú/ })).not.toHaveAttribute('aria-current');
  });

  test('matches on path prefix, not exact equality', () => {
    navState.pathname = '/recipes/abc-123';
    renderWithProviders(<BottomTabBar />);

    expect(screen.getByRole('link', { name: /Recetas/ })).toHaveAttribute('aria-current', 'page');
  });
});
