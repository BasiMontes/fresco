import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';

/**
 * FRESCO-514 fix-and-iterate (PR #361 review, MAJOR — no coverage existed
 * for `SidebarAccount`'s own conditional logic). `@/lib/supabase/client` is
 * mocked directly (same pattern as `delete-account-dialog.test.tsx`);
 * `useOnboardingStore` stays real (in-memory zustand, no I/O).
 */

const signOutMock = mock(async () => ({ error: null }));

void mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: signOutMock,
    },
  }),
}));

const { SidebarAccount } = await import('./sidebar-account');

const BASE_PROPS = {
  nombre: 'Laura',
  email: 'laura@fresco.app',
  plan: 'free' as const,
  isAnonymous: false,
};

describe('SidebarAccount', () => {
  beforeEach(() => {
    signOutMock.mockClear();
    routerMock.push.mockClear();
  });

  afterEach(() => {
    signOutMock.mockImplementation(async () => ({ error: null }));
  });

  async function openMenu() {
    const user = setupUser();
    await user.click(screen.getByTestId('sidebar_account_trigger'));
    return user;
  }

  describe('"Mejorar plan" CTA', () => {
    test('renders for a free, non-guest user', async () => {
      renderWithProviders(<SidebarAccount {...BASE_PROPS} plan="free" isAnonymous={false} />);
      await openMenu();

      expect(screen.getByTestId('upgrade_to_pro_button')).toBeInTheDocument();
    });

    test('does not render for a paying (pro) user', async () => {
      renderWithProviders(<SidebarAccount {...BASE_PROPS} plan="pro" isAnonymous={false} />);
      await openMenu();

      expect(screen.queryByTestId('upgrade_to_pro_button')).toBeNull();
    });

    test('does not render for a family-plan user', async () => {
      renderWithProviders(<SidebarAccount {...BASE_PROPS} plan="family" isAnonymous={false} />);
      await openMenu();

      expect(screen.queryByTestId('upgrade_to_pro_button')).toBeNull();
    });

    test('does not render for a guest, even on the free plan', async () => {
      renderWithProviders(<SidebarAccount {...BASE_PROPS} plan="free" isAnonymous />);
      await openMenu();

      expect(screen.queryByTestId('upgrade_to_pro_button')).toBeNull();
    });
  });

  describe('"Cerrar sesión"', () => {
    test('a non-guest calls the logout flow directly', async () => {
      renderWithProviders(<SidebarAccount {...BASE_PROPS} isAnonymous={false} />);
      const user = await openMenu();

      await user.click(screen.getByTestId('sidebar_logout_button'));

      await waitFor(() => {
        expect(signOutMock).toHaveBeenCalled();
        expect(routerMock.push).toHaveBeenCalledWith('/login');
      });
      expect(screen.queryByTestId('guest_logout_dialog')).toBeNull();
    });

    test('a guest is routed through the confirmation dialog instead of logging out immediately', async () => {
      renderWithProviders(<SidebarAccount {...BASE_PROPS} isAnonymous plan="free" />);
      const user = await openMenu();

      await user.click(screen.getByTestId('sidebar_logout_button'));

      expect(await screen.findByTestId('guest_logout_dialog')).toBeInTheDocument();
      expect(signOutMock).not.toHaveBeenCalled();

      await user.click(screen.getByTestId('guest_logout_confirm_button'));

      await waitFor(() => {
        expect(signOutMock).toHaveBeenCalled();
        expect(routerMock.push).toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('trigger toggle', () => {
    test('opens the popover on click and closes it on a second click', async () => {
      // Re-verifies the FRESCO-514 fix-and-iterate BLOCKER fix (`popover.tsx`
      // `triggerRef` exclusion) at the real call site, not just the
      // `Popover` primitive's own harness.
      renderWithProviders(<SidebarAccount {...BASE_PROPS} />);
      const user = setupUser();
      const trigger = screen.getByTestId('sidebar_account_trigger');

      expect(screen.queryByTestId('sidebar_account_popover')).toBeNull();

      await user.click(trigger);
      expect(screen.getByTestId('sidebar_account_popover')).toBeInTheDocument();

      await user.click(trigger);
      expect(screen.queryByTestId('sidebar_account_popover')).toBeNull();
    });
  });

  // FRESCO-849 — pill trigger with name, email and plan.
  describe('identity lines', () => {
    test('the trigger shows name, email and plan label', () => {
      renderWithProviders(<SidebarAccount {...BASE_PROPS} />);

      expect(screen.getByTestId('user_name')).toHaveTextContent('Laura');
      expect(screen.getByTestId('user_email')).toHaveTextContent('laura@fresco.app');
      expect(screen.getByTestId('plan_label')).toHaveTextContent('Plan Free');
    });

    test('a pro user sees Plan Pro', () => {
      renderWithProviders(<SidebarAccount {...BASE_PROPS} plan="pro" />);

      expect(screen.getByTestId('plan_label')).toHaveTextContent('Plan Pro');
    });

    test('a guest without email gets no email line, only name and plan', () => {
      renderWithProviders(<SidebarAccount {...BASE_PROPS} email="" isAnonymous nombre="Invitado" />);

      expect(screen.queryByTestId('user_email')).toBeNull();
      expect(screen.getByTestId('user_name')).toHaveTextContent('Invitado');
      expect(screen.getByTestId('plan_label')).toBeInTheDocument();
    });

    test('collapsed rail renders only the avatar, with no text lines', () => {
      renderWithProviders(<SidebarAccount {...BASE_PROPS} collapsed />);

      expect(screen.getByTestId('user_avatar')).toBeInTheDocument();
      expect(screen.queryByTestId('user_name')).toBeNull();
      expect(screen.queryByTestId('user_email')).toBeNull();
      expect(screen.queryByTestId('plan_label')).toBeNull();
    });

    test('email and plan share the caption size and the name keeps the label size, on the trigger and in the menu', async () => {
      renderWithProviders(<SidebarAccount {...BASE_PROPS} />);
      await setupUser().click(screen.getByTestId('sidebar_account_trigger'));

      // Guards the tailwind-merge trap: `cn()` drops `text-caption` / `text-label`
      // next to a text colour, which rendered these lines at the 16px default.
      for (const id of ['user_email', 'plan_label', 'popover_user_email']) {
        expect(screen.getByTestId(id)).toHaveClass('text-caption');
      }
      expect(screen.getByTestId('user_name')).toHaveClass('text-label');
    });

    test('the menu entries use the same label size as the name, not the larger body size', async () => {
      renderWithProviders(<SidebarAccount {...BASE_PROPS} />);
      await setupUser().click(screen.getByTestId('sidebar_account_trigger'));

      for (const id of ['popover_item_perfil', 'popover_item_configuracion', 'popover_item_ayuda']) {
        expect(screen.getByTestId(id)).toHaveClass('text-label');
      }
    });

    test('the open menu repeats the email in its header', async () => {
      renderWithProviders(<SidebarAccount {...BASE_PROPS} />);
      await setupUser().click(screen.getByTestId('sidebar_account_trigger'));

      expect(screen.getByTestId('popover_user_email')).toHaveTextContent('laura@fresco.app');
    });
  });
});
