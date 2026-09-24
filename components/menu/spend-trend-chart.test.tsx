import type { SpendTrendPoint } from '@/lib/menu/get-spend-trend';
import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { SpendTrendChart } from './spend-trend-chart';

function week(semanaIso: string, costeEstimado: number | null): SpendTrendPoint {
  return { semanaIso, costeEstimado };
}

describe('SpendTrendChart', () => {
  test('fewer than 2 real points shows the insufficient-history message, not an empty chart', () => {
    renderWithProviders(
      <SpendTrendChart trend={[week('2026-W30', null), week('2026-W31', 42)]} />,
    );

    expect(screen.getByTestId('spend_trend_chart_empty')).toBeInTheDocument();
    expect(screen.getByText(/todavía no hay suficientes semanas/i)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('zero real points also shows the insufficient-history message', () => {
    renderWithProviders(
      <SpendTrendChart trend={[week('2026-W30', null), week('2026-W31', null)]} />,
    );

    expect(screen.getByTestId('spend_trend_chart_empty')).toBeInTheDocument();
  });

  test('2+ real points renders the chart with one point per week that has data', () => {
    renderWithProviders(
      <SpendTrendChart
        trend={[week('2026-W29', 30), week('2026-W30', null), week('2026-W31', 45)]}
      />,
    );

    const chart = screen.getByTestId('spend_trend_chart');
    expect(chart).toBeInTheDocument();
    expect(chart.querySelectorAll('circle')).toHaveLength(2);
  });

  test('a gap week breaks the line into separate segments instead of interpolating across it', () => {
    renderWithProviders(
      <SpendTrendChart
        trend={[week('2026-W29', 30), week('2026-W30', null), week('2026-W31', 45)]}
      />,
    );

    // One real run before the gap, one after -- two polylines, not one
    // continuous line spanning the null week.
    expect(screen.getByTestId('spend_trend_chart').querySelectorAll('polyline')).toHaveLength(2);
  });

  test('a single unbroken run of real points renders as one polyline', () => {
    renderWithProviders(
      <SpendTrendChart trend={[week('2026-W29', 30), week('2026-W30', 35), week('2026-W31', 45)]} />,
    );

    expect(screen.getByTestId('spend_trend_chart').querySelectorAll('polyline')).toHaveLength(1);
  });
});
