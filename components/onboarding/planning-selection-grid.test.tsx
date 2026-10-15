import type { ComponentProps } from 'react';
import type { PlanningSelection } from '@/lib/planning-selection';
import { describe, expect, mock, test } from 'bun:test';
import { renderWithProviders, screen, setupUser, within } from '@/tests/component-render';
import { PlanningSelectionGrid } from './planning-selection-grid';

/**
 * FRESCO-426 — axis flipped to days-as-columns, meals-as-rows. Tests pin
 * the header axis, the per-meal bulk controls, cell toggling, and that an
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
  test('one group per meal type, each with its seven day labels', () => {
    render();

    for (const meal of ['Desayuno', 'Almuerzo', 'Cena']) {
      const group = screen.getByRole('group', { name: meal });
      for (const day of ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']) {
        expect(within(group).getByText(day)).toBeInTheDocument();
      }
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

  test('the bulk "Todos" and "Ninguno" buttons keep a 44 px tap target (FRESCO-836)', () => {
    render();

    const buttons = [
      ...screen.getAllByTestId('planning_meal_select_all'),
      ...screen.getAllByTestId('planning_meal_select_none'),
    ];

    expect(buttons).toHaveLength(6);
    for (const button of buttons) {
      expect(button.className).toContain('min-h-11');
      expect(button.className).toContain('min-w-11');
    }
  });

  test('every day cell sits in a label of at least 44 px (FRESCO-864)', () => {
    render();

    const cells = screen.getAllByTestId('planning_selection_cell');
    expect(cells).toHaveLength(21);
    for (const cell of cells) {
      const label = cell.closest('label');
      expect(label).not.toBeNull();
      expect(label?.className).toContain('min-h-11');
      expect(label?.className).toContain('min-w-11');
    }
  });

  test('lays the days out 4 per row on mobile and 7 from sm up', () => {
    render();

    const grid = screen.getByLabelText('Cena domingo').closest('label')?.parentElement;
    expect(grid?.className).toContain('grid-cols-4');
    expect(grid?.className).toContain('sm:grid-cols-7');
  });

  test('"Todos" on a meal row selects that meal for all seven days', async () => {
    const user = setupUser();
    const onChange = mock(() => {});
    render({ onChange });

    await user.click(screen.getByRole('button', { name: 'Marcar almuerzo todos los días' }));

    expect(onChange).toHaveBeenCalledWith({
      lunes: ['comida'],
      martes: ['comida'],
      miercoles: ['comida'],
      jueves: ['comida'],
      viernes: ['comida'],
      sabado: ['comida'],
      domingo: ['comida'],
    });
  });

  test('"Ninguno" on a meal row clears that meal from every day, leaving other meals intact', async () => {
    const user = setupUser();
    const onChange = mock(() => {});
    const value: PlanningSelection = {
      ...EMPTY,
      lunes: ['comida', 'cena'],
      martes: ['comida', 'cena'],
    };
    render({ value, onChange });

    await user.click(screen.getByRole('button', { name: 'Desmarcar almuerzo todos los días' }));

    expect(onChange).toHaveBeenCalledWith({
      ...value,
      lunes: ['cena'],
      martes: ['cena'],
    });
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

describe('PlanningSelectionGrid — readable text (FRESCO-967)', () => {
  test('no element uses the 11px caption size', () => {
    const { container } = render();

    expect(container.querySelector('.text-caption')).toBeNull();
    expect(container.querySelector('.text-body-sm')).not.toBeNull();
  });
});
