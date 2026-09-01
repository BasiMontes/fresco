'use client';

import { Loader2, ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { EdgeFunctionError, generateShoppingList } from '@/lib/api/edge-functions';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';
import { createClient } from '@/lib/supabase/client';

export interface ShoppingListGeneratorProps {
  mealPlanId: string
  /**
   * FRESCO-367: when `true` the list generation fires automatically on mount
   * (the page renders this the first time `/shopping-list` is opened without a
   * list). The manual button only reappears if that automatic attempt fails.
   */
  autoGenerate?: boolean
}

/**
 * Shopping-list generation (STORY-FRESCO-13). FRESCO-367 (A4-H10): the list
 * is generated automatically on the first `/shopping-list` visit — this
 * component, in `autoGenerate` mode, fires the generation itself on mount and
 * shows a "preparing" state instead of a button. The button is the manual
 * retry shown only after an automatic attempt fails, or when the page renders
 * this as a plain read-error fallback (`autoGenerate` unset).
 *
 * On success, `router.refresh()` re-runs `/shopping-list/page.tsx`'s server
 * fetch — the page always re-reads the persisted list, so there is one read
 * path, not two (same precedent as `/onboarding`'s `handleGenerate()`).
 */
export function ShoppingListGenerator({ mealPlanId, autoGenerate = false }: ShoppingListGeneratorProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = React.useState(autoGenerate);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  // Once an automatic attempt has failed, drop to the manual button — don't
  // keep re-firing on every re-render.
  const [autoAttempted, setAutoAttempted] = React.useState(false);

  const handleGenerate = React.useCallback(async (auto: boolean) => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const result = await generateShoppingList({ meal_plan_id: mealPlanId }, session?.access_token ?? null);
      // FRESCO-366 / FRESCO-367: fired only on a real success. `auto`
      // distinguishes the automatic first-visit generation from a manual
      // retry; item count + cost estimate are the AC-required instrumentation.
      captureEvent(POSTHOG_EVENTS.SHOPPING_LIST_GENERATED, {
        auto,
        n_items: result.resumen.total_items,
        coste_estimado_min: result.resumen.coste_estimado_min,
        coste_estimado_max: result.resumen.coste_estimado_max,
      });
      router.refresh();
    }
    catch (error) {
      if (error instanceof EdgeFunctionError && error.status === 409) {
        // Another generation (a concurrent tab, or a retry after a slow
        // response that did land) already created the list — just re-read.
        router.refresh();
        return;
      }
      if (error instanceof EdgeFunctionError && error.status === 422) {
        // "la lista no se pudo generar" (422, ingredientes no consolidables).
        setErrorMessage('No pudimos generar una lista de la compra a partir de este menú.');
      }
      else {
        setErrorMessage('No pudimos generar la lista de la compra. Intenta de nuevo.');
      }
      setIsGenerating(false);
    }
  }, [mealPlanId, router]);

  React.useEffect(() => {
    if (autoGenerate && !autoAttempted) {
      setAutoAttempted(true);
      void handleGenerate(true);
    }
  }, [autoGenerate, autoAttempted, handleGenerate]);

  // Automatic generation still in flight (or just failed and about to show the
  // button) — a calm "preparing" state, no button to click.
  if (isGenerating) {
    return (
      <EmptyState
        data-testid="shopping_list_empty_state"
        icon={<Loader2 className="size-8 animate-spin text-tertiary" aria-hidden="true" />}
        title="Preparando tu lista de la compra"
        description="Consolidamos los ingredientes de tu menú y los agrupamos por pasillo. Un momento…"
      />
    );
  }

  return (
    <EmptyState
      data-testid="shopping_list_empty_state"
      icon={<ShoppingCart className="size-8 text-tertiary" aria-hidden="true" />}
      title={autoAttempted ? 'No pudimos preparar tu lista automáticamente' : 'Todavía no tienes una lista de la compra para este menú'}
      description="Genera tu lista de la compra, consolidada y agrupada por pasillo, en unos segundos."
      action={(
        <div className="flex flex-col items-center gap-2">
          <Button
            data-testid="generate_shopping_list_button"
            variant="action"
            size="lg"
            disabled={isGenerating}
            onClick={() => void handleGenerate(false)}
          >
            Generar lista de la compra
          </Button>
          {errorMessage && (
            <p data-testid="shopping_list_generate_error_message" className="text-body-sm text-error">
              {errorMessage}
            </p>
          )}
        </div>
      )}
    />
  );
}
