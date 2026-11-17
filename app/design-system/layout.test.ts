import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import DesignSystemLayout, { metadata } from './layout';

describe('design-system layout', () => {
  test('is noindex, nofollow (FRESCO-1207)', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  test('renders the single main landmark the skip link targets', () => {
    const element = DesignSystemLayout({ children: null });

    expect(element.type).toBe('main');
    expect(element.props.id).toBe('main');
  });

  test('shows the Fresco logo, linked to the docs home, with a mark for each theme (FRESCO-1216)', () => {
    renderWithProviders(DesignSystemLayout({ children: null }));

    const brand = screen.getByTestId('design_system_brand');

    expect(brand).toHaveAttribute('href', '/design-system');
    expect(brand.querySelectorAll('img')).toHaveLength(2);
    expect(brand.querySelector('.brand-mark--light')).not.toBeNull();
    expect(brand.querySelector('.brand-mark--dark')).not.toBeNull();
  });
});
