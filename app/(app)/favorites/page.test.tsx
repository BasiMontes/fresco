import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as favoritesApi from '@/lib/api/favorites';
import { makeFixtureRecipes } from '@/lib/fixtures/recipe';
import { renderWithProviders, screen } from '@/tests/component-render';
import '@/tests/mocks/next-navigation';

// FRESCO-1079 — /favorites: the user's favorite recipes, and the empty state when there are none or
// the read fails. Only the Supabase client and the favorites read are replaced.

void mock.module('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) } }),
}));

const { default: FavoritesPage } = await import('./page');

let favoritesSpy: ReturnType<typeof spyOn<typeof favoritesApi, 'getFavoriteRecipes'>>;
let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;

beforeEach(() => {
  favoritesSpy = spyOn(favoritesApi, 'getFavoriteRecipes').mockResolvedValue([]);
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  favoritesSpy.mockRestore();
  errorSpy.mockRestore();
});

const renderPage = async () => { renderWithProviders(await FavoritesPage()); };

describe('FavoritesPage', () => {
  test('shows the title and a way back to the menu', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tus Favoritos');
    expect(screen.getByTestId('favorites_back_link')).toHaveAttribute('href', '/menu');
  });

  test('with no favorites it shows the empty state', async () => {
    await renderPage();
    expect(screen.getByTestId('favorites_empty_state')).toBeInTheDocument();
  });

  test('shows the favorite recipes of the signed-in user', async () => {
    favoritesSpy.mockResolvedValue(makeFixtureRecipes(3));
    await renderPage();
    expect(screen.getByTestId('favorites_grid')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Quitar de favoritos')).toHaveLength(3);
    expect(favoritesSpy).toHaveBeenCalledWith(expect.anything(), 'user-1');
  });

  test('a failing read falls back to the empty state and logs it', async () => {
    favoritesSpy.mockRejectedValue(new Error('db down'));
    await renderPage();
    expect(screen.getByTestId('favorites_empty_state')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalled();
  });
});
