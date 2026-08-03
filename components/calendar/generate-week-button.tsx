'use client';

import { Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { buttonVariants } from '@/components/ui/button';
import { EdgeFunctionError, generateMealPlan } from '@/lib/api/edge-functions';
import { createClient } from '@/lib/supabase/client';

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
 */
export function GenerateWeekButton({ semanaIso, fechaInicio }: { semanaIso: string, fechaInicio: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const supabase = React.useMemo(() => createClient(), []);

  async function handleGenerate() {
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

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={pending}
        data-testid="generate_week_button"
        className={buttonVariants({ variant: 'action', size: 'lg' })}
        onClick={() => void handleGenerate()}
      >
        <Zap className="size-[18px]" strokeWidth={2} />
        {pending ? 'Generando…' : 'Generar mi menú'}
      </button>
      {error && (
        <p
          data-testid="generate_week_error_message"
          role="alert"
          aria-live="assertive"
          className="text-body-sm text-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}
