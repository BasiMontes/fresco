'use client';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

export interface GuestLogoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isLoggingOut: boolean
}

/**
 * FRESCO-90 — for a guest (`user.is_anonymous`), "Cerrar sesión" is
 * functionally "borrar mi menú generado": the anonymous session IS the
 * account, so signing out invalidates it and every real, persisted row tied
 * to it (`meal_plans` etc.) becomes unreachable. A registered account's
 * logout is 100% safe/reversible — this dialog only ever gates the guest
 * case, wired from `SidebarAccount`.
 */
export function GuestLogoutDialog({ open, onOpenChange, onConfirm, isLoggingOut }: GuestLogoutDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      aria-label="Vas a perder tu menú generado"
      data-testid="guest_logout_dialog"
    >
      <h2 className="text-h4 text-error">¿Cerrar sesión como invitada?</h2>
      <p className="mt-2 text-body-sm text-tertiary">
        Todavía no creaste una cuenta — al cerrar sesión perderás el menú que generaste, sin
        forma de recuperarlo. Si quieres conservarlo, crea una cuenta antes de salir.
      </p>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={isLoggingOut} onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="border-error text-error hover:bg-error hover:text-background"
          disabled={isLoggingOut}
          data-testid="guest_logout_confirm_button"
          onClick={onConfirm}
        >
          {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión de todas formas'}
        </Button>
      </div>
    </Dialog>
  );
}
