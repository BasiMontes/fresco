import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';

/**
 * FRESCO-419 — the confirm button of `DeleteAccountDialog` is a
 * click-through guard on an irreversible action (FRESCO-70 + ADR-0023). A
 * registered user must type her exact email AND a password; a guest types a
 * fixed phrase and has no password field. The first block below pins the
 * enable/disable logic of that gate — it never fires the delete.
 *
 * The second block DOES fire `handleDelete()`. `@/lib/api/edge-functions`
 * and `@/lib/supabase/client` are mocked directly (not the `@api` OpenAPI
 * barrel, which is the module the "no mock.module on @api" gotcha refers
 * to) — confirmed cheap to re-transpile. `useOnboardingStore` stays real
 * (in-memory zustand, no I/O).
 */

const deleteAccountMock = mock(async (_accessToken: string, _reauthToken?: string) => ({ ok: true }));
const getSessionMock = mock(async (): Promise<{ data: { session: { access_token: string } | null } }> => (
  { data: { session: { access_token: 'guest-token' } } }
));
const signInWithPasswordMock = mock(async (_creds: { email: string, password: string }): Promise<
  { data: { session: { access_token: string } | null }, error: Error | null }
> => ({ data: { session: { access_token: 'user-token' } }, error: null }));
const signOutMock = mock(async () => ({ error: null }));

class FakeEdgeFunctionError extends Error {
  constructor(public status: number, public body: { error: string }) {
    super(body.error);
  }
}

void mock.module('@/lib/api/edge-functions', () => ({
  deleteAccount: deleteAccountMock,
  EdgeFunctionError: FakeEdgeFunctionError,
}));

void mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: getSessionMock,
      signInWithPassword: signInWithPasswordMock,
      signOut: signOutMock,
    },
  }),
}));

const { DeleteAccountDialog } = await import('./delete-account-dialog');

