import { afterEach, describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';

import { navState } from '@/tests/mocks/next-navigation';
import { DesignSystemNav } from './nav';

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
