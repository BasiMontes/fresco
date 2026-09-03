import { afterEach, describe, expect, test } from 'bun:test';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';
import { DeleteWeekButton } from './delete-week-button';

/**
 * FRESCO-419 — `DeleteWeekButton` gates an irreversible week wipe behind a
 * Cancel/Confirm dialog (FRESCO-175). These tests pin the dialog cycle.
 *
 * `Dialog` stays mounted through a 150ms CSS close transition before
 * unmounting; asserting that unmount needs a timer `waitFor` that
 * busy-spins under happy-dom, so the close is asserted via the immediate
 * `is-closing` class instead (ADR-0024 §11). The `deleteMealPlan` error
 * path is left to e2e — pinning it here would need a per-file
 * `@/lib/api/*` mock, a bun re-transpile cliff.
 */

describe('DeleteWeekButton', () => {
  afterEach(() => {
    routerMock.refresh.mockClear();
  });

  test('opens the confirmation dialog from the trash button', async () => {
    const user = setupUser();
    renderWithProviders(<DeleteWeekButton mealPlanId="mp1" />);

    expect(screen.queryByTestId('delete_week_confirm_button')).toBeNull();
    await user.click(screen.getByTestId('delete_week_button'));
    expect(screen.getByTestId('delete_week_confirm_button')).toBeInTheDocument();
  });

  test('the confirmation dialog spells out the irreversible consequence', async () => {
    const user = setupUser();
    renderWithProviders(<DeleteWeekButton mealPlanId="mp1" />);

    await user.click(screen.getByTestId('delete_week_button'));

    const dialog = screen.getByTestId('delete_week_confirm_dialog');
    expect(dialog).toHaveTextContent('Se borrarán las 21 franjas');
    expect(dialog).toHaveTextContent('no se puede deshacer');
  });

  test('Cancel starts the dialog closing without deleting', async () => {
    const user = setupUser();
    renderWithProviders(<DeleteWeekButton mealPlanId="mp1" />);

    await user.click(screen.getByTestId('delete_week_button'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByTestId('delete_week_confirm_dialog')).toHaveClass('is-closing');
    expect(screen.queryByTestId('delete_week_error_message')).toBeNull();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  test('Confirm closes the dialog', async () => {
    const user = setupUser();
    renderWithProviders(<DeleteWeekButton mealPlanId="mp1" />);

    await user.click(screen.getByTestId('delete_week_button'));
    await user.click(screen.getByTestId('delete_week_confirm_button'));

    expect(screen.getByTestId('delete_week_confirm_dialog')).toHaveClass('is-closing');
  });
});
