'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { deleteAccount, EdgeFunctionError } from '@/lib/api/edge-functions';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { createClient } from '@/lib/supabase/client';

/** Fixed phrase a guest types to confirm deletion — guests have no real email to type instead. */
const GUEST_CONFIRMATION_PHRASE = 'BORRAR CUENTA';

export interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The caller's own email — the confirmation gate below. Always `''` for a guest session. */
  email: string
  /** Whether this is a guest/anonymous session (`user.is_anonymous`) — it has no real email, so it confirms via `GUEST_CONFIRMATION_PHRASE` instead. */
  isAnonymous: boolean
}

/**
 * `/profile` danger zone — the irreversible one (FRESCO-70). `Dialog` usage
 * mirrors `components/recipes/create-recipe-form.tsx` (FRESCO-68). The only
 * safety mechanism in this flow: the confirm button stays disabled until the
 * user has typed her own email exactly, a deliberate click-through guard
 * against a misclick on an action that cannot be undone (cascades through
 * every user-owned table at the DB level, see `deleteAccount`'s doc comment).
 *
 * FRESCO-168: a guest session's `email` is always `''` (no real email exists
 * to type), so the confirmation target switches to a fixed phrase
 * (`GUEST_CONFIRMATION_PHRASE`) for `isAnonymous` sessions — otherwise the
 * gate is mathematically impossible to pass (`'' === ''` is never reachable
 * because the guard also requires a non-empty input).
 */
export function DeleteAccountDialog({ open, onOpenChange, email, isAnonymous }: DeleteAccountDialogProps) {
  const router = useRouter();
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmationTarget = isAnonymous ? GUEST_CONFIRMATION_PHRASE : email;
  const isConfirmed = typedConfirmation.trim().length > 0 && typedConfirmation.trim() === confirmationTarget;

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const client = createClient();
      const { data: { session } } = await client.auth.getSession();
      if (!session) {
        setDeleteError('No hay una sesión activa. Recarga la página e inténtalo de nuevo.');
        return;
      }
      await deleteAccount(session.access_token);
      await client.auth.signOut();
      // FRESCO-150: sessionStorage isn't scoped per-account — clear any
      // onboarding draft so it doesn't leak into whoever logs in next on
      // this browser tab.
      useOnboardingStore.getState().reset();
      router.push('/login?account_deleted=1');
    }
    catch (error) {
      const message = error instanceof EdgeFunctionError
        ? error.body.error
        : 'No se pudo eliminar la cuenta. Inténtalo de nuevo.';
      console.error('[DeleteAccountDialog] deleteAccount failed', error);
      setDeleteError(message);
    }
    finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      aria-label="Borrar cuenta definitivamente"
      data-testid="delete_account_dialog"
    >
      <h2 className="text-h4 text-error">Borrar cuenta definitivamente</h2>
      <p className="mt-2 text-body-sm text-tertiary">
        Esta acción no se puede deshacer. Se eliminarán tu perfil, tus menús, tus listas de la
        compra y tus recetas propias. Escribe
        {' '}
        <strong className="text-text">{confirmationTarget}</strong>
        {' '}
        para confirmar.
      </p>

      <Input
        className="mt-4"
        data-testid="delete_account_email_input"
        type="text"
        placeholder={confirmationTarget}
        aria-label={isAnonymous ? 'Escribe BORRAR CUENTA para confirmar' : 'Escribe tu email para confirmar'}
        autoComplete="off"
        value={typedConfirmation}
        onChange={event => setTypedConfirmation(event.target.value)}
      />

      {deleteError && (
        <p data-testid="delete_account_error_message" role="alert" aria-live="assertive" className="mt-3 text-body-sm text-error">
          {deleteError}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={isDeleting} onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="border-error text-error hover:bg-error hover:text-background"
          disabled={!isConfirmed || isDeleting}
          data-testid="delete_account_confirm_button"
          onClick={() => void handleDelete()}
        >
          {isDeleting ? 'Eliminando…' : 'Borrar cuenta definitivamente'}
        </Button>
      </div>
    </Dialog>
  );
}
