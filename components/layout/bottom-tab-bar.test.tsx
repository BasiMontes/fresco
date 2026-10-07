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

  // FRESCO-757: the bar is `fixed`; it follows the cookie banner's height so it
  // never sits under it (the variable is 0 once the banner is gone).
  test('is offset by the cookie banner inset instead of pinned to the bottom edge', () => {
    renderWithProviders(<BottomTabBar />);

    expect(screen.getByRole('navigation').className).toContain('var(--cookie-banner-inset)');
  });

  // FRESCO-870: floating pill — detached from the edges, no top rule.
  test('floats as a pill instead of a full-width bar with a top rule', () => {
    renderWithProviders(<BottomTabBar />);

    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('rounded-full');
    expect(nav.className).not.toContain('border-t');
  });

  test('only the current destination expands its label; the rest stay icon-only', () => {
    navState.pathname = '/recipes';
    renderWithProviders(<BottomTabBar />);

    expect(screen.getByRole('link', { name: /Recetas/ })).toHaveAttribute('data-expanded', 'true');
    ['Menú', 'Calendario', 'Lista', 'Perfil'].forEach(label =>
      expect(screen.getByRole('link', { name: new RegExp(label) })).toHaveAttribute('data-expanded', 'false'),
    );
  });

  test('every destination keeps its name for assistive tech and a 44px touch target', () => {
    renderWithProviders(<BottomTabBar />);

    screen.getAllByRole('link').forEach((link) => {
      expect(link.className).toContain('h-11');
      expect(link.className).toContain('min-w-11');
      expect(link).toHaveAccessibleName();
    });
  });

  test('animation is dropped under reduced motion', () => {
    renderWithProviders(<BottomTabBar />);

    const label = screen.getByText('Menú').parentElement;
    expect(label?.className).toContain('motion-reduce:transition-none');
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
