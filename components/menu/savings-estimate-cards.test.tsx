import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { SavingsEstimateCards } from './savings-estimate-cards';

/**
 * FRESCO-792 — the three fixed placeholder tiles are gone. The one remaining
 * tile shows the computed weekly cost; with no cost there is nothing to show.
 */
describe('SavingsEstimateCards', () => {
  test('with costeEstimado, renders only the formatted weekly cost tile', () => {
    renderWithProviders(<SavingsEstimateCards costeEstimado={32.5} />);

    expect(screen.getByText('32,50€')).toBeInTheDocument();
    expect(screen.getByText('Gasto semanal estimado')).toBeInTheDocument();
    expect(screen.getAllByTestId('savings_estimate_cards')).toHaveLength(1);
  });

  test('costeEstimado of 0 still renders the real value', () => {
    renderWithProviders(<SavingsEstimateCards costeEstimado={0} />);

    expect(screen.getByText('0,00€')).toBeInTheDocument();
  });

  test('without costeEstimado, renders nothing — no invented figures', () => {
    renderWithProviders(<SavingsEstimateCards />);

    expect(screen.queryByTestId('savings_estimate_cards')).not.toBeInTheDocument();
    expect(screen.queryByText(/~\d/)).not.toBeInTheDocument();
  });

  test('FRESCO-841: shows the comparison line under the tile, and nothing when absent', () => {
    const { rerender } = renderWithProviders(<SavingsEstimateCards costeEstimado={40.8} comparison="+2 % frente a tu media de 4 semanas" />);

    expect(screen.getByTestId('savings_estimate_cards_note')).toHaveTextContent('+2 % frente a tu media de 4 semanas');

    rerender(<SavingsEstimateCards costeEstimado={40.8} comparison={null} />);

    expect(screen.queryByTestId('savings_estimate_cards_note')).not.toBeInTheDocument();
  });
});
