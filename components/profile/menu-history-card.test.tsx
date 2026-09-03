import type { PastMealPlanWeek } from '@/lib/api/meal-plan';
import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { MenuHistoryCard } from './menu-history-card';

/**
 * FRESCO-427 — the "Histórico de menús" card on `/profile`. Pins the summary
 * count, the 3-most-recent cap, the link, the empty state, and the Free-only
 * Pro-context line.
 */

const WEEKS: PastMealPlanWeek[] = [
  { mealPlanId: 'p-1', semanaIso: '2026-W34', mondayIso: '2026-08-17', cocinadas: 10, descartadas: 2 },
  { mealPlanId: 'p-2', semanaIso: '2026-W33', mondayIso: '2026-08-10', cocinadas: 8, descartadas: 4 },
  { mealPlanId: 'p-3', semanaIso: '2026-W32', mondayIso: '2026-08-03', cocinadas: 12, descartadas: 0 },
  { mealPlanId: 'p-4', semanaIso: '2026-W31', mondayIso: '2026-07-27', cocinadas: 5, descartadas: 5 },
];

describe('MenuHistoryCard', () => {
  test('summarises the count and lists at most the 3 most recent weeks, with a link', () => {
    renderWithProviders(<MenuHistoryCard weeks={WEEKS} plan="pro" />);

    expect(screen.getByText('4 semanas planificadas')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByTestId('menu_history_card_link')).toHaveAttribute('href', '/historial');
  });

  test('shows the empty state and no link when there are no weeks', () => {
    renderWithProviders(<MenuHistoryCard weeks={[]} plan="free" />);

    expect(screen.getByTestId('menu_history_card_empty')).toBeInTheDocument();
    expect(screen.queryByTestId('menu_history_card_link')).toBeNull();
    expect(screen.queryByTestId('menu_history_card_pro_hint')).toBeNull();
  });

  test('adds the Pro-context line for a Free plan with at least one week', () => {
    renderWithProviders(<MenuHistoryCard weeks={WEEKS} plan="free" />);
    expect(screen.getByTestId('menu_history_card_pro_hint')).toHaveTextContent('Con Fresco Pro');
  });

  test('does not add the Pro-context line for a Pro plan', () => {
    renderWithProviders(<MenuHistoryCard weeks={WEEKS} plan="pro" />);
    expect(screen.queryByTestId('menu_history_card_pro_hint')).toBeNull();
  });

  test('pluralises "semana" correctly for a single week', () => {
    renderWithProviders(<MenuHistoryCard weeks={[WEEKS[0]]} plan="pro" />);
    expect(screen.getByText('1 semana planificada')).toBeInTheDocument();
  });
});
