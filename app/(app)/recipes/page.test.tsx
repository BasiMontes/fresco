import type { CatalogCard, CatalogPage } from '@/lib/api/recipes';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as favoritesApi from '@/lib/api/favorites';
import * as recipesApi from '@/lib/api/recipes';
import { RECIPE_PAGE_SIZE } from '@/lib/recipes/recipe-filters';
import { renderWithProviders, screen } from '@/tests/component-render';
import '@/tests/mocks/next-navigation';

// FRESCO-1079 — /recipes is driven entirely by the URL (search, page, filters). The page turns the
// query string into catalog parameters, and a failed catalog read shows a load error with a retry,
// never an empty "no recipes" that would read as a real empty catalog. Only the data reads are replaced.

void mock.module('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) } }),
}));

const { default: RecipesPage } = await import('./page');

function card(id: string, nombre: string): CatalogCard {
  return {
    id,
    nombre,
    foto_url: null,
    dieta: null,
    clasificacion: { tipo_plato: 'comida', categoria: 'pasta', cocina: 'italiana', es_contundente: false, es_ligero: false, es_comfort_food: false, apto_tupper: false, apto_congelar: false },
    meta: { tiempo_prep_min: 5, tiempo_coccion_min: 10, tiempo_total_min: 15, raciones: 2, coste_estimado: 'bajo', dificultad: 'facil' },
  };
}

const CATALOG: CatalogPage = {
  recipes: [card('r1', 'Pasta al pesto'), card('r2', 'Ensalada')],
  total: 2,
  facets: { mealTypes: { comida: 2 }, cocinas: {}, dietas: {}, alergenos: {} },
};

let catalogSpy: ReturnType<typeof spyOn<typeof recipesApi, 'getCatalog'>>;
let propiasSpy: ReturnType<typeof spyOn<typeof recipesApi, 'getRecetasPropias'>>;
let favoritesSpy: ReturnType<typeof spyOn<typeof favoritesApi, 'getFavoriteRecipeIds'>>;
let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;

beforeEach(() => {
  catalogSpy = spyOn(recipesApi, 'getCatalog').mockResolvedValue(CATALOG);
  propiasSpy = spyOn(recipesApi, 'getRecetasPropias').mockResolvedValue([]);
  favoritesSpy = spyOn(favoritesApi, 'getFavoriteRecipeIds').mockResolvedValue(new Set<string>());
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  for (const spy of [catalogSpy, propiasSpy, favoritesSpy, errorSpy]) { spy.mockRestore(); }
});

const renderPage = async (params: Record<string, string | string[] | undefined> = {}) => {
  renderWithProviders(await RecipesPage({ searchParams: Promise.resolve(params) }));
};
const lastParams = () => catalogSpy.mock.calls.at(-1)![1] as Record<string, unknown>;

describe('RecipesPage', () => {
  test('shows the title and the recipes of the catalog', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Biblioteca');
    expect(screen.getByText('Pasta al pesto')).toBeInTheDocument();
    expect(screen.getByText('Ensalada')).toBeInTheDocument();
  });

  test('without any query it asks for the first page, for the signed-in user', async () => {
    await renderPage();
    expect(lastParams()).toMatchObject({ search: undefined, limit: RECIPE_PAGE_SIZE, offset: 0, userId: 'user-1', mealTypes: [], cocinas: [], dietas: [], alergenos: [] });
  });

  test('the search text is trimmed and passed on', async () => {
    await renderPage({ q: '  pasta ' });
    expect(lastParams().search).toBe('pasta');
  });

  test('a repeated q parameter uses the first one', async () => {
    await renderPage({ q: ['arroz', 'pasta'] });
    expect(lastParams().search).toBe('arroz');
  });

  test('?page=N asks for the first N pages in one go, so "Ver más" appends', async () => {
    await renderPage({ page: '3' });
    expect(lastParams().limit).toBe(3 * RECIPE_PAGE_SIZE);
  });

  test('a bad ?page falls back to the first page', async () => {
    await renderPage({ page: 'x' });
    expect(lastParams().limit).toBe(RECIPE_PAGE_SIZE);
    await renderPage({ page: '-4' });
    expect(lastParams().limit).toBe(RECIPE_PAGE_SIZE);
  });

  test('the four filter lists are split on commas and trimmed, ignoring empty items', async () => {
    await renderPage({ meal: 'comida, cena,', cocina: 'española', dieta: ['vegano', 'sin_gluten'], alergeno: 'gluten' });
    expect(lastParams()).toMatchObject({ mealTypes: ['comida', 'cena'], cocinas: ['española'], dietas: ['vegano', 'sin_gluten'], alergenos: ['gluten'] });
  });

  test('a failed catalog read shows the load error with a retry, not an empty catalog', async () => {
    catalogSpy.mockRejectedValue(new Error('db down'));
    await renderPage();
    expect(screen.getByTestId('recipe_library_load_error')).toBeInTheDocument();
    expect(screen.getByTestId('recipe_library_retry_button')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalled();
  });

  test('failing own-recipes and favorites reads do not take the page down', async () => {
    propiasSpy.mockRejectedValue(new Error('x'));
    favoritesSpy.mockRejectedValue(new Error('y'));
    await renderPage();
    expect(screen.getByText('Pasta al pesto')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });
});
