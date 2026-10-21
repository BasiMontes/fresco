import type { RecetaPropia, Recipe } from '@schemas';
import type { RecipeDetail } from '@/lib/api/recipes';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { RecipeDetailView, RecipeNotFoundState } from '@/components/recipes/recipe-detail';
import * as favorites from '@/lib/client-api/favorites';
import * as substitutions from '@/lib/client-api/substitutions';
import { renderWithProviders, screen, setupUser, waitFor, within } from '@/tests/component-render';

const router = { bfcacheId: 'test', push: () => {}, replace: () => {}, back: () => {}, forward: () => {}, refresh: () => {}, prefetch: () => {} };

function catalogRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'rec-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    nombre: 'Tortilla de patatas',
    slug: 'tortilla-de-patatas',
    descripcion_corta: 'La clásica de siempre.',
    foto_url: null,
    meta: { tiempo_prep_min: 10, tiempo_coccion_min: 20, tiempo_total_min: 30, raciones: 2, coste_estimado: 'bajo', dificultad: 'facil' },
    clasificacion: { tipo_plato: 'comida', categoria: 'huevos', cocina: 'española', es_contundente: false, es_ligero: false, es_comfort_food: true, apto_tupper: true, apto_congelar: false },
    dieta: { vegetariano: true, vegano: false, sin_gluten: false, sin_lactosa: false, sin_huevo: false, bajo_fodmap: false, keto: false, paleo: false, halal: false, kosher: false },
    alergenos: ['huevo'],
    ingredientes_principales: ['huevos', 'patatas'],
    ingredientes_cantidades: [{ nombre: 'huevos', cantidad: 4, unidad: 'unidades' }],
    ingredientes_que_puede_desagradar: null,
    temporada: null,
    pasos_resumen: ['Fríe las patatas', 'Cuaja la tortilla'],
    veces_cocinada: 0,
    veces_descartada: 0,
    rating_promedio: null,
    ultima_vez_en_menu: null,
    ...overrides,
  };
}

function propia(overrides: Partial<RecetaPropia> = {}): RecetaPropia {
  return {
    id: 'own-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    user_id: 'user-1',
    nombre: 'Mi crema',
    ingredientes: ['calabaza', 'cebolla'],
    pasos: ['Cuece todo', 'Tritura'],
    ...overrides,
  };
}

function renderDetail(detail: RecipeDetail, props: { initialIsFavorite?: boolean, from?: string, slotId?: string } = {}) {
  return renderWithProviders(
    <AppRouterContext.Provider value={router}>
      <RecipeDetailView detail={detail} initialIsFavorite={props.initialIsFavorite ?? false} from={props.from} slotId={props.slotId} />
    </AppRouterContext.Provider>,
  );
}

let addFavorite: ReturnType<typeof spyOn>;
let removeFavorite: ReturnType<typeof spyOn>;
let consoleError: ReturnType<typeof spyOn>;

beforeEach(() => {
  addFavorite = spyOn(favorites, 'addFavorite').mockResolvedValue(undefined);
  removeFavorite = spyOn(favorites, 'removeFavorite').mockResolvedValue(undefined);
  consoleError = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  addFavorite.mockRestore();
  removeFavorite.mockRestore();
  consoleError.mockRestore();
});

