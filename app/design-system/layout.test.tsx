import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { navState } from '@/tests/mocks/next-navigation';
import DesignSystemLayout, { metadata } from './layout';

describe('design-system layout', () => {
  // The layout renders the nav, which reads `usePathname()`; the mock state is shared by the whole run.
  beforeEach(() => { navState.pathname = '/design-system/foundation/colors'; });
  afterEach(() => { navState.pathname = '/'; });

  test('is noindex, nofollow (FRESCO-1207)', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  test('renders the single main landmark the skip link targets', () => {
    const element = DesignSystemLayout({ children: null });

    expect(element.type).toBe('main');
    expect(element.props.id).toBe('main');
  });

  test('puts the "Sistema de diseño" eyebrow once above the page content, not in the header (FRESCO-1230)', () => {
    renderWithProviders(DesignSystemLayout({ children: <h1>Colores</h1> }));

    const eyebrow = screen.getByTestId('design_system_eyebrow');
    const title = screen.getByRole('heading', { name: 'Colores' });
    const brand = screen.getByTestId('design_system_brand');

    expect(screen.getAllByText('Sistema de diseño')).toHaveLength(1);
    expect(eyebrow).toHaveTextContent('Sistema de diseño');
    expect(eyebrow).toHaveClass('text-h6', 'uppercase', 'text-tertiary');
    expect(eyebrow.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(brand).not.toHaveTextContent('Sistema de diseño');
    expect(brand.querySelector('span')).toBeNull();
  });

  test('has no text-box trim hack left in the header (FRESCO-1230)', () => {
    const { container } = renderWithProviders(DesignSystemLayout({ children: null }));

    expect(container.innerHTML).not.toContain('text-box');
  });

  test('shows the Fresco logo, linked to the docs home, with a mark for each theme (FRESCO-1216)', () => {
    renderWithProviders(DesignSystemLayout({ children: null }));

    const brand = screen.getByTestId('design_system_brand');

    expect(brand).toHaveAttribute('href', '/design-system/foundation/colors');
    expect(brand.querySelectorAll('img')).toHaveLength(2);
    expect(brand.querySelector('.brand-mark--light')).not.toBeNull();
    expect(brand.querySelector('.brand-mark--dark')).not.toBeNull();
  });
});
