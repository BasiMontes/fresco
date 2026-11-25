import { describe, expect, test } from 'bun:test';
import { makeFixtureRecipes } from '@/lib/fixtures/recipe';
import { renderWithProviders, screen } from '@/tests/component-render';
import { MenuNoPlanView } from './menu-no-plan-view';
import '@/tests/mocks/next-navigation';

// FRESCO-1078 — /menu without a plan this week: the empty state with its generate button leads
// (and sends the user to /calendar afterwards); the available-recipes count only shows when known.

const base = { semanaIso: '2999-W01', mondayIso: '2999-01-04', recetasDisponibles: 120, ultimasRecetas: makeFixtureRecipes(2), favoriteIds: new Set<string>() };

describe('MenuNoPlanView', () => {
  test('leads with the empty state and the generate button', () => {
    renderWithProviders(<MenuNoPlanView {...base} />);
    expect(screen.getByTestId('menu_empty_state')).toBeInTheDocument();
    expect(screen.getByTestId('generate_week_button')).toBeEnabled();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  test('shows how many recipes are available when the count is known', () => {
    renderWithProviders(<MenuNoPlanView {...base} />);
    expect(screen.getByText(/120/)).toBeInTheDocument();
  });

  test('omits the count when it could not be read', () => {
    renderWithProviders(<MenuNoPlanView {...base} recetasDisponibles={null} />);
    expect(screen.queryByText(/120/)).toBeNull();
  });

  test('lists the latest recipes below the empty state', () => {
    renderWithProviders(<MenuNoPlanView {...base} />);
    expect(screen.getAllByRole('link').some(l => l.getAttribute('href')?.startsWith('/recipes/'))).toBe(true);
  });

  // FRESCO-297: the banner says "Retoma la organización de tu semana", which implies a plan already exists.
  test('does not show the Calendar suggestion banner, because there is no plan to resume', () => {
    renderWithProviders(<MenuNoPlanView {...base} />);
    expect(screen.queryByTestId('calendar_suggestion_banner')).toBeNull();
    expect(screen.queryByText(/Retoma la organización de tu semana/)).toBeNull();
    expect(screen.queryByText('Ver mi plan semanal')).toBeNull();
  });
});
