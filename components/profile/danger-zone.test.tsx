import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import '@/tests/mocks/next-navigation';

/**
 * FRESCO-862 — `/profile` must not show two "Cerrar sesión" on desktop. From
 * `md` up the sidebar account menu already has it; below `md` there is no
 * sidebar (and the bottom tab bar has no logout), so the profile row is the only
 * way out and must stay. Tailwind classes encode that rule, so the first block
 * pins them (design plan §5-Y).
 *
 * FRESCO-882 — for a guest session, signing out discards the generated menu, so
 * the profile row asks first through the same `GuestLogoutDialog` as the sidebar.
 * A registered account signs out directly. `@/lib/supabase/client` is mocked
 * directly (not the `@api` barrel the "no mock.module on @api" gotcha refers to).
 */

const signOutMock = mock(async () => ({ error: null }));

void mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: signOutMock } }),
}));

const { AccountActions } = await import('./danger-zone');

describe('AccountActions logout row layout', () => {
  test('is hidden from md up so the sidebar account menu is the only logout on desktop', () => {
    renderWithProviders(<AccountActions isAnonymous={false} />);

    const row = screen.getByTestId('logout_button').closest('div.flex');
    expect(row?.className).toContain('md:hidden');
  });

  test('is not hidden below md, where it is the only way out', () => {
    renderWithProviders(<AccountActions isAnonymous={false} />);

    const row = screen.getByTestId('logout_button').closest('div.flex');
    expect(row?.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });

  test('keeps the CSV backup visible at every width', () => {
    renderWithProviders(<AccountActions isAnonymous={false} />);

    const row = screen.getByTestId('export_data_link').closest('div.flex');
    expect(row?.className).not.toContain('hidden');
  });
});

describe('AccountActions logout confirmation', () => {
  beforeEach(() => {
    signOutMock.mockClear();
  });

  test('a registered account signs out directly, without the guest warning', async () => {
    const user = setupUser();
    renderWithProviders(<AccountActions isAnonymous={false} />);

    await user.click(screen.getByTestId('logout_button'));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('guest_logout_dialog')).toBeNull();
  });

  test('a guest sees the data-loss warning first and nothing is signed out yet', async () => {
    const user = setupUser();
    renderWithProviders(<AccountActions isAnonymous />);

    await user.click(screen.getByTestId('logout_button'));

    expect(await screen.findByTestId('guest_logout_dialog')).toBeInTheDocument();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  test('a guest who confirms the warning is then signed out', async () => {
    const user = setupUser();
    renderWithProviders(<AccountActions isAnonymous />);

    await user.click(screen.getByTestId('logout_button'));
    await user.click(await screen.findByTestId('guest_logout_confirm_button'));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
  });
});
