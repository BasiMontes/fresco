'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { deleteAccount, EdgeFunctionError } from '@/lib/api/edge-functions';
import { createClient } from '@/lib/supabase/client';

export interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The caller's own email — the confirmation gate below. */
  email: string
}

/**
 * `/profile` danger zone — the irreversible one (FRESCO-70). `Dialog` usage
 * mirrors `components/recipes/create-recipe-form.tsx` (FRESCO-68). The only
 * safety mechanism in this flow: the confirm button stays disabled until the
 * user has typed her own email exactly, a deliberate click-through guard
 * against a misclick on an action that cannot be undone (cascades through
 * every user-owned table at the DB level, see `deleteAccount`'s doc comment).
 */
export function DeleteAccountDialog({ open, onOpenChange, email }: DeleteAccountDialogProps) {
  const router = useRouter();
  const [typedEmail, setTypedEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isConfirmed = typedEmail.trim().length > 0 && typedEmail.trim() === email;

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
        <strong className="text-text">{email}</strong>
        {' '}
        para confirmar.
      </p>

      <Input
        className="mt-4"
        data-testid="delete_account_email_input"
        type="text"
        placeholder={email}
        aria-label="Escribe tu email para confirmar"
        autoComplete="off"
        value={typedEmail}
        onChange={event => setTypedEmail(event.target.value)}
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
