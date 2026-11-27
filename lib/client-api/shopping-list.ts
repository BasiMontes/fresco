import { addShoppingListItem as addShoppingListItemFor, clearComprados as clearCompradosFor, getShoppingListItemComprado as getShoppingListItemCompradoFor, listaDesactualizadaDeSlot as listaDesactualizadaDeSlotFor, removeShoppingListItem as removeShoppingListItemFor, toggleShoppingListItem as toggleShoppingListItemFor } from '@/lib/api/shopping-list';
import { createClient } from '@/lib/supabase/client';

/** ADR-0041: the shopping-list writes of `lib/api/shopping-list`, bound to the signed-in browser session. */

export async function addShoppingListItem(args: Parameters<typeof addShoppingListItemFor>[1]) {
  return addShoppingListItemFor(createClient(), args);
}

export async function clearComprados(listId: Parameters<typeof clearCompradosFor>[1]) {
  return clearCompradosFor(createClient(), listId);
}

export async function getShoppingListItemComprado(args: Parameters<typeof getShoppingListItemCompradoFor>[1]) {
  return getShoppingListItemCompradoFor(createClient(), args);
}

export async function removeShoppingListItem(args: Parameters<typeof removeShoppingListItemFor>[1]) {
  return removeShoppingListItemFor(createClient(), args);
}

export async function toggleShoppingListItem(args: Parameters<typeof toggleShoppingListItemFor>[1]) {
  return toggleShoppingListItemFor(createClient(), args);
}

export async function listaDesactualizadaDeSlot(slotId: Parameters<typeof listaDesactualizadaDeSlotFor>[1]) {
  return listaDesactualizadaDeSlotFor(createClient(), slotId);
}
