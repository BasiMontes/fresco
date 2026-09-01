import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';

import { NoMenuEmptyState } from '@/components/menu/no-menu-empty-state';
import { ShoppingListGenerator } from '@/components/shopping-list/shopping-list-generator';
import { ShoppingListView } from '@/components/shopping-list/shopping-list-view';
import { getMealPlanForWeek } from '@/lib/api/meal-plan';
import { ensureShoppingListForPlan, getNombresNuevos } from '@/lib/api/shopping-list';
import { POSTHOG_EVENTS } from '@/lib/posthog/event-names';
import { captureServerEvent } from '@/lib/posthog/server';
import { createClient } from '@/lib/supabase/server';

/**
 * `/shopping-list` — EPIC-FRESCO-12 (STORY-FRESCO-13). Reads the current
 * week's menu, then the shopping list generated from it.
 *
 * FRESCO-367 (A4-H10): the list is now generated **automatically** on this
 * first visit (`ensureShoppingListForPlan`) rather than behind a manual
 * "Generar" button — the PRD always promised an automatic list, and only
 * 2/38 plans had one. `ShoppingListGenerator` (the button) survives as the
 * fallback for the rare case where that lazy generation fails.
 *
 * Three states: no menu yet (`NoMenuEmptyState`), menu exists (list is
 * generated here if missing → `ShoppingListView`), generation failed
 * (`ShoppingListGenerator` fallback).
 */
export default async function ShoppingListPage() {
  const supabase = await createClient();

  let plan: MenuSemanalPersistido | null;
  try {
    plan = await getMealPlanForWeek(supabase);
  }
  catch (error) {
    // Same judgment call as /menu and /calendar (STORY-FRESCO-7 batch 2):
    // falls back to the empty state rather than crashing the page.
    console.error('[/shopping-list] getMealPlanForWeek failed, falling back to empty state', error);
    plan = null;
  }

  if (!plan) {
    return (
      <div className="mx-auto max-w-2xl">
        <NoMenuEmptyState data-testid="shopping_list_no_menu_empty_state" />
      </div>
    );
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const { list, generated } = await ensureShoppingListForPlan(
      supabase,
      plan.mealPlanId,
      session?.access_token ?? null,
    );

    if (!list) {
      // Lazy generation failed — offer the manual retry (unchanged UX).
      return (
        <div className="mx-auto max-w-2xl">
          <ShoppingListGenerator mealPlanId={plan.mealPlanId} />
        </div>
      );
    }

    if (generated && session?.user?.id) {
      // FRESCO-367 AC: the automatic generation is instrumented (item count +
      // cost estimate). Server-side so it isn't lost to ad-blockers, one-time
      // per plan. Fail-soft — `captureServerEvent` swallows its own errors.
      await captureServerEvent({
        distinctId: session.user.id,
        event: POSTHOG_EVENTS.SHOPPING_LIST_GENERATED,
        properties: {
          auto: true,
          n_items: list.resumen.total_items,
          coste_estimado_min: list.resumen.coste_estimado_min,
          coste_estimado_max: list.resumen.coste_estimado_max,
        },
      });
    }

    // FRESCO-194 — "Nuevo" badge: which items weren't on last week's list.
    // `getNombresNuevos` is fail-soft (empty set on any error), so no extra
    // try/catch here.
    const nuevosNombres = await getNombresNuevos(supabase, plan.semanaIso, list.pasillos);

    return <ShoppingListView list={list} nuevosNombres={nuevosNombres} />;
  }
  catch (error) {
    console.error('[/shopping-list] shopping list read/generate failed, falling back to generator', error);
    return (
      <div className="mx-auto max-w-2xl">
        <ShoppingListGenerator mealPlanId={plan.mealPlanId} />
      </div>
    );
  }
}
