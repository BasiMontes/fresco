import { describe, expect, test } from 'bun:test';
import { addIsoWeeks, getDateFromIsoWeek, getIsoWeekMonday } from '@/lib/date/iso-week';
import { renderWithProviders, screen } from '@/tests/component-render';
import { WeekNavigation } from './week-navigation';

// FRESCO-1078 — week navigation of /calendar: two weeks back, two forward from the
// REAL current week, and the controls at the edges are disabled, not hidden. The
// weeks are built from the current Monday, so the test does not depend on the date.

function weekAt(offset: number) {
  const current = getIsoWeekMonday();
  const currentIso = isoWeekOf(current);
  const semanaIso = addIsoWeeks(currentIso, offset);
  const mondayIso = getIsoWeekMonday(getDateFromIsoWeek(semanaIso));
  return { semanaIso, mondayIso };
}

function isoWeekOf(mondayIso: string): string {
  const date = new Date(`${mondayIso}T00:00:00.000Z`);
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 3);
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((thursday.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

describe('WeekNavigation', () => {
  test('in the current week both arrows are links to the neighbouring weeks', () => {
    const { semanaIso, mondayIso } = weekAt(0);
    renderWithProviders(<WeekNavigation semanaIso={semanaIso} mondayIso={mondayIso} />);
    expect(screen.getByTestId('week_nav_prev')).toHaveAttribute('href', `/calendar?semana=${addIsoWeeks(semanaIso, -1)}`);
    expect(screen.getByTestId('week_nav_next')).toHaveAttribute('href', `/calendar?semana=${addIsoWeeks(semanaIso, 1)}`);
    expect(screen.getByTestId('week_nav_label').textContent).not.toBe('');
  });

  test('two weeks back the previous arrow is disabled and the next one still works', () => {
    const { semanaIso, mondayIso } = weekAt(-2);
    renderWithProviders(<WeekNavigation semanaIso={semanaIso} mondayIso={mondayIso} />);
    const prev = screen.getByTestId('week_nav_prev');
    expect(prev).toHaveAttribute('aria-disabled', 'true');
    expect(prev).not.toHaveAttribute('href');
    expect(screen.getByTestId('week_nav_next')).toHaveAttribute('href');
  });

  test('two weeks ahead the next arrow is disabled and the previous one still works', () => {
    const { semanaIso, mondayIso } = weekAt(2);
    renderWithProviders(<WeekNavigation semanaIso={semanaIso} mondayIso={mondayIso} />);
    const next = screen.getByTestId('week_nav_next');
    expect(next).toHaveAttribute('aria-disabled', 'true');
    expect(next).not.toHaveAttribute('href');
    expect(screen.getByTestId('week_nav_prev')).toHaveAttribute('href');
  });

  test('one week from the edge both arrows are still links', () => {
    const { semanaIso, mondayIso } = weekAt(-1);
    renderWithProviders(<WeekNavigation semanaIso={semanaIso} mondayIso={mondayIso} />);
    expect(screen.getByTestId('week_nav_prev')).toHaveAttribute('href');
    expect(screen.getByTestId('week_nav_next')).toHaveAttribute('href');
  });
});
