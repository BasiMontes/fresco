import { afterEach, describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { navState } from '@/tests/mocks/next-navigation';
import { DesignSystemNav } from './nav';
import { NavLink } from './nav-link';

describe('design-system nav', () => {
  // `navState` is shared by every component test in the run.
  afterEach(() => { navState.pathname = '/'; });

  test('marks only the link of the page being shown as current (FRESCO-1229)', () => {
    navState.pathname = '/design-system/foundation/colors';
    renderWithProviders(<DesignSystemNav />);

    expect(screen.getByRole('link', { name: 'Colores' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Tipografía' })).not.toHaveAttribute('aria-current');
    expect(screen.getAllByRole('link').filter(link => link.getAttribute('aria-current') === 'page')).toHaveLength(1);
  });

  test('a nested page keeps its parent link current, a link sharing only a prefix string does not', () => {
    navState.pathname = '/design-system/foundation/colors/extra';
    renderWithProviders(
      <>
        <NavLink href="/design-system/foundation/colors" label="Padre" />
        <NavLink href="/design-system/foundation/color" label="Prefijo" />
      </>,
    );

    expect(screen.getByRole('link', { name: 'Padre' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Prefijo' })).not.toHaveAttribute('aria-current');
  });

  test('no link is underlined at rest; the current one is semibold primary, the rest muted, hover underlines (FRESCO-1231)', () => {
    navState.pathname = '/design-system/foundation/colors';
    renderWithProviders(<DesignSystemNav />);

    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(3);
    for (const link of links) {
      expect(link).not.toHaveClass('underline');
      expect(link).toHaveClass('hover:underline');
    }
    expect(screen.getByRole('link', { name: 'Colores' })).toHaveClass('font-semibold', 'text-primary');
    expect(screen.getByRole('link', { name: 'Tipografía' })).toHaveClass('text-tertiary');
    expect(screen.getByRole('link', { name: 'Tipografía' })).not.toHaveClass('font-semibold');
  });
});
