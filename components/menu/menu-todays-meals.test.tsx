import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';
import type { OnboardingProfilePayload } from '@/lib/api/user-profile';
import { describe, expect, test } from 'bun:test';
import { makeFixtureWeekGrid } from '@/lib/fixtures/recipe';
import { renderWithProviders, screen } from '@/tests/component-render';
import { MenuTodaysMeals } from './menu-todays-meals';

// FRESCO-1078 — today's row of /menu. A slot shows its recipe, "Excluida por ti" when
// the user excluded it, or "Sin receta" when nothing safe fit; the meals shown follow
// the planning selection. Only the data is built; the cards are real.

function makePlan(edit: (plan: MenuSemanalPersistido) => void = () => {}): MenuSemanalPersistido {
  const grid = makeFixtureWeekGrid();
  const plan = { mealPlanId: 'plan1', semanaIso: '2026-W45', ...grid, advertencias: [], explicacionAprendizaje: null } as MenuSemanalPersistido;
  edit(plan);
  return plan;
}

const render = (plan: MenuSemanalPersistido, dietaryPreferences: OnboardingProfilePayload | null = null, favoriteIds = new Set<string>()) =>
  renderWithProviders(<MenuTodaysMeals plan={plan} dietaryPreferences={dietaryPreferences} favoriteIds={favoriteIds} />);

describe('MenuTodaysMeals', () => {
  test('with no planning selection it shows the three meals in order, each a link to its recipe', () => {
    render(makePlan());
    expect(screen.getAllByText(/^(desayuno|comida|cena)$/).map(n => n.textContent)).toEqual(['desayuno', 'comida', 'cena']);
    const links = screen.getAllByRole('link').map(l => l.getAttribute('href'));
    expect(links).toEqual([
      '/recipes/fixture-lunes-desayuno?from=menu',
      '/recipes/fixture-lunes-comida?from=menu',
      '/recipes/fixture-lunes-cena?from=menu',
    ]);
  });

  test('has an accessible heading for the section', () => {
    render(makePlan());
    expect(screen.getByRole('heading', { level: 2, name: 'Menú de hoy por comida' })).toBeInTheDocument();
  });

  test('a slot the user excluded says so, instead of looking empty by mistake', () => {
    render(makePlan((plan) => {
      plan.menu.lunes.cena = null;
      plan.estados.lunes.cena = 'excluida';
    }));
    expect(screen.getByTestId('menu_slot_cena_excluida')).toHaveTextContent('Excluida por ti');
    expect(screen.queryByTestId('menu_slot_cena_sin_receta')).toBeNull();
  });

  test('a slot with no safe recipe says "Sin receta"', () => {
    render(makePlan((plan) => { plan.menu.lunes.comida = null; }));
    expect(screen.getByTestId('menu_slot_comida_sin_receta')).toHaveTextContent('Sin receta');
    expect(screen.queryByTestId('menu_slot_comida_excluida')).toBeNull();
  });

  test('a planning selection with only some meals hides the others', () => {
    const prefs = { planning_selection: { lunes: ['comida'], martes: ['cena'] } } as unknown as OnboardingProfilePayload;
    render(makePlan(), prefs);
    expect(screen.getAllByText(/^(desayuno|comida|cena)$/).map(n => n.textContent)).toEqual(['comida', 'cena']);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });
});
