import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as favoritesApi from '@/lib/client-api/favorites';
import { makeFixtureRecipes } from '@/lib/fixtures/recipe';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { FavoritesGrid } from './favorites-grid';

// FRESCO-1078 — /favorites is the one place where unfavoriting must take the card away at once,
// but only once the write is confirmed: a failed write puts the heart back and keeps the card.

let removeSpy: ReturnType<typeof spyOn<typeof favoritesApi, 'removeFavorite'>>;
let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;

beforeEach(() => {
  removeSpy = spyOn(favoritesApi, 'removeFavorite').mockResolvedValue(undefined);
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  removeSpy.mockRestore();
  errorSpy.mockRestore();
});

describe('FavoritesGrid', () => {
  test('with no recipes it shows the empty state', () => {
    renderWithProviders(<FavoritesGrid recipes={[]} />);
    expect(screen.getByTestId('favorites_empty_state')).toHaveTextContent('Todavía no tienes recetas favoritas');
    expect(screen.queryByTestId('favorites_grid')).toBeNull();
  });

  test('shows every recipe as a link to its page, all marked as favorites', () => {
    const recipes = makeFixtureRecipes(3);
    renderWithProviders(<FavoritesGrid recipes={recipes} />);
    expect(screen.getByTestId('favorites_grid')).toBeInTheDocument();
    expect(screen.getAllByRole('link').map(l => l.getAttribute('href'))).toEqual(recipes.map(r => `/recipes/${r.id}`));
    expect(screen.getAllByLabelText('Quitar de favoritos')).toHaveLength(3);
  });

  test('unfavoriting removes the card once the write succeeds', async () => {
    const recipes = makeFixtureRecipes(2);
    renderWithProviders(<FavoritesGrid recipes={recipes} />);
    await setupUser().click(screen.getAllByLabelText('Quitar de favoritos')[0]);
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(1));
    expect(removeSpy).toHaveBeenCalledWith({ recipeId: recipes[0].id });
  });

  test('removing the last favorite leaves the empty state', async () => {
    renderWithProviders(<FavoritesGrid recipes={makeFixtureRecipes(1)} />);
    await setupUser().click(screen.getByLabelText('Quitar de favoritos'));
    expect(await screen.findByTestId('favorites_empty_state')).toBeInTheDocument();
  });

  test('a failed write keeps the card and puts the heart back', async () => {
    removeSpy.mockRejectedValue(new Error('offline'));
    renderWithProviders(<FavoritesGrid recipes={makeFixtureRecipes(2)} />);
    await setupUser().click(screen.getAllByLabelText('Quitar de favoritos')[0]);
    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.getAllByLabelText('Quitar de favoritos')).toHaveLength(2);
  });
});
