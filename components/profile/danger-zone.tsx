'use client';

import { Download, LogOut, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DeleteAccountDialog } from '@/components/profile/delete-account-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { createClient } from '@/lib/supabase/client';

/**
 * `/profile` "Cuenta" row group (FRESCO-220): logout + CSV data export
 * (FRESCO-163) — split out of `DangerZone` below, neither is actually a
 * destructive action, so neither belongs in the danger-styled card.
 */
export function AccountActions() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      const client = createClient();
      await client.auth.signOut();
      // FRESCO-150: sessionStorage isn't scoped per-account — clear any
      // onboarding draft so it doesn't leak into whoever logs in next on
      // this browser tab.
      useOnboardingStore.getState().reset();
      router.push('/login');
    }
    catch (error) {
      console.error('[AccountActions] signOut failed', error);
      setLogoutError('No se pudo cerrar sesión. Inténtalo de nuevo.');
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      <div className="flex items-center justify-between gap-3 py-3 first:pt-0">
        <div className="flex items-center gap-2 text-body-md text-text">
          <LogOut className="size-4 text-tertiary" aria-hidden="true" />
          Cerrar sesión
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="logout_button"
          disabled={isLoggingOut}
          onClick={() => void handleLogout()}
        >
          {isLoggingOut ? 'Saliendo…' : 'Cerrar sesión'}
        </Button>
      </div>
      {logoutError && (
        <p data-testid="logout_error_message" role="alert" aria-live="assertive" className="pt-2 text-body-sm text-error">
          {logoutError}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 py-3 last:pb-0">
        <div className="flex items-center gap-2 text-body-md text-text">
          <Download className="size-4 text-tertiary" aria-hidden="true" />
          Backup CSV
        </div>
        <a
          href="/api/profile/export"
          download
          data-testid="export_data_link"
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          Descargar
        </a>
      </div>
    </div>
  );
}

export interface DangerZoneProps {
  /** The caller's own email — passed through to the delete-account confirmation gate. */
  email: string
  /** Whether this is a guest/anonymous session — passed through to the delete-account confirmation gate (FRESCO-168). */
  isAnonymous: boolean
}

/**
 * `/profile` "Zona de peligro" (FRESCO-220): permanent account deletion
 * only. Used to bundle logout + CSV export here too, but neither is a
 * dangerous action — they now live in `AccountActions` above, in a
 * regularly-styled card.
 */
export function DangerZone({ email, isAnonymous }: DangerZoneProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-body-md text-error">
        <Trash2 className="size-4" aria-hidden="true" />
        Borrar cuenta definitivamente
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="border-error text-error hover:bg-error hover:text-background"
        data-testid="delete_account_open_button"
        onClick={() => setDeleteDialogOpen(true)}
      >
        Eliminar cuenta
      </Button>

      <DeleteAccountDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} email={email} isAnonymous={isAnonymous} />
    </div>
  );
}