describe('RecipeDetailView — catalog recipe', () => {
  test('shows the name, category, description, time, difficulty and cost', () => {
    renderDetail({ kind: 'catalogo', receta: catalogRecipe() });

    expect(screen.getByRole('heading', { level: 1, name: 'Tortilla de patatas' })).toBeInTheDocument();
    expect(screen.getByText('huevos', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('La clásica de siempre.')).toBeInTheDocument();
    expect(screen.getByText(/30\s+min ·\s+fácil\s+·\s+bajo/)).toBeInTheDocument();
  });

  test('lists the ingredients with their quantity and the preparation steps in order', () => {
    renderDetail({ kind: 'catalogo', receta: catalogRecipe() });

    expect(screen.getByRole('heading', { name: 'Ingredientes' })).toBeInTheDocument();
    expect(screen.getByTestId('recipe_detail_ingrediente_cantidad')).toHaveTextContent('4');
    expect(screen.getByText('patatas')).toBeInTheDocument();
    const pasos = within(screen.getByTestId('recipe_detail_pasos')).getAllByRole('listitem');
    expect(pasos.map(item => item.textContent)).toEqual(['Fríe las patatas', 'Cuaja la tortilla']);
  });

  test('shows the cuisine, the diet and each allergen as tags', () => {
    renderDetail({ kind: 'catalogo', receta: catalogRecipe() });

    const tags = within(screen.getByTestId('recipe_detail_tags'));
    expect(tags.getByText('Española')).toBeInTheDocument();
    expect(tags.getByText('Vegetariano')).toBeInTheDocument();
    expect(tags.getByText('Huevo')).toBeInTheDocument();
  });

  test('caps informational tags at three and expands the rest from the "+N" button', async () => {
    const dieta = { vegetariano: true, vegano: true, sin_gluten: true, sin_lactosa: false, sin_huevo: false, bajo_fodmap: false, keto: false, paleo: false, halal: false, kosher: false };
    const user = setupUser();
    renderDetail({ kind: 'catalogo', receta: catalogRecipe({ dieta }) });
    const tags = within(screen.getByTestId('recipe_detail_tags'));

    expect(tags.queryByText('Sin gluten')).toBeNull();
    await user.click(screen.getByTestId('recipe_detail_tags_toggle'));

    expect(tags.getByText('Sin gluten')).toBeInTheDocument();
  });

  test('falls back to dashes when the recipe has no metadata, category, tags or steps', () => {
    renderDetail({
      kind: 'catalogo',
      receta: catalogRecipe({ meta: null, clasificacion: null, dieta: null, alergenos: null, descripcion_corta: null, ingredientes_principales: null, ingredientes_cantidades: null, pasos_resumen: null }),
    });

    expect(screen.getByText(/—\s+min ·\s+—\s+·\s+—/)).toBeInTheDocument();
    expect(screen.queryByText('La clásica de siempre.')).toBeNull();
    expect(within(screen.getByTestId('recipe_detail_pasos')).queryAllByRole('listitem')).toHaveLength(0);
  });

  test('renders the photo when the recipe has one', () => {
    renderDetail({ kind: 'catalogo', receta: catalogRecipe({ foto_url: 'https://images.example.com/tortilla.jpg' }) });

    expect(screen.getByAltText('Tortilla de patatas')).toBeInTheDocument();
  });

  test('links back to the library by default and to the menu when opened from it', () => {
    const view = renderDetail({ kind: 'catalogo', receta: catalogRecipe() });
    expect(screen.getByTestId('recipe_detail_back_link')).toHaveAttribute('href', '/recipes');
    expect(screen.getByTestId('recipe_detail_back_link')).toHaveTextContent('Volver a la Biblioteca');

    view.unmount();
    renderDetail({ kind: 'catalogo', receta: catalogRecipe() }, { from: 'menu' });
    expect(screen.getByTestId('recipe_detail_back_link')).toHaveAttribute('href', '/menu');
    expect(screen.getByTestId('recipe_detail_back_link')).toHaveTextContent('Volver al menú');
  });

  test('the favorite button adds the recipe to favorites', async () => {
    const user = setupUser();
    renderDetail({ kind: 'catalogo', receta: catalogRecipe() });

    await user.click(screen.getByRole('button', { name: 'Guardar en favoritos' }));

    await waitFor(() => expect(addFavorite).toHaveBeenCalledWith({ recipeId: 'rec-1' }));
    expect(screen.getByRole('button', { name: 'Quitar de favoritos' })).toBeInTheDocument();
  });

  test('the favorite button removes an existing favorite', async () => {
    const user = setupUser();
    renderDetail({ kind: 'catalogo', receta: catalogRecipe() }, { initialIsFavorite: true });

    await user.click(screen.getByRole('button', { name: 'Quitar de favoritos' }));

    await waitFor(() => expect(removeFavorite).toHaveBeenCalledWith({ recipeId: 'rec-1' }));
    expect(screen.getByRole('button', { name: 'Guardar en favoritos' })).toBeInTheDocument();
  });

  test('reverts the favorite button when saving fails', async () => {
    addFavorite.mockRejectedValue(new Error('offline'));
    const user = setupUser();
    renderDetail({ kind: 'catalogo', receta: catalogRecipe() });

    await user.click(screen.getByRole('button', { name: 'Guardar en favoritos' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar en favoritos' })).toBeInTheDocument());
    expect(consoleError).toHaveBeenCalled();
  });

  test('offers "Sustituir" per ingredient only when opened from a planned meal', async () => {
    const getSafeSubstitutes = spyOn(substitutions, 'getSafeSubstitutes').mockResolvedValue([]);
    const user = setupUser();
    const view = renderDetail({ kind: 'catalogo', receta: catalogRecipe() });
    expect(screen.queryByRole('button', { name: 'Sustituir' })).toBeNull();

    view.unmount();
    renderDetail({ kind: 'catalogo', receta: catalogRecipe() }, { slotId: 'slot-1' });
    await user.click(screen.getByTestId('ingredient_substitute_trigger_patatas'));

    await waitFor(() => expect(getSafeSubstitutes).toHaveBeenCalledWith('patatas'));
    expect(await screen.findByTestId('ingredient_substitute_none')).toBeInTheDocument();
    getSafeSubstitutes.mockRestore();
  });
});

describe('RecipeDetailView — personal recipe', () => {
  test('shows the name, the "Tu receta" tag, the ingredients and the steps', () => {
    renderDetail({ kind: 'propia', receta: propia() });

    expect(screen.getByRole('heading', { level: 1, name: 'Mi crema' })).toBeInTheDocument();
    expect(screen.getByText('Tu receta')).toBeInTheDocument();
    expect(within(screen.getByTestId('recipe_detail_ingredientes')).getAllByRole('listitem').map(item => item.textContent)).toEqual(['calabaza', 'cebolla']);
    expect(within(screen.getByTestId('recipe_detail_pasos')).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Cuece todo', 'Tritura']);
  });

  test('offers edit and delete actions and no favorite button', () => {
    renderDetail({ kind: 'propia', receta: propia() });

    expect(screen.getByTestId('edit_recipe_button')).toBeInTheDocument();
    expect(screen.queryByTestId('recipe_detail_favorite_button')).toBeNull();
  });

  test('says so when there are no ingredients or steps', () => {
    renderDetail({ kind: 'propia', receta: propia({ ingredientes: [], pasos: [] }) });

    expect(screen.getByTestId('recipe_detail_ingredientes_vacio')).toHaveTextContent('Sin ingredientes añadidos.');
    expect(screen.getByTestId('recipe_detail_pasos_vacio')).toHaveTextContent('Sin pasos añadidos.');
  });

  test('links back to the menu when opened from it', () => {
    renderDetail({ kind: 'propia', receta: propia() }, { from: 'menu' });

    expect(screen.getByTestId('recipe_detail_back_link')).toHaveAttribute('href', '/menu');
  });
});

describe('RecipeNotFoundState', () => {
  test('explains the recipe is unavailable and links back to the library', () => {
    renderWithProviders(<RecipeNotFoundState />);

    expect(screen.getByTestId('recipe_detail_not_found')).toHaveTextContent('No encontramos esta receta');
    expect(screen.getByTestId('recipe_detail_back_link')).toHaveAttribute('href', '/recipes');
  });

  test('links back to the menu when the user came from it', () => {
    renderWithProviders(<RecipeNotFoundState from="menu" />);

    expect(screen.getByTestId('recipe_detail_back_link')).toHaveAttribute('href', '/menu');
  });
});
