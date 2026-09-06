import { describe, expect, mock, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';

/**
 * `next/image` boots the Next image loader + reads `window.location`. A plain
 * `<img>` passthrough that keeps `className` is enough to assert the shared
 * crop + grade contract. Local to this file.
 */
void mock.module('next/image', () => ({
  default: ({ src, alt, className }: { src: string, alt: string, className?: string }) => (
    <img src={src} alt={alt} className={className} />
  ),
}));

const { RecipeCardMedia } = await import('./recipe-card-media');

/**
 * FRESCO-447 — every recipe photo surface crops to the same `aspect-[4/3]`
 * and carries the single `.recipe-photo` grade; the no-photo placeholder does
 * NOT get the grade (it is a designed gradient).
 */
describe('RecipeCardMedia', () => {
  test('real photo: 4/3 container, cover fit, and the shared .recipe-photo grade', () => {
    const { container } = renderWithProviders(
      <RecipeCardMedia fotoUrl="https://example.com/paella.jpg" nombre="Paella" categoria="arroz" />,
    );

    expect(container.firstElementChild?.className).toContain('aspect-[4/3]');

    const img = screen.getByRole('img');
    expect(img.className).toContain('recipe-photo');
    expect(img.className).toContain('object-cover');
    expect(screen.queryByTestId('recipe_placeholder')).toBeNull();
  });

  test('no photo: designed placeholder, no image, no grade class', () => {
    renderWithProviders(<RecipeCardMedia fotoUrl={null} nombre="Paella" categoria="arroz" />);

    const placeholder = screen.getByTestId('recipe_placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder.className).not.toContain('recipe-photo');
    expect(screen.queryByRole('img')).toBeNull();
  });
});
