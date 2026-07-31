'use client';

import { ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { EdgeFunctionError, generateShoppingList } from '@/lib/api/edge-functions';
import { createClient } from '@/lib/supabase/client';

export interface ShoppingListGeneratorProps {
  mealPlanId: string
}

/**
 * "No shopping list yet for this plan" state (STORY-FRESCO-13) — distinct
 * from `NoMenuEmptyState` (which means "no menu at all"): here a menu
 * already exists, just no list generated from it yet.
 *
 * On success, `router.refresh()` re-runs `/shopping-list/page.tsx`'s server
 * fetch rather than holding the generated list in local client state — the
 * page already reads `getShoppingListForPlan()` fresh on every render, so
 * this is the same "one read path, not two" precedent `/onboarding`'s
 * `handleGenerate()` → `router.push('/menu')` established (there, a full
 * navigation; here, a refresh of the same route, since the shape of the
 * page doesn't change, only which branch it renders).
 */
export function ShoppingListGenerator({ mealPlanId }: ShoppingListGeneratorProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  async function handleGenerate() {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      await generateShoppingList({ meal_plan_id: mealPlanId }, session?.access_token ?? null);
      router.refresh();
    }
    catch (error) {
      // AC Scenario 4: "la lista no se pudo generar" (422, ingredientes no
      // consolidables) gets its own clear message, distinct from a generic
      // failure — same narrowing precedent as onboarding's 422 vs 502 split.
      if (error instanceof EdgeFunctionError && error.status === 422) {
        setErrorMessage('No pudimos generar una lista de la compra a partir de este menú.');
      }
      else if (error instanceof EdgeFunctionError && error.status === 409) {
        // Race condition backstop (Business Rules: at most one list per
        // plan) — the page's own read path is the primary defense; this
        // covers the rare case of a concurrent generate elsewhere.
        router.refresh();
        return;
      }
      else {
        setErrorMessage('No pudimos generar la lista de la compra. Intenta de nuevo.');
      }
    }
    finally {
      setIsGenerating(false);
    }
  }

  return (
    <EmptyState
      data-testid="shopping_list_empty_state"
      icon={<ShoppingCart className="size-8 text-tertiary" aria-hidden="true" />}
      title="Todavía no tienes una lista de la compra para este menú"
      description="Genera tu lista, consolidada y agrupada por pasillo, en unos segundos."
      action={(
        <div className="flex flex-col items-center gap-2">
          <Button
            data-testid="generate_shopping_list_button"
            variant="action"
            size="lg"
            disabled={isGenerating}
            onClick={() => void handleGenerate()}
          >
            {isGenerating ? 'Generando lista…' : 'Generar lista de la compra'}
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
