import type { PastMealPlanWeek } from '@/lib/api/meal-plan';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { redirect } from 'next/navigation';
import * as mealPlanApi from '@/lib/api/meal-plan';
import { addIsoWeeks, getIsoWeek } from '@/lib/date/iso-week';
import { makeFixtureWeekGrid } from '@/lib/fixtures/recipe';
import { renderWithProviders, screen } from '@/tests/component-render';
import '@/tests/mocks/next-navigation';

// FRESCO-1078 — /historial: the list of past weeks, and one past week read-only.
// A missing, malformed, current or future week never renders a broken detail page:
// it sends the user back to the list. Only the client, the redirect and the reads are replaced.

void mock.module('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) } }),
}));

const { default: HistorialPage } = await import('./page');

const PAST_WEEK = addIsoWeeks(getIsoWeek(), -3);
const redirectMock = redirect as unknown as ReturnType<typeof mock>;

const week = (n: number): PastMealPlanWeek => ({ mealPlanId: `plan-${n}`, semanaIso: addIsoWeeks(getIsoWeek(), -n), mondayIso: '2026-10-05', cocinadas: n, descartadas: 0 });
const plan = () => ({ mealPlanId: 'past-plan', semanaIso: PAST_WEEK, ...makeFixtureWeekGrid(), advertencias: [], explicacionAprendizaje: null }) as mealPlanApi.MenuSemanalPersistido;

let getPlanSpy: ReturnType<typeof spyOn<typeof mealPlanApi, 'getMealPlanForWeek'>>;
let listSpy: ReturnType<typeof spyOn<typeof mealPlanApi, 'listPastMealPlanWeeks'>>;
let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;

beforeEach(() => {
  redirectMock.mockClear();
  redirectMock.mockImplementation((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); });
  getPlanSpy = spyOn(mealPlanApi, 'getMealPlanForWeek').mockResolvedValue(plan());
  listSpy = spyOn(mealPlanApi, 'listPastMealPlanWeeks').mockResolvedValue([]);
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  redirectMock.mockImplementation(() => {});
  for (const spy of [getPlanSpy, listSpy, errorSpy]) { spy.mockRestore(); }
});

const page = async (semana?: string) => HistorialPage({ searchParams: Promise.resolve({ semana }) });
const renderPage = async (semana?: string) => { renderWithProviders(await page(semana)); };

describe('HistorialPage list view', () => {
  test('with no past weeks it shows the empty state with a way to generate', async () => {
    await renderPage();
    expect(screen.getByTestId('historial_empty_state')).toHaveTextContent('Todavía no tienes menús anteriores');
    expect(screen.getByTestId('generate_week_button')).toBeInTheDocument();
  });

  test('lists every past week for the user, newest as given', async () => {
    listSpy.mockResolvedValue([week(1), week(2)]);
    await renderPage();
    expect(screen.getAllByTestId('historial_week_row')).toHaveLength(2);
    expect(screen.queryByTestId('historial_empty_state')).toBeNull();
    expect(listSpy).toHaveBeenCalledWith(expect.anything(), 'user-1');
  });

  test('a failing list read shows the empty state and logs it', async () => {
    listSpy.mockRejectedValue(new Error('db down'));
    await renderPage();
    expect(screen.getByTestId('historial_empty_state')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('HistorialPage detail view', () => {
  test('a past week shows read-only, with the back link and the reuse button', async () => {
    await renderPage(PAST_WEEK);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Semana del');
    expect(screen.getByText('Solo lectura')).toBeInTheDocument();
    expect(screen.getByTestId('historial_back_link')).toHaveAttribute('href', '/historial');
    expect(screen.getByTestId('historial_readonly_grid')).toBeInTheDocument();
    expect(screen.getByTestId('reuse_menu_button')).toBeInTheDocument();
    expect(getPlanSpy.mock.calls[0]?.[1]).toEqual({ semanaIso: PAST_WEEK, userId: 'user-1' });
  });

  test('it also reads the current week, only to know whether reusing needs a confirmation', async () => {
    await renderPage(PAST_WEEK);
    expect(getPlanSpy.mock.calls.map(c => (c[1] as { semanaIso: string }).semanaIso)).toEqual([PAST_WEEK, getIsoWeek()]);
  });

  test('a malformed week goes back to the list', async () => {
    await expect(page('basura')).rejects.toThrow('NEXT_REDIRECT:/historial');
    expect(getPlanSpy).not.toHaveBeenCalled();
  });

  test('the current week goes back to the list: history holds only earlier weeks', async () => {
    await expect(page(getIsoWeek())).rejects.toThrow('NEXT_REDIRECT:/historial');
  });

  test('a future week goes back to the list', async () => {
    await expect(page(addIsoWeeks(getIsoWeek(), 2))).rejects.toThrow('NEXT_REDIRECT:/historial');
  });

  test('a past week with no plan goes back to the list', async () => {
    getPlanSpy.mockResolvedValue(null);
    await expect(page(PAST_WEEK)).rejects.toThrow('NEXT_REDIRECT:/historial');
  });

  test('a failing read of the week behaves like a missing plan and logs', async () => {
    getPlanSpy.mockRejectedValue(new Error('db down'));
    await expect(page(PAST_WEEK)).rejects.toThrow('NEXT_REDIRECT:/historial');
    expect(errorSpy).toHaveBeenCalled();
  });

  test('when only the current-week read fails the detail still renders', async () => {
    getPlanSpy.mockResolvedValueOnce(plan()).mockRejectedValueOnce(new Error('x'));
    await renderPage(PAST_WEEK);
    expect(screen.getByTestId('historial_readonly_grid')).toBeInTheDocument();
  });
});
