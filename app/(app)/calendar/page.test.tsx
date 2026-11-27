import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as mealPlanApi from '@/lib/api/meal-plan';
import * as userProfileApi from '@/lib/api/user-profile';
import { getDateFromIsoWeek, getIsoWeek } from '@/lib/date/iso-week';
import { makeFixtureWeekGrid } from '@/lib/fixtures/recipe';
import * as weeklyCost from '@/lib/grocery/weekly-cost';
import * as budgetSnapshot from '@/lib/menu/snapshot-budget-warning';
import { renderWithProviders, screen } from '@/tests/component-render';
import { headersState } from '@/tests/mocks/next-headers';
import '@/tests/mocks/next-navigation';

// FRESCO-1078 — /calendar: the week it reads, the empty state when there is no plan,
// and the week-1 learning card that a free user always sees until they dismiss it.
// Only the Supabase client, the cookie jar and the data reads are replaced.

void mock.module('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) } }),
}));

const { default: CalendarPage } = await import('./page');

function makePlan(edit: (plan: mealPlanApi.MenuSemanalPersistido) => void = () => {}): mealPlanApi.MenuSemanalPersistido {
  const plan = { mealPlanId: 'plan1', semanaIso: getIsoWeek(), ...makeFixtureWeekGrid(), advertencias: [], explicacionAprendizaje: null } as mealPlanApi.MenuSemanalPersistido;
  edit(plan);
  return plan;
}

let planSpy: ReturnType<typeof spyOn<typeof mealPlanApi, 'getMealPlanForWeek'>>;
let userPlanSpy: ReturnType<typeof spyOn<typeof userProfileApi, 'getUserPlan'>>;
let prefsSpy: ReturnType<typeof spyOn<typeof userProfileApi, 'getUserDietaryPreferences'>>;
let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;
let budgetSpy: ReturnType<typeof spyOn<typeof userProfileApi, 'getUserPresupuestoSemana'>>;
let costSpy: ReturnType<typeof spyOn<typeof weeklyCost, 'costeSemanalEstimado'>>;
let snapshotSpy: ReturnType<typeof spyOn<typeof budgetSnapshot, 'snapshotBudgetWarning'>>;

beforeEach(() => {
  headersState.cookies = {};
  planSpy = spyOn(mealPlanApi, 'getMealPlanForWeek').mockResolvedValue(makePlan());
  userPlanSpy = spyOn(userProfileApi, 'getUserPlan').mockResolvedValue('free');
  prefsSpy = spyOn(userProfileApi, 'getUserDietaryPreferences').mockResolvedValue(null as never);
  budgetSpy = spyOn(userProfileApi, 'getUserPresupuestoSemana').mockResolvedValue(null);
  costSpy = spyOn(weeklyCost, 'costeSemanalEstimado').mockReturnValue(97.32);
  // The real one writes through `after()`, which only exists inside a request.
  snapshotSpy = spyOn(budgetSnapshot, 'snapshotBudgetWarning').mockImplementation(() => {});
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  for (const spy of [planSpy, userPlanSpy, prefsSpy, budgetSpy, costSpy, snapshotSpy, errorSpy]) { spy.mockRestore(); }
});

async function renderPage(semana?: string) {
  renderWithProviders(await CalendarPage({ searchParams: Promise.resolve({ semana }) }));
}

describe('CalendarPage week selection', () => {
  test('without ?semana it reads the current week for the signed-in user', async () => {
    await renderPage();
    expect(planSpy).toHaveBeenCalledWith(expect.anything(), { semanaIso: getIsoWeek(), userId: 'user-1' });
  });

  test('a valid ?semana is the week that is read', async () => {
    await renderPage('2026-W20');
    expect(planSpy.mock.calls[0]?.[1]).toMatchObject({ semanaIso: '2026-W20' });
  });

  test('a malformed or non-existent ?semana falls back to the current week', async () => {
    await renderPage('2026-W99');
    expect(planSpy.mock.calls[0]?.[1]).toMatchObject({ semanaIso: getIsoWeek() });
    await renderPage('basura');
    expect(planSpy.mock.calls[1]?.[1]).toMatchObject({ semanaIso: getIsoWeek() });
  });
});

