import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { HistoryListHeader } from './history-list-header';

describe('HistoryListHeader (FRESCO-854)', () => {
  test('has a back button to the calendar', () => {
    renderWithProviders(<HistoryListHeader />);
    const back = screen.getByTestId('historial_list_back_link');
    expect(back).toHaveAttribute('href', '/calendar');
    expect(back).toHaveAccessibleName('Volver al calendario');
  });

  test('keeps the title and the explanation', () => {
    renderWithProviders(<HistoryListHeader />);
    expect(screen.getByRole('heading', { level: 1, name: 'Histórico de menús' })).toBeInTheDocument();
    expect(screen.getByText('Semanas anteriores')).toBeInTheDocument();
    expect(screen.getByText(/lo que marcaste como cocinado o descartado/)).toBeInTheDocument();
  });
});
