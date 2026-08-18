'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { deleteMealPlan, MealPlanError } from '@/lib/api/meal-plan';
import { createClient } from '@/lib/supabase/client';

/**
 * FRESCO-62 — deletes the currently-viewed week's plan. `router.refresh()`
 * re-runs `/calendar`'s Server Component so the page falls to the
 * empty-state branch — unlike `CalendarGrid`'s slot-level swap/mark
 * mutations, deleting removes the entire plan, which only a server
 * re-fetch can express correctly.
 *
 * FRESCO-175 — reverses FRESCO-62's original "immediate, no confirmation"
 * business rule: a real Cancel/Confirm gate now sits in front of the
 * delete, same lightweight Dialog pattern as `guest-logout-dialog.tsx`
 * (no typed-confirmation gate — that's reserved for the account-deletion
 * flow, a materially higher-stakes action).
 *
 * Error surface follows `app/onboarding/page.tsx`'s inline
 * `role="alert"` convention (already reused by `CalendarGrid`) rather than
 * a blocking native `alert()`.
 */
export function DeleteWeekButton({ mealPlanId }: { mealPlanId: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const supabase = React.useMemo(() => createClient(), []);

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      await deleteMealPlan(supabase, mealPlanId);
      router.refresh();
    }
    catch (caught) {
      const message = caught instanceof MealPlanError ? caught.message : 'No se pudo eliminar el menú.';
      console.error('[DeleteWeekButton] deleteMealPlan failed', caught);
      setError(message);
      setPending(false);
    }
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="icon"
        size="sm"
        aria-label="Eliminar el menú de esta semana"
        data-testid="delete_week_button"
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="size-6 text-error" />
      </Button>
      {error && (
        <p
          data-testid="delete_week_error_message"
          role="alert"
          aria-live="assertive"
          className="absolute right-0 top-full mt-1 whitespace-nowrap text-body-sm text-error"
        >
          {error}
        </p>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        aria-label="Eliminar el menú de esta semana"
        data-testid="delete_week_confirm_dialog"
      >
        <h2 className="text-h4 text-error">¿Eliminar el menú de esta semana?</h2>
        <p className="mt-2 text-body-sm text-tertiary">
          Se borrarán las 21 franjas de esta semana. Esta acción no se puede deshacer.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirmOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="border-error text-error hover:bg-error hover:text-background"
            disabled={pending}
            data-testid="delete_week_confirm_button"
            onClick={() => {
              setConfirmOpen(false);
              void handleDelete();
            }}
          >
            {pending ? 'Eliminando…' : 'Eliminar menú'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
