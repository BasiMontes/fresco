'use client';

import { Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { buttonVariants } from '@/components/ui/button';
import { EdgeFunctionError, generateMealPlan } from '@/lib/api/edge-functions';
import { getIsoWeekMonday } from '@/lib/date/iso-week';
import { createClient } from '@/lib/supabase/client';

const PAST_WEEK_MESSAGE = 'No se pueden planificar semanas que ya han pasado.';

/**
 * FRESCO-63 — generates a menu for whichever week `/calendar` is currently
 * viewing (`semanaIso`/`fechaInicio`, passed down from the page). Reuses
 * `generateMealPlan()` unchanged — it already takes an explicit week, never
 * hardcoded to "today" (confirmed at EPIC-FRESCO-60's Stage 1).
 *
 * Error handling mirrors `app/onboarding/page.tsx`'s `handleGenerate()`:
 * `422` (catálogo insuficiente) gets the same message onboarding already
 * validated live; `409` ("ya existe un plan para esta semana") is handled
 * defensively even though the button never renders once a plan exists
 * (FRESCO-62's sibling delete-first rule) — a stale page or a double-click
 * race could still hit it.
 *
 * FRESCO-209/FRESCO-210 — `/calendar`'s week navigation lets a user browse
 * back into already-passed weeks (FRESCO-158's `MAX_WEEK_OFFSET` bounds how
 * far, but doesn't stop past weeks specifically), and nothing blocked
 * generating a menu for one of them. `fechaInicio` is already that week's
 * Monday (`YYYY-MM-DD`, ISO-sortable), so comparing it against
 * `getIsoWeekMonday()` (this week's Monday) is enough to detect "already
 * passed" without new date math. Blocked at both the UI (button disabled,
 * generation never fires) and defensively inside `handleGenerate` in case a
 * session left open across a week boundary makes the disabled state stale.
 */
export function GenerateWeekButton({ semanaIso, fechaInicio }: { semanaIso: string, fechaInicio: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const supabase = React.useMemo(() => createClient(), []);
  const isPastWeek = fechaInicio < getIsoWeekMonday();

  async function handleGenerate() {
    if (isPastWeek) {
      setError(PAST_WEEK_MESSAGE);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await generateMealPlan(
        { semana_iso: semanaIso, fecha_inicio: fechaInicio },
        session?.access_token ?? null,
      );
      router.refresh();
    }
    catch (caught) {
      if (caught instanceof EdgeFunctionError && caught.status === 422) {
        setError('No pudimos generar un menú válido con tus restricciones actuales. Prueba a ampliar tus preferencias o inténtalo de nuevo más tarde.');
      }
      else if (caught instanceof EdgeFunctionError && caught.status === 409) {
        setError('Ya existe un menú para esta semana. Elimínalo antes de generar uno nuevo.');
      }
      else {
        setError('No pudimos generar tu menú. Intenta de nuevo.');
      }
      console.error('[GenerateWeekButton] generateMealPlan failed', caught);
      setPending(false);
    }
  }

  const displayedError = error ?? (isPastWeek ? PAST_WEEK_MESSAGE : null);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={pending || isPastWeek}
        data-testid="generate_week_button"
        className={buttonVariants({ variant: 'action', size: 'lg' })}
        onClick={() => void handleGenerate()}
      >
        <Zap className="size-[18px]" strokeWidth={2} />
        {pending ? 'Generando…' : 'Generar mi menú'}
      </button>
      {displayedError && (
        <p
          data-testid="generate_week_error_message"
          role="alert"
          aria-live="assertive"
          className="text-body-sm text-error"
        >
          {displayedError}
        </p>
      )}
    </div>
  );
}
