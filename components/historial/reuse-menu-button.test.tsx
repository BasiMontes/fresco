import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { ReuseMenuButton } from './reuse-menu-button';
import '@/tests/mocks/next-navigation';

/**
 * FRESCO-427 — the "Usar este menú en la semana actual" affordance. These
 * tests pin the confirm-gate behaviour (opens only when the current week
 * already has a menu; the direct path skips the dialog). The actual copy +
 * redirect is left to e2e and to `copyMealPlanToCurrentWeek`'s own unit
 * test — pinning it here would need a `@/lib/api/*` mock (bun re-transpile
 * cliff), same call as `delete-week-button.test.tsx`.
 */

describe('ReuseMenuButton', () => {
  test('renders the CTA', () => {
    renderWithProviders(<ReuseMenuButton sourceMealPlanId="mp1" currentWeekHasMenu={false} />);
    expect(screen.getByTestId('reuse_menu_button')).toHaveTextContent('Usar este menú en la semana actual');
  });

  test('when the current week already has a menu, the click opens a replace confirmation', async () => {
    const user = setupUser();
    renderWithProviders(<ReuseMenuButton sourceMealPlanId="mp1" currentWeekHasMenu />);

    expect(screen.queryByTestId('reuse_menu_confirm_button')).toBeNull();
    await user.click(screen.getByTestId('reuse_menu_button'));

    const dialog = screen.getByTestId('reuse_menu_confirm_dialog');
    expect(dialog).toHaveTextContent('Esto reemplazará el menú de esta semana');
    expect(dialog).toHaveTextContent('Las 21 comidas de la semana actual se sustituirán');
  });

  test('Cancel starts the dialog closing without copying', async () => {
    const user = setupUser();
    renderWithProviders(<ReuseMenuButton sourceMealPlanId="mp1" currentWeekHasMenu />);

    await user.click(screen.getByTestId('reuse_menu_button'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByTestId('reuse_menu_confirm_dialog')).toHaveClass('is-closing');
    expect(screen.queryByTestId('reuse_menu_success')).toBeNull();
  });

  test('when the current week has no menu, the click skips the dialog', async () => {
    const user = setupUser();
    renderWithProviders(<ReuseMenuButton sourceMealPlanId="mp1" currentWeekHasMenu={false} />);

    await user.click(screen.getByTestId('reuse_menu_button'));

    expect(screen.queryByTestId('reuse_menu_confirm_dialog')).toBeNull();
  });
});
