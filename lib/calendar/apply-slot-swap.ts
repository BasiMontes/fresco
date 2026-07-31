import type { Recipe } from '@schemas';
import type { DiaSemana, TipoPlato } from '@/lib/api/types';

/** Addresses one grid cell by its (día, tipo_plato) coordinates. */
export interface SlotKey {
  dia: DiaSemana
  tipo: TipoPlato
}

/**
 * `null` marks a slot the model correctly reported has no safe recipe for
 * the user's restrictions (FR-8.2 / AC Scenario 4, FRESCO-23) — paired with
 * an `advertencias` entry, never silent.
 */
export type MenuGrid = Record<DiaSemana, Record<TipoPlato, Recipe | null>>;

/**
 * Pure helper (STORY-FRESCO-11) — returns a NEW grid with the recipes at
 * slots `a` and `b` exchanged. Framework-agnostic (no React/DOM
 * dependency): `CalendarGrid` calls it on drop for the optimistic local
 * update, and calls it again with the same two keys to revert on an RPC
 * failure — a swap is its own inverse, so one function serves both
 * directions.
 *
 * Never mutates `menu`: the returned grid is a new top-level object, and
 * every day object touched by the swap is itself a new object. Days not
 * involved in the swap keep their original reference (safe — they aren't
 * written to). When `a.dia === b.dia`, the second assignment below spreads
 * the ALREADY-copied day object (not the original `menu[a.dia]`), so the
 * first tipo's swap isn't silently discarded.
 *
 * Swapping a slot with itself (`a.dia === b.dia && a.tipo === b.tipo`) is a
 * documented no-op: the returned grid is a new object but value-equivalent
 * to the input.
 */
export function applySlotSwap(menu: MenuGrid, a: SlotKey, b: SlotKey): MenuGrid {
  const next = { ...menu };

  const recipeA = menu[a.dia][a.tipo];
  const recipeB = menu[b.dia][b.tipo];

  next[a.dia] = { ...next[a.dia], [a.tipo]: recipeB };
  next[b.dia] = { ...next[b.dia], [b.tipo]: recipeA };

  return next;
}
