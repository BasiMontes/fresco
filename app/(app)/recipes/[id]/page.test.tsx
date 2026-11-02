import type { Recipe } from '@schemas';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as favoritesApi from '@/lib/api/favorites';
import * as recipesApi from '@/lib/api/recipes';
import { makeFixtureRecipe } from '@/lib/fixtures/recipe';
import * as slotContext from '@/lib/ingredients/get-slot-substitution-context';
import { renderWithProviders, screen } from '@/tests/component-render';
import '@/tests/mocks/next-navigation';

// FRESCO-1080 — /recipes/[id]: the recipe detail. Only the Supabase client and the three reads the page
// makes are replaced. The page must degrade, never crash: a failed recipe read is the not-found state,
// a failed favorites read is "not a favorite", and a slot that does not match is no substitution UI.

void mock.module('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) } }),
}));

const { default: RecipeDetailPage, metadata } = await import('./page');

const RECIPE: Recipe = makeFixtureRecipe({ id: 'rec-1', nombre: 'Tortilla de patatas' });

let detailSpy: ReturnType<typeof spyOn<typeof recipesApi, 'getRecipeDetail'>>;
let favoritesSpy: ReturnType<typeof spyOn<typeof favoritesApi, 'getFavoriteRecipeIds'>>;
let slotSpy: ReturnType<typeof spyOn<typeof slotContext, 'getSlotSubstitutionContext'>>;
let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;

beforeEach(() => {
  detailSpy = spyOn(recipesApi, 'getRecipeDetail').mockResolvedValue({ kind: 'catalogo', receta: RECIPE });
  favoritesSpy = spyOn(favoritesApi, 'getFavoriteRecipeIds').mockResolvedValue(new Set());
  slotSpy = spyOn(slotContext, 'getSlotSubstitutionContext').mockResolvedValue(null);
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  for (const spy of [detailSpy, favoritesSpy, slotSpy, errorSpy]) { spy.mockRestore(); }
});

async function renderPage({ id = 'rec-1', from, slot }: { id?: string, from?: string, slot?: string } = {}) {
  renderWithProviders(await RecipeDetailPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({ from, slot }),
  }));
}

describe('RecipeDetailPage', () => {
  test('has its own tab title', () => {
    expect(metadata.title).toBe('Receta · Fresco');
  });

  test('shows the recipe, read for the signed-in user', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tortilla de patatas');
    expect(detailSpy).toHaveBeenCalledWith(expect.anything(), { id: 'rec-1', userId: 'user-1' });
    expect(screen.queryByTestId('recipe_detail_not_found')).toBeNull();
  });

  test('a recipe that does not exist for this profile is the not-found state', async () => {
    detailSpy.mockResolvedValue(null);
    await renderPage();

    expect(screen.getByTestId('recipe_detail_not_found')).toBeInTheDocument();
  });

  test('a failing recipe read falls back to not-found and logs it', async () => {
    detailSpy.mockRejectedValue(new Error('db down'));
    await renderPage();

    expect(screen.getByTestId('recipe_detail_not_found')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalled();
  });

  test('a failing favorites read still shows the recipe, as not favorited, and logs it', async () => {
    favoritesSpy.mockRejectedValue(new Error('db down'));
    await renderPage();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tortilla de patatas');
    expect(errorSpy).toHaveBeenCalled();
  });

  test('a recipe the user has favorited is shown as favorited', async () => {
    favoritesSpy.mockResolvedValue(new Set(['rec-1']));
    await renderPage();

    expect(screen.getByRole('button', { name: /quitar de favoritos/i })).toBeInTheDocument();
  });

  test('a recipe that is not a favorite offers to add it', async () => {
    await renderPage();

    expect(screen.getByRole('button', { name: /a(?:ñ|n)adir a favoritos|guardar/i })).toBeInTheDocument();
  });

  test('"from" decides where the back link goes', async () => {
    await renderPage({ from: 'menu' });

    expect(screen.getByTestId('recipe_detail_back_link')).toHaveAttribute('href', '/menu');
  });

  test('the slot from the calendar is looked up for the recipe being shown, only when the recipe exists', async () => {
    await renderPage({ slot: 'slot-1' });
    expect(slotSpy).toHaveBeenCalledWith(expect.anything(), { slotId: 'slot-1', recipeId: 'rec-1' });

    slotSpy.mockClear();
    detailSpy.mockResolvedValue(null);
    await renderPage({ slot: 'slot-1' });
    expect(slotSpy).not.toHaveBeenCalled();
  });
});