describe('CalendarPage without a plan', () => {
  test('shows the empty state with the generate button, week navigation and the history link', async () => {
    planSpy.mockResolvedValue(null);
    await renderPage();
    expect(screen.getByTestId('calendar_empty_state')).toBeInTheDocument();
    expect(screen.getByTestId('generate_week_button')).toBeInTheDocument();
    expect(screen.getByTestId('week_navigation')).toBeInTheDocument();
    expect(screen.getByTestId('calendar_historial_link')).toHaveAttribute('href', '/historial');
    expect(screen.queryByTestId('delete_week_button')).toBeNull();
  });

  test('a failing plan read shows the same empty state and logs it', async () => {
    planSpy.mockRejectedValue(new Error('db down'));
    await renderPage();
    expect(screen.getByTestId('calendar_empty_state')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('CalendarPage with a plan', () => {
  test('shows the title, week navigation, the delete control and the history link', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Calendario semanal');
    expect(screen.getByTestId('week_navigation')).toBeInTheDocument();
    expect(screen.getByTestId('delete_week_button')).toBeInTheDocument();
    expect(screen.getByTestId('calendar_historial_link')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar_empty_state')).toBeNull();
  });

  test('a free user sees the learning notice', async () => {
    await renderPage();
    expect(screen.getByTestId('learning_free_tier_notice')).toBeInTheDocument();
    expect(screen.queryByTestId('learning_bridge_reopen')).toBeNull();
  });

  test('once the notice is dismissed (cookie) it gives way to the reopen link', async () => {
    headersState.cookies = { learning_bridge_dismissed: '1' };
    await renderPage();
    expect(screen.queryByTestId('learning_free_tier_notice')).toBeNull();
    expect(screen.getByTestId('learning_bridge_reopen')).toBeInTheDocument();
  });

  test('a Pro user who has already marked dishes gets neither the card nor the reopen link', async () => {
    userPlanSpy.mockResolvedValue('pro');
    planSpy.mockResolvedValue(makePlan((plan) => { plan.estados.lunes.comida = 'cocinada'; }));
    headersState.cookies = { learning_bridge_dismissed: '1' };
    await renderPage();
    expect(screen.queryByTestId('learning_bridge_card')).toBeNull();
    expect(screen.queryByTestId('learning_bridge_reopen')).toBeNull();
  });

  test('warnings of the plan show in the banner', async () => {
    planSpy.mockResolvedValue(makePlan((plan) => { plan.advertencias = ['Sin receta segura para la cena del lunes']; }));
    await renderPage();
    expect(screen.getByTestId('calendar_advertencias_banner')).toHaveTextContent('Sin receta segura');
  });

  test('failing plan-tier and preferences reads fall back to free and the full grid', async () => {
    userPlanSpy.mockRejectedValue(new Error('x'));
    prefsSpy.mockRejectedValue(new Error('y'));
    await renderPage();
    expect(screen.getByTestId('learning_free_tier_notice')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  test('a planning selection narrows the dishes counted for the delete confirmation', async () => {
    prefsSpy.mockResolvedValue({ planning_selection: { lunes: ['comida'] } } as unknown as Awaited<ReturnType<typeof userProfileApi.getUserDietaryPreferences>>);
    await renderPage();
    expect(screen.getByTestId('delete_week_button')).toBeInTheDocument();
  });
});

// FRESCO-1320/QAFRESCO-36: the budget warning was only computed by `/menu`, for the current week, so next
// week's menu never warned and the calendar kept showing whatever amount was stored.
describe('CalendarPage budget warning', () => {
  const weekFrom = (days: number) => getIsoWeek(new Date(getDateFromIsoWeek(getIsoWeek()).getTime() + days * 86_400_000));
  const nextWeek = weekFrom(7);
  const lastWeek = weekFrom(-7);
  const warning = (amount: string) => `El menú supera tu presupuesto semanal en aproximadamente ${amount}€`;
  const stored = (advertencias: string[]) => planSpy.mockResolvedValue(makePlan((plan) => { plan.advertencias = advertencias; }));
  // Text, not the node: a failed matcher on a DOM node dumps the whole window and hangs the run.
  const banner = () => screen.queryByTestId('calendar_advertencias_banner')?.textContent ?? '';

  test.each([['the current week', undefined], ['next week', nextWeek]])('warns when the menu of %s is over the budget', async (_name, semana) => {
    budgetSpy.mockResolvedValue(90);

    await renderPage(semana);

    expect(banner()).toContain(warning('7.32'));
    expect(snapshotSpy.mock.calls[0]?.[1]).toMatchObject({ mealPlanId: 'plan1', userId: 'user-1', shown: [warning('7.32')] });
  });

  test('estimates with the household and the shopper profile, as the spend tile does', async () => {
    prefsSpy.mockResolvedValue({ num_personas: 10 } as unknown as Awaited<ReturnType<typeof userProfileApi.getUserDietaryPreferences>>);

    await renderPage(nextWeek);

    expect(costSpy.mock.calls[0]?.[1]).toMatchObject({ numPersonas: 10 });
  });

  test('replaces a stored amount that no longer holds, and keeps the other warnings', async () => {
    budgetSpy.mockResolvedValue(90);
    stored(['Sin receta segura para la cena del lunes', warning('50.00')]);

    await renderPage(nextWeek);

    expect(banner()).toContain(warning('7.32'));
    expect(banner()).not.toContain('50.00');
    expect(banner()).toContain('Sin receta segura');
  });

  test('drops the stored warning once the menu fits the budget', async () => {
    budgetSpy.mockResolvedValue(120);
    stored([warning('50.00')]);

    await renderPage();

    expect(banner()).toBe('');
  });

  test('leaves a past week as it was stored', async () => {
    budgetSpy.mockResolvedValue(90);
    stored([warning('50.00')]);

    await renderPage(lastWeek);

    expect(banner()).toContain(warning('50.00'));
    expect(snapshotSpy).not.toHaveBeenCalled();
  });
});
