import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  test('the segmented variant draws an icon in every segment', () => {
    renderWithProviders(<ThemeToggle />);

    for (const name of ['Tema claro', 'Tema automático (según el sistema)', 'Tema oscuro']) {
      expect(screen.getByRole('radio', { name }).querySelector('svg')).not.toBeNull();
    }
  });

  // FRESCO-1191: `binary` only means "no automatic segment". It must keep the
  // sun and moon icons unless a surface asks for the CSS glyphs.
  test('the binary variant offers only light and dark, each with its icon', () => {
    renderWithProviders(<ThemeToggle variant="binary" />);

    expect(screen.queryByRole('radio', { name: 'Tema automático (según el sistema)' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Tema claro' }).querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('radio', { name: 'Tema oscuro' }).querySelector('svg')).not.toBeNull();
  });

  test('the css glyphs replace the icons on the surfaces that ask for them', () => {
    renderWithProviders(<ThemeToggle variant="binary" glyphs="css" />);

    for (const name of ['Tema claro', 'Tema oscuro']) {
      const radio = screen.getByRole('radio', { name });
      expect(radio.querySelector('svg')).toBeNull();
      expect(radio.querySelector('span[aria-hidden="true"]')).not.toBeNull();
    }
  });
});
