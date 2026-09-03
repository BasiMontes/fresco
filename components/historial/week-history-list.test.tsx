import type { PastMealPlanWeek } from '@/lib/api/meal-plan';
import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { WeekHistoryList } from './week-history-list';

/**
 * FRESCO-425 — the "Histórico de menús" list rows. Ordering is the caller's
 * job (`listPastMealPlanWeeks`); these tests pin the per-row content, the
 * singular/plural of the balance line, and that each row links to the
 * read-only detail for its own week.
 */

const WEEKS: PastMealPlanWeek[] = [
  { mealPlanId: 'p-1', semanaIso: '2026-W34', mondayIso: '2026-08-17', cocinadas: 12, descartadas: 3 },
  { mealPlanId: 'p-2', semanaIso: '2026-W33', mondayIso: '2026-08-10', cocinadas: 1, descartadas: 1 },
];

describe('WeekHistoryList', () => {
  test('renders one linked row per week', () => {
    renderWithProviders(<WeekHistoryList weeks={WEEKS} />);

    const rows = screen.getAllByTestId('historial_week_row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('href', '/historial?semana=2026-W34');
    expect(rows[1]).toHaveAttribute('href', '/historial?semana=2026-W33');
  });

  test('shows the cocinada/descartada balance, pluralised', () => {
    renderWithProviders(<WeekHistoryList weeks={WEEKS} />);

    expect(screen.getByText('12 recetas cocinadas · 3 descartadas')).toBeInTheDocument();
    expect(screen.getByText('1 receta cocinada · 1 descartada')).toBeInTheDocument();
  });

  test('renders nothing but the list wrapper when there are no weeks', () => {
    renderWithProviders(<WeekHistoryList weeks={[]} />);

    expect(screen.getByTestId('historial_week_list')).toBeEmptyDOMElement();
  });
});
