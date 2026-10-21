import type { RecetaPropia } from '@schemas';
import type { CatalogCard, CatalogFacets } from '@/lib/api/recipes';
import type { RecipeFilterState } from '@/lib/recipes/recipe-filters';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { RecipeLibrary } from '@/components/recipes/recipe-library';
import * as favorites from '@/lib/client-api/favorites';
import * as mealPlan from '@/lib/client-api/meal-plan';
import { EMPTY_FILTER_STATE } from '@/lib/recipes/recipe-filters';
import { act, renderWithProviders, screen, setupUser, waitFor, within } from '@/tests/component-render';
import { navState, routerMock } from '@/tests/mocks/next-navigation';

// The shared `next/navigation` mock is process-global once any component test imports it, so the
// router the component sees is `routerMock` whatever order the files run in.
const pushMock = routerMock.push as unknown as { mock: { calls: [string][] }, mockClear: () => void };
const router = { bfcacheId: 'test', push: routerMock.push, replace: () => {}, back: () => {}, forward: () => {}, refresh: () => {}, prefetch: () => {} };

const FACETS: CatalogFacets = {
  mealTypes: { comida: 12, cena: 7 },
  cocinas: { española: 9 },
  dietas: { vegano: 3 },
  alergenos: { gluten: 4 },
};

function card(id: string, nombre: string, tipoPlato: 'desayuno' | 'comida' | 'cena' | 'snack' = 'comida'): CatalogCard {
  return {
    id,
    nombre,
    foto_url: null,
    dieta: null,
    clasificacion: { tipo_plato: tipoPlato, categoria: 'pasta', cocina: 'italiana', es_contundente: false, es_ligero: false, es_comfort_food: false, apto_tupper: false, apto_congelar: false },
    meta: { tiempo_prep_min: 5, tiempo_coccion_min: 10, tiempo_total_min: 15, raciones: 2, coste_estimado: 'bajo', dificultad: 'facil' },
  };
}

