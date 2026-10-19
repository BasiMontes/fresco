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

    for (const meal of ['Desayuno', 'Comida', 'Cena']) {
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

    await user.click(screen.getByLabelText('Comida martes'));

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

  test('lays the days out 4 per row and 7 once the card is wide enough (FRESCO-985)', () => {
    render();

    const grid = screen.getByLabelText('Cena domingo').closest('label')?.parentElement;
    expect(grid?.className).toContain('grid-cols-4');
    expect(grid?.className).toContain('@min-[336px]:grid-cols-7');
  });

  test('"Todos" on a meal row selects that meal for all seven days', async () => {
    const user = setupUser();
    const onChange = mock(() => {});
    render({ onChange });

    await user.click(screen.getByRole('button', { name: 'Todos: marcar comida todos los días' }));

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

    await user.click(screen.getByRole('button', { name: 'Ninguno: desmarcar comida todos los días' }));

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

    expect(screen.getByLabelText('Comida lunes')).toBeChecked();
    expect(screen.getByLabelText('Cena viernes')).toBeChecked();
    expect(screen.getByLabelText('Desayuno lunes')).not.toBeChecked();
    expect(screen.getByLabelText('Comida martes')).not.toBeChecked();
  });
});

describe('PlanningSelectionGrid — readable text (FRESCO-967)', () => {
  test('no element uses the 11px caption size', () => {
    const { container } = render();

    expect(container.querySelector('.text-caption')).toBeNull();
    expect(container.querySelector('.text-body-sm')).not.toBeNull();
  });
});

describe('PlanningSelectionGrid — column count follows the card, not the window (FRESCO-985)', () => {
  // At 768px /profile is two columns wide and the card is ~248px: seven 44px targets do not
  // fit, so a viewport breakpoint (`sm:`) made neighbouring touch targets overlap. The seven
  // columns now depend on the width of the card the grid sits in, through a container query.
  test('switches to seven columns by container width, never by viewport width', () => {
    const { container } = render();
    const row = container.querySelector('.grid');

    expect(row?.className).toContain('@min-[336px]:grid-cols-7');
    expect(row?.className).toContain('grid-cols-4');
    expect(row?.className).not.toMatch(/(^|\s)(sm|md|lg|xl):grid-cols-7/);
    expect(row?.parentElement?.className).toContain('@container');
  });

  test('336px is what seven 44px targets and six 4px gaps need', () => {
    expect(7 * 44 + 6 * 4).toBeLessThanOrEqual(336);
  });
});
