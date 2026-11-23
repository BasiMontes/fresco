import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { getIsoWeek } from '@/lib/date/iso-week';
import { makeFixtureRecipes, makeFixtureWeekGrid } from '@/lib/fixtures/recipe';
import * as loader from '@/lib/menu/load-menu-page-data';
import * as budgetSnapshot from '@/lib/menu/snapshot-budget-warning';
import * as snapshot from '@/lib/menu/snapshot-weekly-cost';
import { renderWithProviders, screen } from '@/tests/component-render';
import '@/tests/mocks/next-navigation';

// FRESCO-1079 — /menu: with a plan it shows today's meals and the weekly figures, without one the
// empty state leads. The page reads everything through `loadMenuPageData` (tested on its own), so
// that loader and the cost snapshot write are the only things replaced.

let user: { id: string, is_anonymous?: boolean } | null;
void mock.module('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }),
}));

const { default: MenuPage } = await import('./page');

type Data = Awaited<ReturnType<typeof loader.loadMenuPageData>>;

function makeData(overrides: Partial<Data> = {}): Data {
  return {
    nombre: 'Laura',
    recetasDisponibles: 120,
    ultimasRecetas: makeFixtureRecipes(2),
    plan: { mealPlanId: 'plan1', semanaIso: getIsoWeek(), ...makeFixtureWeekGrid(), advertencias: [], explicacionAprendizaje: null },
    favoriteIds: new Set<string>(),
    dietaryPreferences: null,
    hasUnseenNotifications: false,
    spendTrend: [],
    proPreview: [],
    presupuestoSemanaEuros: null,
    ...overrides,
  };
}

let loaderSpy: ReturnType<typeof spyOn<typeof loader, 'loadMenuPageData'>>;
let snapshotSpy: ReturnType<typeof spyOn<typeof snapshot, 'snapshotWeeklyCost'>>;
let budgetSnapshotSpy: ReturnType<typeof spyOn<typeof budgetSnapshot, 'snapshotBudgetWarning'>>;

beforeEach(() => {
  user = { id: 'user-1' };
  loaderSpy = spyOn(loader, 'loadMenuPageData').mockResolvedValue(makeData());
  snapshotSpy = spyOn(snapshot, 'snapshotWeeklyCost').mockImplementation(() => {});
  budgetSnapshotSpy = spyOn(budgetSnapshot, 'snapshotBudgetWarning').mockImplementation(() => {});
});

afterEach(() => {
  loaderSpy.mockRestore();
  snapshotSpy.mockRestore();
  budgetSnapshotSpy.mockRestore();
});

const renderPage = async () => { renderWithProviders(await MenuPage()); };

describe('MenuPage', () => {
  test('asks the loader for the current week and the signed-in user', async () => {
    await renderPage();
    expect(loaderSpy).toHaveBeenCalledWith(expect.anything(), { userId: 'user-1', semanaIso: getIsoWeek() });
  });

  test('with a plan it greets the user and shows the figures and today’s meals', async () => {
    await renderPage();
    expect(screen.getByText(/Laura/)).toBeInTheDocument();
    expect(screen.getByTestId('available_recipes_card')).toBeInTheDocument();
    expect(screen.getByTestId('savings_estimate_cards')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Menú de hoy por comida' })).toBeInTheDocument();
    expect(screen.getByTestId('favoritos_button')).toBeInTheDocument();
    expect(screen.queryByTestId('menu_empty_state')).toBeNull();
  });

  test('stores this week’s cost for the spend comparison, for the signed-in user', async () => {
    await renderPage();
    expect(snapshotSpy).toHaveBeenCalledTimes(1);
    expect(snapshotSpy.mock.calls[0]?.[1]).toMatchObject({ userId: 'user-1', semanaIso: getIsoWeek() });
  });

  // FRESCO-1269 (QAFRESCO-2): the budget warning is computed from the tile's own cost, so a menu over the budget
  // always warns and a menu within it never shows a stale warning.
  describe('the weekly budget warning', () => {
    const STALE = 'El menú supera tu presupuesto semanal en aproximadamente 3.00€';

    test('a menu costing more than the budget shows the warning, with the excess of the tile\'s own figure', async () => {
      loaderSpy.mockResolvedValue(makeData({ presupuestoSemanaEuros: 0.01 }));
      await renderPage();

      expect(screen.getByTestId('menu_advertencias_banner')).toHaveTextContent(/El menú supera tu presupuesto semanal en aproximadamente \d+\.\d{2}€/);
    });

    test('with no budget there is no warning', async () => {
      await renderPage();

      expect(screen.queryByTestId('menu_advertencias_banner')).toBeNull();
    });

    test('a menu within the budget drops a warning stored by the old estimate', async () => {
      const base = makeData();
      loaderSpy.mockResolvedValue(makeData({ presupuestoSemanaEuros: 100000, plan: base.plan && { ...base.plan, advertencias: [STALE] } }));
      await renderPage();

      expect(screen.queryByTestId('menu_advertencias_banner')).toBeNull();
    });

    test('the warning shown is written back to the plan, for the signed-in user', async () => {
      loaderSpy.mockResolvedValue(makeData({ presupuestoSemanaEuros: 0.01 }));
      await renderPage();

      expect(budgetSnapshotSpy).toHaveBeenCalledTimes(1);
      expect(budgetSnapshotSpy.mock.calls[0]?.[1]).toMatchObject({ mealPlanId: 'plan1', userId: 'user-1', stored: [] });
      expect(budgetSnapshotSpy.mock.calls[0]?.[1].shown).toHaveLength(1);
    });
  });

  test('hides the available-recipes card when the count could not be read', async () => {
    loaderSpy.mockResolvedValue(makeData({ recetasDisponibles: null }));
    await renderPage();
    expect(screen.queryByTestId('available_recipes_card')).toBeNull();
  });

  test('warnings of the plan show in the banner', async () => {
    const data = makeData();
    data.plan!.advertencias = ['Sin receta segura para la cena del lunes'];
    loaderSpy.mockResolvedValue(data);
    await renderPage();
    expect(screen.getByTestId('menu_advertencias_banner')).toHaveTextContent('Sin receta segura');
  });

  test('a guest is told to save the menu', async () => {
    user = { id: 'guest-1', is_anonymous: true };
    await renderPage();
    expect(screen.getByTestId('guest_save_menu_banner')).toBeInTheDocument();
  });

  test('without a plan the empty state leads, with the generate button for this week', async () => {
    loaderSpy.mockResolvedValue(makeData({ plan: null }));
    await renderPage();
    expect(screen.getByTestId('menu_empty_state')).toBeInTheDocument();
    expect(screen.getByTestId('generate_week_button')).toBeInTheDocument();
    expect(snapshotSpy).not.toHaveBeenCalled();
  });
});
