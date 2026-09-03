import type { ComponentProps } from 'react';
import type { PlanningSelection } from '@/lib/planning-selection';
import { describe, expect, mock, test } from 'bun:test';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { PlanningSelectionGrid } from './planning-selection-grid';

/**
 * FRESCO-426 — axis flipped to days-as-columns, meals-as-rows. Tests pin
 * the header axis, the per-day bulk controls, cell toggling, and that an
 * existing selection survives the render unchanged.
 */

const EMPTY: PlanningSelection = {
  lunes: [],
  martes: [],
  miercoles: [],
  jueves: [],
  viernes: [],
  sabado: [],
  domingo: [],
};

function render(props: Partial<ComponentProps<typeof PlanningSelectionGrid>> = {}) {
  return renderWithProviders(
    <PlanningSelectionGrid
      value={EMPTY}
      onChange={mock(() => {})}
      data-testid="grid"
      {...props}
    />,
  );
}

describe('PlanningSelectionGrid', () => {
  test('days are the column headers and meal types the row headers', () => {
    render();

    for (const day of ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']) {
      expect(screen.getByRole('columnheader', { name: day })).toBeInTheDocument();
    }
    for (const meal of ['Desayuno', 'Almuerzo', 'Cena']) {
      expect(screen.getByRole('rowheader', { name: meal })).toBeInTheDocument();
    }
  });

  test('renders 21 cells (7 days x 3 meals)', () => {
    render();
    expect(screen.getAllByTestId('planning_selection_cell')).toHaveLength(21);
  });

  test('each cell has a "{meal} {day}" aria-label', () => {
    render();
    expect(screen.getByLabelText('Cena domingo')).toBeInTheDocument();
    expect(screen.getByLabelText('Desayuno lunes')).toBeInTheDocument();
  });

  test('toggling a cell adds that one meal to that one day', async () => {
    const user = setupUser();
    const onChange = mock(() => {});
    render({ onChange });

    await user.click(screen.getByLabelText('Almuerzo martes'));

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY, martes: ['comida'] });
  });

  test('"Todos" on a day column selects all three meals for that day only', async () => {
    const user = setupUser();
    const onChange = mock(() => {});
    render({ onChange });

    await user.click(screen.getByRole('button', { name: 'Marcar todas las comidas del miércoles' }));

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY,
      miercoles: ['desayuno', 'comida', 'cena'],
    });
  });

  test('"Ninguno" on a day column clears that day, leaving the rest intact', async () => {
    const user = setupUser();
    const onChange = mock(() => {});
    const value: PlanningSelection = {
      ...EMPTY,
      lunes: ['comida', 'cena'],
      martes: ['comida', 'cena'],
    };
    render({ value, onChange });

    await user.click(screen.getByRole('button', { name: 'Desmarcar todas las comidas del lunes' }));

    expect(onChange).toHaveBeenCalledWith({ ...value, lunes: [] });
  });

  test('an existing selection is reflected in the checked cells after the axis flip', () => {
    const value: PlanningSelection = {
      ...EMPTY,
      lunes: ['comida', 'cena'],
      viernes: ['comida', 'cena'],
    };
    render({ value });

    expect(screen.getByLabelText('Almuerzo lunes')).toBeChecked();
    expect(screen.getByLabelText('Cena viernes')).toBeChecked();
    expect(screen.getByLabelText('Desayuno lunes')).not.toBeChecked();
    expect(screen.getByLabelText('Almuerzo martes')).not.toBeChecked();
  });
});
