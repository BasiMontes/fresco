import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { SavingsEstimateCards } from './savings-estimate-cards';

/**
 * FRESCO-340 — the "Gasto semanal estimado" tile swaps its fixed `'~45€'`
 * placeholder for a real computed value when `costeEstimado` is passed in.
 * No test existed for this component before this story.
 */
describe('SavingsEstimateCards', () => {
  test('without costeEstimado, renders the FRESCO-58 placeholder unchanged', () => {
    renderWithProviders(<SavingsEstimateCards />);

    expect(screen.getByText('~45€')).toBeInTheDocument();
    expect(screen.getByText('~15€')).toBeInTheDocument();
    expect(screen.getByText('~3h')).toBeInTheDocument();
  });

  test('with costeEstimado, renders the formatted real value for the first tile only', () => {
    renderWithProviders(<SavingsEstimateCards costeEstimado={32.5} />);

    expect(screen.getByText('32,50€')).toBeInTheDocument();
    expect(screen.queryByText('~45€')).not.toBeInTheDocument();

    // The other two tiles never change, regardless of the prop.
    expect(screen.getByText('~15€')).toBeInTheDocument();
    expect(screen.getByText('~3h')).toBeInTheDocument();
  });

  test('costeEstimado of 0 still renders the real value, not the placeholder', () => {
    renderWithProviders(<SavingsEstimateCards costeEstimado={0} />);

    expect(screen.getByText('0,00€')).toBeInTheDocument();
    expect(screen.queryByText('~45€')).not.toBeInTheDocument();
  });
});
