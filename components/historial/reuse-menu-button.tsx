'use client';

import { CalendarPlus, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { copyMealPlanToCurrentWeek } from '@/lib/api/meal-plan';
import { createClient } from '@/lib/supabase/client';

/**
 * FRESCO-427 — "Usar este menú en la semana actual", on the read-only detail
 * view of a past week (`/historial?semana=…`, built in FRESCO-425).
 *
 * Copies the viewed week's 21 slots onto the current week via
 * `copyMealPlanToCurrentWeek()` (the `copy_meal_plan_to_week` RPC — one
 * atomic write). If the current week already has a menu, a Cancel/Confirm
 * Dialog gates the replace first — same lightweight pattern as
 * `delete-week-button.tsx`. On success: a brief confirmation, then a
 * redirect to `/calendar` so the user lands on the copied menu.
 */
export function ReuseMenuButton({ sourceMealPlanId, currentWeekHasMenu }: {
  sourceMealPlanId: string
  currentWeekHasMenu: boolean
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const supabase = React.useMemo(() => createClient(), []);

  async function handleCopy() {
    setPending(true);
    setError(null);
    try {
      await copyMealPlanToCurrentWeek(supabase, sourceMealPlanId);
      setDone(true);
      setTimeout(() => router.push('/calendar'), 1200);
    }
    catch (caught) {
      console.error('[ReuseMenuButton] copyMealPlanToCurrentWeek failed', caught);
      setError('No se pudo copiar el menú, inténtalo de nuevo.');
      setPending(false);
    }
  }

  if (done) {
    return (
      <p
        data-testid="reuse_menu_success"
        role="status"
        className="inline-flex items-center gap-2 text-body-md text-primary"
      >
        <Check className="size-5" aria-hidden="true" />
        Menú copiado a la semana actual
      </p>
    );
  }

  return (
    <div>
      <Button
        type="button"
        data-testid="reuse_menu_button"
        disabled={pending}
        onClick={() => (currentWeekHasMenu ? setConfirmOpen(true) : void handleCopy())}
      >
        <CalendarPlus className="size-5" aria-hidden="true" />
        {pending ? 'Copiando…' : 'Usar este menú en la semana actual'}
      </Button>

      {error && (
        <p
          data-testid="reuse_menu_error"
          role="alert"
          aria-live="assertive"
          className="mt-2 text-body-sm text-error"
        >
          {error}
        </p>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        aria-label="Reemplazar el menú de esta semana"
        data-testid="reuse_menu_confirm_dialog"
      >
        <h2 className="text-h4">Esto reemplazará el menú de esta semana</h2>
        <p className="mt-2 text-body-sm text-tertiary">
          Las 21 comidas de la semana actual se sustituirán por las de este menú.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirmOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={pending}
            data-testid="reuse_menu_confirm_button"
            onClick={() => {
              setConfirmOpen(false);
              void handleCopy();
            }}
          >
            Reemplazar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