describe('DeleteAccountDialog', () => {
  afterEach(() => {
    routerMock.push.mockClear();
  });

  test('keeps confirm disabled until a registered user types email + password', async () => {
    const user = setupUser();
    renderWithProviders(
      <DeleteAccountDialog open onOpenChange={() => {}} email="laura@fresco.app" isAnonymous={false} />,
    );
    const confirm = screen.getByTestId('delete_account_confirm_button');

    expect(confirm).toBeDisabled();

    await user.type(screen.getByTestId('delete_account_email_input'), 'laura@fresco.app');
    expect(confirm).toBeDisabled();

    await user.type(screen.getByTestId('delete_account_password_input'), 'hunter2000');
    expect(confirm).toBeEnabled();
  });

  test('stays disabled when the typed email does not match exactly', async () => {
    const user = setupUser();
    renderWithProviders(
      <DeleteAccountDialog open onOpenChange={() => {}} email="laura@fresco.app" isAnonymous={false} />,
    );

    await user.type(screen.getByTestId('delete_account_email_input'), 'laura@fresco.ap');
    await user.type(screen.getByTestId('delete_account_password_input'), 'hunter2000');

    expect(screen.getByTestId('delete_account_confirm_button')).toBeDisabled();
  });

  test('a guest confirms with the fixed phrase and has no password field', async () => {
    const user = setupUser();
    renderWithProviders(
      <DeleteAccountDialog open onOpenChange={() => {}} email="" isAnonymous />,
    );

    expect(screen.queryByTestId('delete_account_password_input')).toBeNull();
    expect(screen.getByTestId('delete_account_confirm_button')).toBeDisabled();

    await user.type(screen.getByTestId('delete_account_email_input'), 'BORRAR CUENTA');

    expect(screen.getByTestId('delete_account_confirm_button')).toBeEnabled();
  });

  test('Cancel asks the parent to close', async () => {
    const user = setupUser();
    let open = true;
    renderWithProviders(
      <DeleteAccountDialog open onOpenChange={(v) => { open = v; }} email="laura@fresco.app" isAnonymous={false} />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(open).toBe(false);
  });
});

describe('DeleteAccountDialog — handleDelete', () => {
  beforeEach(() => {
    deleteAccountMock.mockClear();
    getSessionMock.mockClear();
    signInWithPasswordMock.mockClear();
    signOutMock.mockClear();
    routerMock.push.mockClear();
    getSessionMock.mockImplementation(async () => ({ data: { session: { access_token: 'guest-token' } } }));
    signInWithPasswordMock.mockImplementation(async () => (
      { data: { session: { access_token: 'user-token' } }, error: null }
    ));
    deleteAccountMock.mockImplementation(async () => ({ ok: true }));
  });

  async function confirmAsRegisteredUser() {
    const user = setupUser();
    renderWithProviders(
      <DeleteAccountDialog open onOpenChange={() => {}} email="laura@fresco.app" isAnonymous={false} />,
    );
    await user.type(screen.getByTestId('delete_account_email_input'), 'laura@fresco.app');
    await user.type(screen.getByTestId('delete_account_password_input'), 'hunter2000');
    await user.click(screen.getByTestId('delete_account_confirm_button'));
  }

  async function confirmAsGuest() {
    const user = setupUser();
    renderWithProviders(
      <DeleteAccountDialog open onOpenChange={() => {}} email="" isAnonymous />,
    );
    await user.type(screen.getByTestId('delete_account_email_input'), 'BORRAR CUENTA');
    await user.click(screen.getByTestId('delete_account_confirm_button'));
  }

  test('a registered user re-authenticates, deletes, and is redirected', async () => {
    await confirmAsRegisteredUser();

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith({ email: 'laura@fresco.app', password: 'hunter2000' });
      expect(deleteAccountMock).toHaveBeenCalledWith('user-token', 'user-token');
      expect(signOutMock).toHaveBeenCalled();
      expect(routerMock.push).toHaveBeenCalledWith('/login?account_deleted=1');
    });
  });

  test('a guest uses the existing session with no reauth token', async () => {
    await confirmAsGuest();

    await waitFor(() => {
      expect(signInWithPasswordMock).not.toHaveBeenCalled();
      expect(deleteAccountMock).toHaveBeenCalledWith('guest-token', undefined);
      expect(routerMock.push).toHaveBeenCalledWith('/login?account_deleted=1');
    });
  });

  test('a guest with no active session sees an error and never calls deleteAccount', async () => {
    getSessionMock.mockImplementation(async () => ({ data: { session: null } }));

    await confirmAsGuest();

    expect(await screen.findByTestId('delete_account_error_message')).toHaveTextContent('No hay una sesión activa');
    expect(deleteAccountMock).not.toHaveBeenCalled();
  });

  test('a wrong password surfaces its own error and never calls deleteAccount', async () => {
    signInWithPasswordMock.mockImplementation(async () => ({ data: { session: null }, error: new Error('bad creds') }));

    await confirmAsRegisteredUser();

    expect(await screen.findByTestId('delete_account_error_message')).toHaveTextContent('La contraseña no es correcta.');
    expect(deleteAccountMock).not.toHaveBeenCalled();
  });

  test('an EdgeFunctionError surfaces its own message', async () => {
    deleteAccountMock.mockImplementation(async () => {
      throw new (await import('@/lib/api/edge-functions')).EdgeFunctionError(429, { error: 'Demasiados intentos, prueba en unos minutos.' });
    });

    await confirmAsRegisteredUser();

    expect(await screen.findByTestId('delete_account_error_message')).toHaveTextContent('Demasiados intentos, prueba en unos minutos.');
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  test('an unexpected error falls back to a generic message', async () => {
    deleteAccountMock.mockImplementation(async () => {
      throw new Error('network down');
    });

    await confirmAsRegisteredUser();

    expect(await screen.findByTestId('delete_account_error_message')).toHaveTextContent('No se pudo eliminar la cuenta. Inténtalo de nuevo.');
  });
});
