import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenerateShoppingListResponse, ShoppingListItem } from '@/lib/api/types';
import type { Database, Json } from '@/lib/supabase/types';

export class ShoppingListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShoppingListError';
  }
}

export interface ShoppingListPersistido {
  id: string
  pasillos: GenerateShoppingListResponse['pasillos']
  resumen: GenerateShoppingListResponse['resumen']
}

/**
 * Reads the persisted shopping list for a given meal plan, if one exists.
 * Business Rules: at most one list per plan — a `null` return means "not
 * generated yet", the same "not an error" convention as
 * `getMealPlanForWeek()`'s own null case.
 *
 * `resumen.total_items` is recomputed from the persisted `items` (never
 * stored itself); `coste_estimado_min/max` ARE stored (added alongside this
 * story — the generation response had them, but the table never persisted
 * them, so a revisit after generation had no cost estimate to show).
 *
 * Public method — fails fast (throws `ShoppingListError`) on a real DB
 * error, per `references/error-handling.md`.
 */
export async function getShoppingListForPlan(
  client: SupabaseClient<Database>,
  mealPlanId: string,
): Promise<ShoppingListPersistido | null> {
  const { data, error } = await client
    .from('shopping_lists')
    .select('id, items, coste_estimado_min, coste_estimado_max')
    .eq('meal_plan_id', mealPlanId)
    .maybeSingle();

  if (error) {
    throw new ShoppingListError(`No se pudo leer la lista de la compra: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  // Cast, not a runtime validation — `items` is jsonb typed as `Json`, but
  // its real shape is guaranteed by `generate-shopping-list/index.ts`, the
  // only writer of this column. Same trust boundary as `meal-plan.ts`'s
  // `toRecipe()`.
  const pasillos = data.items as unknown as GenerateShoppingListResponse['pasillos'];
  const totalItems = pasillos.reduce((acc, pasillo) => acc + pasillo.items.length, 0);

  return {
    id: data.id,
    pasillos,
    resumen: {
      total_items: totalItems,
      coste_estimado_min: data.coste_estimado_min,
      coste_estimado_max: data.coste_estimado_max,
      moneda: 'EUR',
    },
  };
}

/**
 * Toggles a single item's `comprado` flag via the `jsonb_set_comprado`
 * `security definer` RPC (api-contracts.md §3) — bypasses the Edge Function
 * layer entirely, the same "direct-write for an already-generated
 * resource" precedent `swapMealPlanSlots()` established. Ownership is
 * enforced inside the SQL function itself (`where ... and user_id =
 * auth.uid()`), not re-checked here.
 *
 * Business Rules: purely a local household action — never touches the menu
 * or any learning/aprendizaje data.
 */
export async function toggleShoppingListItem(
  client: SupabaseClient<Database>,
  listId: string,
  pasilloIdx: number,
  itemIdx: number,
  comprado: boolean,
): Promise<void> {
  const { error } = await client.rpc('jsonb_set_comprado', {
    p_list_id: listId,
    p_pasillo_idx: pasilloIdx,
    p_item_idx: itemIdx,
    p_comprado: comprado,
  });

  if (error) {
    throw new ShoppingListError(`No se pudo actualizar el producto: ${error.message}`);
  }
}

/**
 * Adds a suggested item (FRESCO-194's favorites-based carousel) to the
 * given pasillo via the `jsonb_add_item` `security definer` RPC — same
 * direct-write precedent as `toggleShoppingListItem`. `jsonb_add_item`
 * appends a new pasillo bucket automatically if this is the list's first
 * item for that aisle.
 */
export async function addShoppingListItem(
  client: SupabaseClient<Database>,
  listId: string,
  pasilloNombre: string,
  item: ShoppingListItem,
): Promise<void> {
  const { error } = await client.rpc('jsonb_add_item', {
    p_list_id: listId,
    p_pasillo_nombre: pasilloNombre,
    // `ShoppingListItem` is a real jsonb value (all fields serializable) —
    // the mismatch is only that its type has no index signature, not that
    // the shape is wrong.
    p_item: item as unknown as Json,
  });

  if (error) {
    throw new ShoppingListError(`No se pudo añadir el producto: ${error.message}`);
  }
}
