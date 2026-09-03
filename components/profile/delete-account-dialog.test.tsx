import { afterEach, describe, expect, test } from 'bun:test';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';
import { DeleteAccountDialog } from './delete-account-dialog';

/**
 * FRESCO-419 — the confirm button of `DeleteAccountDialog` is a
 * click-through guard on an irreversible action (FRESCO-70 + ADR-0023). A
 * registered user must type her exact email AND a password; a guest types a
 * fixed phrase and has no password field. These tests pin the
 * enable/disable logic of that gate — they never fire the delete, so the
 * Supabase / Edge Function collaborators stay the real (inert) modules.
 */

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
