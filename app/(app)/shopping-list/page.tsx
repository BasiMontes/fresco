import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';

import { NoMenuEmptyState } from '@/components/menu/no-menu-empty-state';
import { ShoppingListGenerator } from '@/components/shopping-list/shopping-list-generator';
import { ShoppingListView } from '@/components/shopping-list/shopping-list-view';
import { getMealPlanForWeek } from '@/lib/api/meal-plan';
import { getNombresNuevos, getShoppingListForPlan } from '@/lib/api/shopping-list';
import { createClient } from '@/lib/supabase/server';

/**
 * `/shopping-list` — EPIC-FRESCO-12 (STORY-FRESCO-13). Reads the current
 * week's menu, then the shopping list generated from it.
 *
 * FRESCO-367 (A4-H10): the list is now generated **automatically** — when
 * none exists yet, `ShoppingListGenerator` renders in `autoGenerate` mode and
 * fires the generation itself on mount (no manual "Generar" click). The PRD
 * always promised an automatic list and only 2/38 plans had one. The button
 * survives inside that component as the manual retry when the automatic
 * attempt fails.
 *
 * Three states: no menu yet (`NoMenuEmptyState`), menu exists (list shown, or
 * auto-generated then shown), read error (manual `ShoppingListGenerator`).
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
    const list = await getShoppingListForPlan(supabase, plan.mealPlanId);

    if (!list) {
      // FRESCO-367: generate automatically on this first visit.
      return (
        <div className="mx-auto max-w-2xl">
          <ShoppingListGenerator mealPlanId={plan.mealPlanId} autoGenerate />
        </div>
      );
    }

    // FRESCO-194 — "Nuevo" badge: which items weren't on last week's list.
    // `getNombresNuevos` is fail-soft (empty set on any error), so no extra
    // try/catch here.
    const nuevosNombres = await getNombresNuevos(supabase, plan.semanaIso, list.pasillos);

    return <ShoppingListView list={list} nuevosNombres={nuevosNombres} />;
  }
  catch (error) {
    console.error('[/shopping-list] getShoppingListForPlan failed, falling back to generator', error);
    return (
      <div className="mx-auto max-w-2xl">
        <ShoppingListGenerator mealPlanId={plan.mealPlanId} />
      </div>
    );
  }
}
