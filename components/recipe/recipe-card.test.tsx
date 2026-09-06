import type { RecipeCardData } from './recipe-card';
import { describe, expect, mock, test } from 'bun:test';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';

/**
 * `next/image` reads `window.location` during render and pulls the Next
 * image loader — neither is worth booting for a card unit test. A plain
 * `<img>` passthrough keeps the photo-vs-placeholder branch assertion
 * honest without the framework weight. Local to this file; no other
 * component test renders `next/image`.
 */
void mock.module('next/image', () => ({
  default: ({ src, alt }: { src: string, alt: string }) => <img src={src} alt={alt} />,
}));

const { RecipeCard } = await import('./recipe-card');

/**
 * FRESCO-441 — photo-forward recipe card. Pins the photo-vs-placeholder
 * branch, the calmed `h5` title, and the favourite overlay wiring.
 */
const RECIPE: RecipeCardData = {
  id: 'r-1',
  nombre: 'Paella de marisco',
  foto_url: null,
  dieta: null,
  clasificacion: {
    tipo_plato: 'comida',
    categoria: 'arroz',
    cocina: 'española',
    es_contundente: true,
    es_ligero: false,
    es_comfort_food: true,
    apto_tupper: true,
    apto_congelar: false,
  },
  meta: {
    tiempo_prep_min: 15,
    tiempo_coccion_min: 35,
    tiempo_total_min: 50,
    raciones: 4,
    coste_estimado: 'medio',
    dificultad: 'media',
  },
};

describe('RecipeCard', () => {
  test('renders the designed placeholder (not a bare icon) when there is no photo', () => {
    renderWithProviders(<RecipeCard recipe={RECIPE} />);
    expect(screen.getByTestId('recipe_placeholder')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  test('renders the real photo when foto_url is set, and drops the placeholder', () => {
    renderWithProviders(<RecipeCard recipe={{ ...RECIPE, foto_url: 'https://example.com/paella.jpg' }} />);
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'Paella de marisco');
    expect(screen.queryByTestId('recipe_placeholder')).toBeNull();
  });

  test('shows the recipe name as a calm h5 title', () => {
    renderWithProviders(<RecipeCard recipe={RECIPE} />);
    const title = screen.getByRole('heading', { name: 'Paella de marisco' });
    expect(title.className).toContain('text-h5');
    expect(title.className).toContain('line-clamp-2');
  });

  test('fires onToggleFavorite from the overlay favourite button', async () => {
    const user = setupUser();
    let toggled = 0;
    // `isFavorite` already true → the click is an un-like, which skips the
    // like-burst path (that path is covered by FRESCO-248's own tests).
    renderWithProviders(<RecipeCard recipe={RECIPE} isFavorite onToggleFavorite={() => { toggled += 1; }} />);

    await user.click(screen.getByRole('button', { name: 'Quitar de favoritos' }));
    expect(toggled).toBe(1);
  });
});
