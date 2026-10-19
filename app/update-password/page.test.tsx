import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { renderWithProviders, screen, waitFor } from '@/tests/component-render';

/**
 * FRESCO-1015 (audit 7b A7-AUTHZ-04) — `/update-password` asks for the current password when the
 * session came from a password sign-in, and not when it came from the recovery link.
 */

const getSessionMock = mock(async (): Promise<{ data: { session: { access_token: string } | null } }> => ({ data: { session: { access_token: 'tok' } } }));
const getClaimsMock = mock(async (): Promise<{ data: { claims: { amr: { method: string }[] } } | null }> => ({ data: { claims: { amr: [{ method: 'password' }] } } }));
const updateUserMock = mock(async (_attributes: unknown): Promise<{ error: { code?: string, message: string } | null }> => ({ error: null }));
const signOutMock = mock(async () => ({ error: null }));

// Same seam as the other component tests: the Supabase browser client, not the client-api module.
void mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: getSessionMock, getClaims: getClaimsMock, updateUser: updateUserMock, signOut: signOutMock },
  }),
}));

const { default: UpdatePasswordPage } = await import('./page');

const pushMock = mock((_href: string) => {});
const router = { bfcacheId: 'test', push: pushMock, replace: pushMock, back: () => {}, forward: () => {}, refresh: () => {}, prefetch: () => {} };

function renderPage() {
  return renderWithProviders(
    <AppRouterContext.Provider value={router}>
      <UpdatePasswordPage />
    </AppRouterContext.Provider>,
  );
}

const NEW_PASSWORD = 'una-contraseña-larga-1';

const realFetch = globalThis.fetch;

beforeEach(() => {
  getSessionMock.mockClear();
  getClaimsMock.mockClear();
  updateUserMock.mockClear();
  signOutMock.mockClear();
  // The breached-password check fails open when the range API is unreachable.
  globalThis.fetch = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const asMethods = (...methods: string[]) => ({ data: { claims: { amr: methods.map(method => ({ method })) } } });

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, current?: string) {
  if (current !== undefined) {
    await user.type(await screen.findByTestId('update_password_current_input'), current);
  }
  await user.type(await screen.findByTestId('update_password_new_input'), NEW_PASSWORD);
  await user.type(screen.getByTestId('update_password_confirm_input'), NEW_PASSWORD);
  await user.click(screen.getByTestId('update_password_submit_button'));
}

describe('/update-password current password (FRESCO-1015)', () => {
  test('a password session sees the field and sends the current password along', async () => {
    getClaimsMock.mockResolvedValueOnce(asMethods('password'));
    const user = userEvent.setup();
    renderPage();

    await fillAndSubmit(user, 'la-de-siempre-1');

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledWith({ password: NEW_PASSWORD, current_password: 'la-de-siempre-1' }));
  });

  test('a password session cannot submit without it: the field is required and nothing is sent', async () => {
    getClaimsMock.mockResolvedValueOnce(asMethods('password'));
    const user = userEvent.setup();
    renderPage();

    await fillAndSubmit(user);

    expect(screen.getByTestId('update_password_current_input')).toBeRequired();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  test('a recovery session has no such field and sends only the new password, no current_password key', async () => {
    getClaimsMock.mockResolvedValueOnce(asMethods('recovery'));
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByTestId('update_password_new_input'), NEW_PASSWORD);
    expect(screen.queryByTestId('update_password_current_input')).toBeNull();
    await user.type(screen.getByTestId('update_password_confirm_input'), NEW_PASSWORD);
    await user.click(screen.getByTestId('update_password_submit_button'));

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledWith({ password: NEW_PASSWORD }));
  });

  test('a wrong current password shows the Spanish copy, not the raw Auth message', async () => {
    getClaimsMock.mockResolvedValueOnce(asMethods('password'));
    updateUserMock.mockResolvedValueOnce({ error: { code: 'current_password_mismatch', message: 'Incorrect current password' } });
    const user = userEvent.setup();
    renderPage();

    await fillAndSubmit(user, 'otra-1234567');

    expect(await screen.findByText('La contraseña actual no es correcta.')).toBeInTheDocument();
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
