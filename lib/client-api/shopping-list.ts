import { addShoppingListItem as addShoppingListItemFor, clearComprados as clearCompradosFor, toggleShoppingListItem as toggleShoppingListItemFor } from '@/lib/api/shopping-list';
import { createClient } from '@/lib/supabase/client';

/** ADR-0041: the shopping-list writes of `lib/api/shopping-list`, bound to the signed-in browser session. */

export async function addShoppingListItem(args: Parameters<typeof addShoppingListItemFor>[1]) {
  return addShoppingListItemFor(createClient(), args);
}

export async function clearComprados(listId: Parameters<typeof clearCompradosFor>[1]) {
  return clearCompradosFor(createClient(), listId);
}

export async function toggleShoppingListItem(args: Parameters<typeof toggleShoppingListItemFor>[1]) {
  return toggleShoppingListItemFor(createClient(), args);
}
