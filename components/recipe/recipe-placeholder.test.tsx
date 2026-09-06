import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { RecipePlaceholder } from './recipe-placeholder';

/**
 * FRESCO-441 — the designed "no photo" state. Pins the typographic initial
 * (uppercased first grapheme), the empty-name fallback, and multi-byte
 * safety.
 */
describe('RecipePlaceholder', () => {
  test('renders the uppercased first letter of the recipe name', () => {
    renderWithProviders(<RecipePlaceholder name="paella de marisco" categoria="arroz" />);
    expect(screen.getByTestId('recipe_placeholder')).toHaveTextContent('P');
  });

  test('falls back to a neutral glyph for an empty / whitespace name', () => {
    renderWithProviders(<RecipePlaceholder name="   " categoria={null} />);
    expect(screen.getByTestId('recipe_placeholder')).toHaveTextContent('·');
  });

  test('keeps an accented leading letter intact', () => {
    renderWithProviders(<RecipePlaceholder name="ñoquis" categoria={null} />);
    expect(screen.getByTestId('recipe_placeholder')).toHaveTextContent('Ñ');
  });

  test('is hidden from assistive tech (the card heading carries the name)', () => {
    renderWithProviders(<RecipePlaceholder name="Paella" categoria="arroz" />);
    expect(screen.getByTestId('recipe_placeholder')).toHaveAttribute('aria-hidden', 'true');
  });
});
