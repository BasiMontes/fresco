import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';

import { NoMenuEmptyState } from '@/components/menu/no-menu-empty-state';
import { ShoppingListGenerator } from '@/components/shopping-list/shopping-list-generator';
import { ShoppingListView } from '@/components/shopping-list/shopping-list-view';
import { getMealPlanForWeek } from '@/lib/api/meal-plan';
import { getNombresNuevos, getShoppingListForPlan } from '@/lib/api/shopping-list';
import { createClient } from '@/lib/supabase/server';

/**
 * `/shopping-list` — EPIC-FRESCO-12 (STORY-FRESCO-13). Real data, replacing
 * the `MOCK_SHOPPING_LIST` shell: reads the current week's menu (STORY-FRESCO-7's
 * `getMealPlanForWeek()`, same read path `/menu`/`/calendar` already use),
 * then the shopping list generated from it, if any.
 *
 * Three states, same shape as `/menu`/`/calendar`'s own three-state pattern:
 * no menu yet (`NoMenuEmptyState`, shared — generating a menu is a different
 * story's job), menu exists but no list yet (`ShoppingListGenerator`), list
 * already generated (`ShoppingListView`, the real thing).
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
      return (
        <div className="mx-auto max-w-2xl">
          <ShoppingListGenerator mealPlanId={plan.mealPlanId} />
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
