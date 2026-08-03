'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { deleteMealPlan, MealPlanError } from '@/lib/api/meal-plan';
import { createClient } from '@/lib/supabase/client';

/**
 * FRESCO-62 — deletes the currently-viewed week's plan. Immediate, no
 * confirmation (the story's own Business Rules call this out as
 * deliberate for this version). `router.refresh()` re-runs `/calendar`'s
 * Server Component so the page falls to the empty-state branch — unlike
 * `CalendarGrid`'s slot-level swap/mark mutations, deleting removes the
 * entire plan, which only a server re-fetch can express correctly.
 *
 * Error surface follows `app/onboarding/page.tsx`'s inline
 * `role="alert"` convention (already reused by `CalendarGrid`) rather than
 * a blocking native `alert()`.
 */
export function DeleteWeekButton({ mealPlanId }: { mealPlanId: string }) {
  const router = useRouter();
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
        onClick={() => void handleDelete()}
      >
        <Trash2 className="size-4 text-error" />
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
    </div>
  );
}