function propia(id: string, nombre: string): RecetaPropia {
  return { id, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', user_id: 'u', nombre, ingredientes: ['a'], pasos: ['b'] };
}

interface Overrides {
  recipes?: CatalogCard[]
  total?: number
  page?: number
  appliedFilters?: RecipeFilterState
  query?: string
  recetasPropias?: RecetaPropia[]
  favoriteRecipeIds?: Set<string>
}

function renderLibrary(overrides: Overrides = {}) {
  const recipes = overrides.recipes ?? [card('r1', 'Pasta al pesto'), card('r2', 'Ensalada')];
  return renderWithProviders(
    <AppRouterContext.Provider value={router}>
      <PathnameContext.Provider value="/recipes">
        <RecipeLibrary
          recipes={recipes}
          total={overrides.total ?? recipes.length}
          page={overrides.page ?? 1}
          facets={FACETS}
          appliedFilters={overrides.appliedFilters ?? EMPTY_FILTER_STATE}
          query={overrides.query ?? ''}
          recetasPropias={overrides.recetasPropias ?? []}
          favoriteRecipeIds={overrides.favoriteRecipeIds ?? new Set()}
        />
      </PathnameContext.Provider>
    </AppRouterContext.Provider>,
  );
}

function lastPushed(): URL {
  const calls = pushMock.mock.calls;
  return new URL(calls[calls.length - 1][0], 'https://test.fresco.local');
}

let consoleError: ReturnType<typeof spyOn>;
let addFavorite: ReturnType<typeof spyOn>;
let removeFavorite: ReturnType<typeof spyOn>;

beforeEach(() => {
  pushMock.mockClear();
  navState.pathname = '/recipes';
  navState.searchParams = new URLSearchParams();
  window.history.replaceState({}, '', '/recipes');
  consoleError = spyOn(console, 'error').mockImplementation(() => {});
  addFavorite = spyOn(favorites, 'addFavorite').mockResolvedValue(undefined);
  removeFavorite = spyOn(favorites, 'removeFavorite').mockResolvedValue(undefined);
});

afterEach(() => {
  consoleError.mockRestore();
  addFavorite.mockRestore();
  removeFavorite.mockRestore();
  window.history.replaceState({}, '', '/');
});

describe('RecipeLibrary results', () => {
  test('shows the recipes with a plural count, each linking to its detail', () => {
    renderLibrary();

    expect(screen.getByTestId('recipe_library_count')).toHaveTextContent('2 recetas encontradas');
    const grid = within(screen.getByTestId('recipe_library_grid'));
    expect(grid.getByRole('link', { name: /Pasta al pesto/ })).toHaveAttribute('href', '/recipes/r1');
    expect(grid.getByRole('link', { name: /Ensalada/ })).toHaveAttribute('href', '/recipes/r2');
  });

  test('uses the singular for a single recipe and hides "Ver más"', () => {
    renderLibrary({ recipes: [card('r1', 'Pasta al pesto')] });

    expect(screen.getByTestId('recipe_library_count')).toHaveTextContent('1 receta encontrada');
    expect(screen.queryByTestId('recipe_library_load_more_button')).toBeNull();
  });

  test('"Ver más recetas" asks for the next page keeping the current query', async () => {
    window.history.replaceState({}, '', '/recipes?q=pasta');
    const user = setupUser();
    renderLibrary({ recipes: [card('r1', 'Pasta al pesto')], total: 5, page: 2, query: 'pasta' });

    await user.click(screen.getByTestId('recipe_library_load_more_button'));

    expect(lastPushed().pathname).toBe('/recipes');
    expect(lastPushed().searchParams.get('page')).toBe('3');
    expect(lastPushed().searchParams.get('q')).toBe('pasta');
  });

  test('shows the catalog-empty message when nothing narrows the list', () => {
    renderLibrary({ recipes: [], total: 0 });

    expect(screen.getByTestId('recipe_catalog_empty_state')).toHaveTextContent('No encontramos recetas para tu perfil');
    expect(screen.queryByTestId('recipe_library_grid')).toBeNull();
  });

  test('shows the no-results message when a search returns nothing', () => {
    renderLibrary({ recipes: [], total: 0, query: 'zzz' });

    expect(screen.getByTestId('recipe_search_empty_state')).toHaveTextContent('No encontramos nada en el catálogo');
    expect(screen.queryByTestId('recipe_catalog_empty_state')).toBeNull();
  });

  test('shows the no-results message when filters return nothing', () => {
    renderLibrary({ recipes: [], total: 0, appliedFilters: { ...EMPTY_FILTER_STATE, cocinas: ['española'] } });

    expect(screen.getByTestId('recipe_search_empty_state')).toBeInTheDocument();
  });

  test('lists the user own recipes in their own section, even with an empty catalog', () => {
    renderLibrary({ recipes: [], total: 0, recetasPropias: [propia('p1', 'Mi crema')] });

    const section = within(screen.getByTestId('personal_recipes_section'));
    expect(section.getByRole('heading', { name: 'Tus recetas' })).toBeInTheDocument();
    expect(section.getByRole('link', { name: /Mi crema/ })).toHaveAttribute('href', '/recipes/p1');
  });

  test('has no own-recipes section when the user has none', () => {
    renderLibrary();

    expect(screen.queryByTestId('personal_recipes_section')).toBeNull();
  });

  test('toggling the heart of a card saves and removes the favorite', async () => {
    const user = setupUser();
    renderLibrary({ recipes: [card('r1', 'Pasta al pesto')], favoriteRecipeIds: new Set() });

    await user.click(screen.getByRole('button', { name: 'Guardar en favoritos' }));
    await waitFor(() => expect(addFavorite).toHaveBeenCalledWith({ recipeId: 'r1' }));

    await user.click(await screen.findByRole('button', { name: 'Quitar de favoritos' }));
    await waitFor(() => expect(removeFavorite).toHaveBeenCalledWith({ recipeId: 'r1' }));
  });

  test('a card starts as favorite when its id is in the favorites set', () => {
    renderLibrary({ recipes: [card('r1', 'Pasta al pesto')], favoriteRecipeIds: new Set(['r1']) });

    expect(screen.getByRole('button', { name: 'Quitar de favoritos' })).toBeInTheDocument();
  });
});

describe('RecipeLibrary search', () => {
  test('typing navigates to ?q= after the debounce and resets the page', async () => {
    window.history.replaceState({}, '', '/recipes?page=3');
    const user = setupUser();
    renderLibrary();

    await user.type(screen.getByTestId('recipe_search_input'), 'pollo');
    expect(pushMock).not.toHaveBeenCalled();

    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect(lastPushed().searchParams.get('q')).toBe('pollo');
    expect(lastPushed().searchParams.has('page')).toBe(false);
  });

  test('clearing the search removes ?q= from the URL', async () => {
    window.history.replaceState({}, '', '/recipes?q=pasta');
    const user = setupUser();
    renderLibrary({ query: 'pasta' });

    await user.clear(screen.getByTestId('recipe_search_input'));

    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect(lastPushed().searchParams.has('q')).toBe(false);
  });

  test('does not navigate when the typed text equals the current query', async () => {
    renderLibrary({ query: 'pasta' });

    await act(async () => new Promise(resolve => setTimeout(resolve, 400)));

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('recipe_search_input')).toHaveValue('pasta');
  });

  test('keeps the input aligned with the query coming from the URL', () => {
    const view = renderLibrary({ query: 'pasta' });
    expect(screen.getByTestId('recipe_search_input')).toHaveValue('pasta');

    view.rerender(
      <AppRouterContext.Provider value={router}>
        <PathnameContext.Provider value="/recipes">
          <RecipeLibrary recipes={[]} total={0} page={1} facets={FACETS} appliedFilters={EMPTY_FILTER_STATE} query="" recetasPropias={[]} favoriteRecipeIds={new Set()} />
        </PathnameContext.Provider>
      </AppRouterContext.Provider>,
    );

    expect(screen.getByTestId('recipe_search_input')).toHaveValue('');
  });
});

