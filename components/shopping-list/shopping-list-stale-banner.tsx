'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { generateShoppingList } from '@/lib/api/edge-functions';
import { getAccessToken } from '@/lib/client-api/auth';

/**
 * FRESCO-1010 (audit 7b A7-LOGIC-07) — the menu changed after this list was built (an ingredient
 * substitution, a replaced or discarded recipe, a recipe added to the week). The list does not move on its
 * own while the person is shopping; this says so and offers "Actualizar lista", which rebuilds it from the
 * menu as it is now and keeps what was already marked as bought and the items the person added.
 * On success `router.refresh()` re-reads the persisted list; the page keys the view by its state, so the
 * rebuilt list replaces the one on screen.
 */
export function ShoppingListStaleBanner({ mealPlanId }: { mealPlanId: string }) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  async function handleRefresh() {
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      const accessToken = await getAccessToken();
      await generateShoppingList({ meal_plan_id: mealPlanId, refresh: true }, accessToken);
      router.refresh();
    }
    catch (error) {
      console.error('[ShoppingListStaleBanner] refresh failed', error);
      setErrorMessage('No pudimos actualizar la lista. Inténtalo de nuevo.');
    }
    finally {
      setIsUpdating(false);
    }
  }

  return (
    <div
      data-testid="shopping_list_stale_banner"
      role="status"
      className="mt-4 flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-body-sm">
        Tu menú ha cambiado desde que generaste esta lista. Actualízala para que incluya los cambios: conservamos lo que ya tienes marcado como comprado y lo que añadiste tú.
      </p>
      <div className="flex shrink-0 flex-col items-start gap-1">
        <Button
          data-testid="shopping_list_refresh_button"
          variant="secondary"
          disabled={isUpdating}
          onClick={() => void handleRefresh()}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {isUpdating ? 'Actualizando…' : 'Actualizar lista'}
        </Button>
        {errorMessage && (
          <p data-testid="shopping_list_refresh_error_message" role="alert" className="text-body-sm text-error">
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}
