import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as edgeFunctions from '@/lib/api/edge-functions';
import * as mealPlanApi from '@/lib/api/meal-plan';
import * as shoppingApi from '@/lib/api/shopping-list';
import * as userProfileApi from '@/lib/api/user-profile';
import * as authApi from '@/lib/client-api/auth';
import { getIsoWeek } from '@/lib/date/iso-week';
import { makeFixtureShoppingList, makeFixtureWeekGrid } from '@/lib/fixtures/recipe';
import { renderWithProviders, screen } from '@/tests/component-render';
import '@/tests/mocks/next-navigation';

// FRESCO-1079 — /shopping-list has four states: no menu yet, a menu with no list (generated
// automatically), a menu with its list, and a failed list read (manual generator). Only the
// Supabase client and the data reads are replaced; the view renders for real.

void mock.module('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) } }),
}));

const { default: ShoppingListPage } = await import('./page');

const plan = () => ({ mealPlanId: 'plan1', semanaIso: getIsoWeek(), ...makeFixtureWeekGrid(), advertencias: [], explicacionAprendizaje: null }) as mealPlanApi.MenuSemanalPersistido;
const list = () => ({ ...makeFixtureShoppingList(), id: 'list1', mealPlanId: 'plan1' });

let planSpy: ReturnType<typeof spyOn<typeof mealPlanApi, 'getMealPlanForWeek'>>;
let listSpy: ReturnType<typeof spyOn<typeof shoppingApi, 'getShoppingListForPlan'>>;
let nuevosSpy: ReturnType<typeof spyOn<typeof shoppingApi, 'getNombresNuevos'>>;
let prefsSpy: ReturnType<typeof spyOn<typeof userProfileApi, 'getUserDietaryPreferences'>>;
let generateSpy: ReturnType<typeof spyOn<typeof edgeFunctions, 'generateShoppingList'>>;
let suggestionsSpy: ReturnType<typeof spyOn<typeof edgeFunctions, 'getShoppingListSuggestions'>>;
let tokenSpy: ReturnType<typeof spyOn<typeof authApi, 'getAccessToken'>>;
let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;

beforeEach(() => {
  planSpy = spyOn(mealPlanApi, 'getMealPlanForWeek').mockResolvedValue(plan());
  listSpy = spyOn(shoppingApi, 'getShoppingListForPlan').mockResolvedValue(list());
  nuevosSpy = spyOn(shoppingApi, 'getNombresNuevos').mockResolvedValue(new Set<string>());
  prefsSpy = spyOn(userProfileApi, 'getUserDietaryPreferences').mockResolvedValue(null as never);
  generateSpy = spyOn(edgeFunctions, 'generateShoppingList').mockImplementation(async () => new Promise(() => {}));
  suggestionsSpy = spyOn(edgeFunctions, 'getShoppingListSuggestions').mockResolvedValue({ suggestions: [] });
  tokenSpy = spyOn(authApi, 'getAccessToken').mockResolvedValue('tok');
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  for (const spy of [planSpy, listSpy, nuevosSpy, prefsSpy, generateSpy, suggestionsSpy, tokenSpy, errorSpy]) { spy.mockRestore(); }
});

const renderPage = async () => { renderWithProviders(await ShoppingListPage()); };

describe('ShoppingListPage', () => {
  test('without a menu it explains the list comes from the menu', async () => {
    planSpy.mockResolvedValue(null);
    await renderPage();
    expect(screen.getByTestId('shopping_list_no_menu_empty_state')).toHaveTextContent('Todavía no hay lista de la compra');
    expect(listSpy).not.toHaveBeenCalled();
  });

  test('a failing menu read behaves like no menu and logs it', async () => {
    planSpy.mockRejectedValue(new Error('db down'));
    await renderPage();
    expect(screen.getByTestId('shopping_list_no_menu_empty_state')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalled();
  });

  test('a menu with no list starts generating it automatically', async () => {
    listSpy.mockResolvedValue(null);
    await renderPage();
    expect(await screen.findByText('Preparando tu lista de la compra')).toBeInTheDocument();
    expect(generateSpy).toHaveBeenCalledWith({ meal_plan_id: 'plan1' }, 'tok');
  });

  test('a menu with its list shows the list, flagging what is new compared with last week', async () => {
    nuevosSpy.mockResolvedValue(new Set(['Merluza']));
    await renderPage();
    expect(screen.getByText('Merluza')).toBeInTheDocument();
    expect(screen.getByText('Calabacín')).toBeInTheDocument();
    expect(nuevosSpy.mock.calls[0]?.[1]).toMatchObject({ semanaIsoActual: getIsoWeek(), userId: 'user-1' });
  });

  test('a failing profile read still shows the list, with the default household', async () => {
    prefsSpy.mockRejectedValue(new Error('x'));
    await renderPage();
    expect(screen.getByText('Calabacín')).toBeInTheDocument();
  });

  test('a failing list read falls back to the manual generator, not to a crash', async () => {
    listSpy.mockRejectedValue(new Error('db down'));
    await renderPage();
    expect(screen.getByTestId('generate_shopping_list_button')).toBeInTheDocument();
    expect(generateSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });
});