describe('RecipeLibrary filters', () => {
  async function openDrawer() {
    const user = setupUser();
    await user.click(screen.getByTestId('filtrar_y_ordenar_button'));
    return user;
  }

  test('the filter button shows the number of applied filters', () => {
    renderLibrary({ appliedFilters: { ...EMPTY_FILTER_STATE, cocinas: ['española'], dietas: ['vegano'] } });

    expect(screen.getByTestId('filtrar_y_ordenar_button')).toHaveTextContent('2');
  });

  test('opens the drawer with the four sections and the server facet counts', async () => {
    renderLibrary();
    const user = await openDrawer();

    expect(screen.getByTestId('recipe_filter_drawer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Borrar todo' })).toBeNull();

    await user.click(screen.getByTestId('recipe_filter_section_comida'));
    const label = screen.getByText('Comida', { selector: 'span.text-body-md' }).closest('label') as HTMLElement;
    expect(label).toHaveTextContent('12');
    expect(screen.getByTestId('recipe_filter_section_cocina')).toBeInTheDocument();
    expect(screen.getByTestId('recipe_filter_section_dieta')).toBeInTheDocument();
    expect(screen.getByTestId('recipe_filter_section_alergeno')).toBeInTheDocument();
  });

  test('applying the chosen filters navigates with their params, keeps the typed query and resets the page', async () => {
    window.history.replaceState({}, '', '/recipes?page=2');
    renderLibrary();
    const user = await openDrawer();

    await user.type(screen.getByTestId('recipe_search_input'), 'sopa');
    await user.click(screen.getByTestId('recipe_filter_section_comida'));
    await user.click(screen.getByRole('checkbox', { name: /Cena/ }));
    await user.click(screen.getByTestId('recipe_filter_section_alergeno'));
    await user.click(screen.getByRole('checkbox', { name: /Gluten/ }));
    await user.click(screen.getByTestId('recipe_filter_drawer_apply_button'));

    const url = lastPushed();
    expect(url.searchParams.get('meal')).toBe('cena');
    expect(url.searchParams.get('alergeno')).toBe('gluten');
    expect(url.searchParams.get('q')).toBe('sopa');
    expect(url.searchParams.has('page')).toBe(false);
    expect(url.searchParams.has('cocina')).toBe(false);
  });

  test('applying with an empty search drops ?q= from the URL', async () => {
    window.history.replaceState({}, '', '/recipes?q=pasta');
    renderLibrary({ query: 'pasta' });
    const user = await openDrawer();
    await user.clear(screen.getByTestId('recipe_search_input'));

    await user.click(screen.getByTestId('recipe_filter_drawer_apply_button'));

    expect(lastPushed().searchParams.has('q')).toBe(false);
  });

  test('applied filters appear as removable chips that can be cleared one by one', async () => {
    renderLibrary({ appliedFilters: { mealTypes: ['comida'], cocinas: ['española'], dietas: ['vegano'], alergenos: ['gluten'] } });
    const user = await openDrawer();

    for (const name of ['Comida', 'Española', 'Vegano', 'Gluten']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: 'Vegano' }));
    expect(screen.queryByRole('button', { name: 'Vegano' })).toBeNull();
  });

  test('"Borrar todo" empties the draft and Apply then removes every filter param', async () => {
    window.history.replaceState({}, '', '/recipes?cocina=espa%C3%B1ola&dieta=vegano');
    renderLibrary({ appliedFilters: { ...EMPTY_FILTER_STATE, cocinas: ['española'], dietas: ['vegano'] } });
    const user = await openDrawer();

    await user.click(screen.getByRole('button', { name: 'Borrar todo' }));
    expect(screen.queryByRole('button', { name: 'Borrar todo' })).toBeNull();
    await user.click(screen.getByTestId('recipe_filter_drawer_apply_button'));

    expect(lastPushed().searchParams.has('cocina')).toBe(false);
    expect(lastPushed().searchParams.has('dieta')).toBe(false);
  });

  test('closing the drawer discards the draft: it reopens on the applied state', async () => {
    renderLibrary();
    const user = await openDrawer();
    await user.click(screen.getByTestId('recipe_filter_section_cocina'));
    await user.click(screen.getByRole('checkbox', { name: /Italiana/ }));
    expect(screen.getByRole('button', { name: 'Italiana' })).toBeInTheDocument();

    await user.click(screen.getByTestId('recipe_filter_drawer_close_button'));
    await waitFor(() => expect(screen.queryByTestId('recipe_filter_drawer') === null).toBe(true));
    await user.click(screen.getByTestId('filtrar_y_ordenar_button'));

    expect(screen.queryByRole('button', { name: 'Italiana' })).toBeNull();
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe('RecipeLibrary create and add to menu', () => {
  test('"Crear propia" opens the create-recipe form', async () => {
    const user = setupUser();
    renderLibrary();

    await user.click(screen.getByTestId('crear_propia_button'));

    expect(await screen.findByTestId('create_recipe_dialog')).toBeInTheDocument();
  });

  test('a recipe with a meal type offers "Añadir al menú" and opens the dialog for it', async () => {
    const listOpenSlots = spyOn(mealPlan, 'listOpenSlots').mockResolvedValue({ slots: [], tieneListaCompra: false });
    const user = setupUser();
    renderLibrary({ recipes: [card('r1', 'Pasta al pesto', 'comida')] });

    await user.click(screen.getByTestId('recipe_card_add_to_menu_button'));

    expect(await screen.findByTestId('add_to_menu_dialog')).toBeInTheDocument();
    await waitFor(() => expect(listOpenSlots).toHaveBeenCalledWith({ tipoPlato: 'comida' }));
    expect(pushMock).not.toHaveBeenCalled();
    listOpenSlots.mockRestore();
  });

  test('a snack has no meal slot, so it offers no "Añadir al menú"', () => {
    renderLibrary({ recipes: [card('r1', 'Fruta', 'snack')] });

    expect(screen.queryByTestId('recipe_card_add_to_menu_button')).toBeNull();
  });
});
