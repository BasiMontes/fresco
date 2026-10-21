import type { CatalogRecipeSearchResult } from '@/lib/api/admin-recipes';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as adminRecipesClient from '@/lib/client-api/admin-recipes';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { AdminRecipeSearch } from './admin-recipe-search';

const LENTEJAS: CatalogRecipeSearchResult = { id: 'r1', slug: 'lentejas-estofadas', nombre: 'Lentejas estofadas', foto_url: 'https://images.unsplash.com/photo-1?w=100' };
const TORTILLA: CatalogRecipeSearchResult = { id: 'r2', slug: 'tortilla-patata', nombre: 'Tortilla de patata', foto_url: null };

describe('AdminRecipeSearch', () => {
  let search: ReturnType<typeof spyOn<typeof adminRecipesClient, 'searchCatalogRecipes'>>;

  beforeEach(() => {
    search = spyOn(adminRecipesClient, 'searchCatalogRecipes').mockResolvedValue([]);
  });

  afterEach(() => {
    search.mockRestore();
  });

  async function typeQuery(text: string) {
    const user = setupUser();
    await user.type(screen.getByTestId('admin_recipe_search_input'), text);
  }

  test('starts with a hint and runs no search', () => {
    renderWithProviders(<AdminRecipeSearch />);

    expect(screen.getByTestId('admin_recipe_search_hint')).toHaveTextContent('Escribe un nombre o slug');
    expect(search).not.toHaveBeenCalled();
  });

  test('lists the matching recipes with name, slug and photo or placeholder', async () => {
    search.mockResolvedValue([LENTEJAS, TORTILLA]);
    renderWithProviders(<AdminRecipeSearch />);

    await typeQuery('len');

    expect(await screen.findByTestId('admin_recipe_search_results')).toBeInTheDocument();
    expect(screen.getAllByTestId('admin_recipe_result_item')).toHaveLength(2);
    expect(screen.getByText('lentejas-estofadas')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Lentejas estofadas' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Tortilla de patata' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin_recipe_search_hint')).not.toBeInTheDocument();
  });

  test('debounces keystrokes into a single search with the trimmed query', async () => {
    search.mockResolvedValue([LENTEJAS]);
    renderWithProviders(<AdminRecipeSearch />);

    await typeQuery('  len ');
    await screen.findByTestId('admin_recipe_search_results');

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('len');
  });

  test('shows a loading message while the search is pending', async () => {
    let resolve: (value: CatalogRecipeSearchResult[]) => void = () => {};
    search.mockImplementation(async () => new Promise((r) => { resolve = r; }));
    renderWithProviders(<AdminRecipeSearch />);

    await typeQuery('a');

    expect(screen.getByTestId('admin_recipe_search_loading')).toHaveTextContent('Buscando...');
    await waitFor(() => expect(search).toHaveBeenCalled());
    resolve([LENTEJAS]);
    await screen.findByTestId('admin_recipe_search_results');
    expect(screen.queryByTestId('admin_recipe_search_loading')).not.toBeInTheDocument();
  });

  test('shows an empty state when nothing matches', async () => {
    renderWithProviders(<AdminRecipeSearch />);

    await typeQuery('zzz');

    expect(await screen.findByTestId('admin_recipe_search_empty_state')).toHaveTextContent('No encontramos recetas para esa búsqueda');
  });

  test('shows the error message when the search fails', async () => {
    search.mockRejectedValue(new Error('Sin permisos'));
    renderWithProviders(<AdminRecipeSearch />);

    await typeQuery('len');

    expect(await screen.findByTestId('admin_recipe_search_error')).toHaveTextContent('Sin permisos');
  });

  test('falls back to a generic message when the failure is not an Error', async () => {
    search.mockRejectedValue('boom');
    renderWithProviders(<AdminRecipeSearch />);

    await typeQuery('len');

    expect(await screen.findByTestId('admin_recipe_search_error')).toHaveTextContent('No se pudo buscar en el catálogo.');
  });

  test('clearing the input goes back to the hint and drops the results', async () => {
    search.mockResolvedValue([LENTEJAS]);
    const user = setupUser();
    renderWithProviders(<AdminRecipeSearch />);

    const input = screen.getByTestId('admin_recipe_search_input');
    await user.type(input, 'len');
    await screen.findByTestId('admin_recipe_search_results');

    await user.clear(input);

    await waitFor(() => expect(screen.getByTestId('admin_recipe_search_hint')).toBeInTheDocument());
    expect(screen.queryByTestId('admin_recipe_search_results')).not.toBeInTheDocument();
  });

  test('every result carries a delete action named after its recipe', async () => {
    search.mockResolvedValue([LENTEJAS, TORTILLA]);
    renderWithProviders(<AdminRecipeSearch />);

    await typeQuery('a');
    await screen.findByTestId('admin_recipe_search_results');

    expect(screen.getByRole('button', { name: 'Eliminar "Lentejas estofadas" del catálogo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar "Tortilla de patata" del catálogo' })).toBeInTheDocument();
  });
});
