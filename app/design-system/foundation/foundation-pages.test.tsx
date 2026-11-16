import { describe, expect, test } from 'bun:test';
import { GLYPH_NAMES, ICON_NAMES, TYPE_STEPS } from '@/components/design-system/generated';
import { testIdPart } from '@/components/design-system/test-id';
import { renderWithProviders, screen } from '@/tests/component-render';
import DesignSystemPage from '../page';
import ColorsPage from './colors/page';
import IconsPage from './icons/page';
import TypographyPage from './typography/page';

// FRESCO-1207 (PR 2 of 4): the Foundation pages render the committed snapshot.
describe('design-system Foundation pages', () => {
  test('colors: paints a swatch per token with the theme-following background', () => {
    renderWithProviders(<ColorsPage />);

    const swatch = screen.getByTestId('design_system_color_primary');
    expect(screen.getByTestId('design_system_color_accent_2_100')).toBeInTheDocument();
    expect(swatch).toHaveTextContent('Claro: #0f4e0e');
    expect(swatch.querySelector('div')?.getAttribute('style')).toContain('var(--color-primary)');
  });

  test('typography: renders every step of the scale with its metrics', () => {
    renderWithProviders(<TypographyPage />);

    expect(screen.getAllByTestId(/^design_system_type_/)).toHaveLength(TYPE_STEPS.length);
    expect(screen.getByTestId('design_system_type_h1')).toHaveTextContent('44px');
    expect(screen.getByTestId('design_system_type_display_light')).toBeInTheDocument();
  });

  test('icons: renders a tile per lucide icon and the CSS glyphs', () => {
    renderWithProviders(<IconsPage />);

    expect(screen.getAllByTestId(/^design_system_icon_/)).toHaveLength(ICON_NAMES.length + GLYPH_NAMES.length);
    expect(screen.getByTestId('design_system_icon_plus').querySelector('svg')).not.toBeNull();
    expect(screen.getByTestId('design_system_icon_theme_mark')).toBeInTheDocument();
  });

  test('icons: renders a tile for each glyph of the generated list and the ids are unique', () => {
    renderWithProviders(<IconsPage />);

    for (const name of GLYPH_NAMES) {
      expect(screen.getByTestId(`design_system_icon_${testIdPart(name)}`)).toBeInTheDocument();
    }
    const ids = [...ICON_NAMES, ...GLYPH_NAMES].map(testIdPart);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('home: links to the three Foundation pages', () => {
    renderWithProviders(<DesignSystemPage />);

    for (const [label, href] of [['Colores', 'colors'], ['Tipografía', 'typography'], ['Iconos', 'icons']]) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', `/design-system/foundation/${href}`);
    }
  });
});
