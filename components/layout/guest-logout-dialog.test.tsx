import { describe, expect, mock, test } from 'bun:test';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { GuestLogoutDialog } from './guest-logout-dialog';

/**
 * FRESCO-1265 — what the guest is told before signing out. `sidebar-account.test.tsx` and `danger-zone.test.tsx` pin that a
 * guest goes through this dialog and that nothing is signed out until she confirms, but not what the dialog SAYS. The scenario
 * ("Cerrar sesión como invitada advierte antes de borrar el menú generado") is about that warning being specific: if the text
 * turned into a generic "¿Seguro que quieres salir?", every other test would stay green.
 */

function renderDialog(over: Partial<{ open: boolean, isLoggingOut: boolean }> = {}) {
  const onOpenChange = mock((_open: boolean) => {});
  const onConfirm = mock(() => {});
  renderWithProviders(<GuestLogoutDialog open={over.open ?? true} isLoggingOut={over.isLoggingOut ?? false} onOpenChange={onOpenChange} onConfirm={onConfirm} />);
  return { onOpenChange, onConfirm };
}

describe('GuestLogoutDialog — the warning', () => {
  test('names the guest case, not a plain logout', () => {
    renderDialog();

    expect(screen.getByRole('heading', { name: '¿Cerrar sesión como invitada?' })).toBeInTheDocument();
  });

  test('says the generated menu is lost, with no way to get it back', () => {
    renderDialog();

    const dialog = screen.getByTestId('guest_logout_dialog');
    expect(dialog.textContent).toContain('perderás el menú que generaste');
    expect(dialog.textContent).toContain('sin forma de recuperarlo');
  });

  test('tells her how to keep it: create an account before leaving', () => {
    renderDialog();

    expect(screen.getByTestId('guest_logout_dialog').textContent).toContain('crea una cuenta antes de salir');
  });

  test('is labelled for assistive technology with what is at stake', () => {
    renderDialog();

    expect(screen.getByTestId('guest_logout_dialog').getAttribute('aria-label')).toBe('Vas a perder tu menú generado');
  });
});

describe('GuestLogoutDialog — the choices', () => {
  test('confirming signs out, and says it plainly', async () => {
    const { onConfirm } = renderDialog();
    const confirm = screen.getByTestId('guest_logout_confirm_button');
    expect(confirm.textContent).toBe('Cerrar sesión de todas formas');

    await setupUser().click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('"Cancelar" closes the dialog and signs nothing out', async () => {
    const { onConfirm, onOpenChange } = renderDialog();

    await setupUser().click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('while signing out both buttons are disabled and the confirm one says so', () => {
    renderDialog({ isLoggingOut: true });

    const confirm = screen.getByTestId<HTMLButtonElement>('guest_logout_confirm_button');
    expect(confirm.textContent).toBe('Cerrando sesión…');
    expect(confirm.disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancelar' }).disabled).toBe(true);
  });

  test('closed, it shows nothing to read', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('heading', { name: '¿Cerrar sesión como invitada?' })).toBeNull();
  });
});
