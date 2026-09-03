import type { Recipe } from '@schemas';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecipeRow } from '@/lib/api/recipes';
import type { DiaSemana, EstadoRecetaSlot, TipoPlato } from '@/lib/api/types';
import type { Database } from '@/lib/supabase/types';
import { toRecipe } from '@/lib/api/recipes';
import { getDateFromIsoWeek, getIsoWeek, getIsoWeekMonday } from '@/lib/date/iso-week';

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const TIPOS: TipoPlato[] = ['desayuno', 'comida', 'cena'];

/** One `meal_plans` row joined to its 21 `meal_plan_recipes` rows and their `recipes`. */
interface MealPlanJoinRow {
  id: string
  semana_iso: string
  advertencias: string[]
  explicacion_aprendizaje: string | null
  meal_plan_recipes: {
    id: string
    dia: DiaSemana
    tipo_plato: Database['public']['Enums']['tipo_plato']
    estado: EstadoRecetaSlot
    recipes: RecipeRow | null
  }[]
}

export interface MenuSemanalPersistido {
  /** `meal_plans.id` (STORY-FRESCO-13) — addresses this plan for `generateShoppingList()`. */
  mealPlanId: string
  semanaIso: string
  /**
   * A slot is `null` when the model correctly reported no safe recipe exists
   * for it (FR-8.2 / AC Scenario 4, FRESCO-23) — paired with an
   * `advertencias` entry, never silent.
   */
  menu: Record<DiaSemana, Record<TipoPlato, Recipe | null>>
  /**
   * `meal_plan_recipes.id` per slot (STORY-FRESCO-11) — lets a caller address
   * a specific slot's row (e.g. for `swapMealPlanSlots()`) without changing
   * `menu`'s existing shape. Additive: `/menu/page.tsx` ignores this field.
   */
  slotIds: Record<DiaSemana, Record<TipoPlato, string>>
  /**
   * Per-slot `estado` (STORY-FRESCO-15) — lets a caller show/gate the
   * cocinado/descartado toggle without changing `menu`'s existing shape.
   * Additive, same pattern as `slotIds`: `/menu/page.tsx` ignores this field.
   */
  estados: Record<DiaSemana, Record<TipoPlato, EstadoRecetaSlot>>
  advertencias: string[]
  /** FR-5.5 (STORY-FRESCO-22) — Pro + real history only; `null` otherwise. */
  explicacionAprendizaje: string | null
}

export class MealPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MealPlanError';
  }
}

/** Return shape of `reshapeMenu()` — the recipe grid plus its parallel slot-id and estado grids. */
interface ReshapedMenu {
  menu: Record<DiaSemana, Record<TipoPlato, Recipe | null>>
  slotIds: Record<DiaSemana, Record<TipoPlato, string>>
  estados: Record<DiaSemana, Record<TipoPlato, EstadoRecetaSlot>>
}

/**
 * Reshapes the 21 `meal_plan_recipes` join rows into the
 * `Record<DiaSemana, Record<TipoPlato, Recipe>>` grid the pages expect —
 * the same shape `buildMockWeeklyMenu()` already produces, so page
 * components don't need to change beyond swapping the data source — plus
 * the parallel `slotIds` grid (STORY-FRESCO-11) addressing each slot's
 * `meal_plan_recipes.id`, built in the same single pass over `rows` rather
 * than iterating the 21 rows twice.
 *
 * `tipo_plato` on the DB enum also allows `'snack'`, which a persisted
 * weekly plan never contains (business rule: exactly 21 slots = 7 days x
 * desayuno/comida/cena) — narrowed to `TipoPlato` here rather than widening
 * the page-facing return type for a slot that can't occur.
 *
 * Validates all 21 ROWS are present before returning: `generate-meal-plan`'s
 * `index.ts` documents a known non-transactional-write gap (NFR-REL-2, no
 * native multi-table transaction across the `meal_plans` + `meal_plan_recipes`
 * inserts) that can leave a plan header with an incomplete set of children.
 * Every page consuming this grid indexes it unconditionally
 * (`plan.menu[dia][tipo]`) with no undefined guard, so a silent partial grid
 * would crash the page render instead of falling back to the pages' existing
 * "no plan yet" empty state — fail fast here instead, so callers' existing
 * catch blocks handle it. Presence is tracked by ROW, not by a truthy
 * `recipes` join: a row can legitimately carry `recipes: null` (FR-8.2 / AC
 * Scenario 4, FRESCO-23 — the model correctly reported no safe recipe for
 * that slot), which must reach the page as `menu[dia][tipo] === null`, not
 * be conflated with the row never having been written at all.
 */
function reshapeMenu(rows: MealPlanJoinRow['meal_plan_recipes']): ReshapedMenu {
  const menu = {} as Record<DiaSemana, Record<TipoPlato, Recipe | null>>;
  const slotIds = {} as Record<DiaSemana, Record<TipoPlato, string>>;
  const estados = {} as Record<DiaSemana, Record<TipoPlato, EstadoRecetaSlot>>;
  const seenSlots = new Set<string>();

  for (const row of rows) {
    seenSlots.add(`${row.dia}.${row.tipo_plato}`);
    menu[row.dia] ??= {} as Record<TipoPlato, Recipe | null>;
    menu[row.dia][row.tipo_plato as TipoPlato] = row.recipes ? toRecipe(row.recipes) : null;
    slotIds[row.dia] ??= {} as Record<TipoPlato, string>;
    slotIds[row.dia][row.tipo_plato as TipoPlato] = row.id;
    estados[row.dia] ??= {} as Record<TipoPlato, EstadoRecetaSlot>;
    estados[row.dia][row.tipo_plato as TipoPlato] = row.estado;
  }

  for (const dia of DIAS) {
    for (const tipo of TIPOS) {
      if (!seenSlots.has(`${dia}.${tipo}`)) {
        throw new MealPlanError(`El menú persistido está incompleto: falta el hueco ${dia}/${tipo}.`);
      }
    }
  }

  return { menu, slotIds, estados };
}

/**
 * Reads the CURRENTLY authenticated user's persisted weekly menu for
 * `semanaIso` (defaults to the current ISO week). Joins `meal_plans` to its
 * 21 `meal_plan_recipes` rows and their `recipes`, in one round trip via
 * PostgREST's embedded-resource select.
 *
 * Public method — fails fast (throws `MealPlanError`) on a real error (no
 * session, DB error, or a persisted plan missing a recipe it references),
 * per `references/error-handling.md` and the pattern established by
 * `lib/api/user-profile.ts` (FRESCO-5). Returns `null` — not a throw — when
 * no plan exists yet for `semanaIso`: a household that hasn't generated a
 * menu for the requested week is a normal, expected state (first-ever
 * visit, or a future week not yet requested), not a failure.
 *
 * `userId` is the same optional escape hatch as `getUserNombre`/
 * `getAvailableRecipesCount` — callers that already resolved
 * `auth.getUser()` (e.g. `/menu`) can skip the redundant round trip.
 */
export async function getMealPlanForWeek(
  client: SupabaseClient<Database>,
  semanaIso: string = getIsoWeek(),
  userId?: string,
): Promise<MenuSemanalPersistido | null> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new MealPlanError('No hay una sesión autenticada para leer el menú.');
    }

    resolvedUserId = user.id;
  }

  const { data, error } = await client
    .from('meal_plans')
    .select('id, semana_iso, advertencias, explicacion_aprendizaje, meal_plan_recipes(id, dia, tipo_plato, estado, recipes(*))')
    .eq('user_id', resolvedUserId)
    .eq('semana_iso', semanaIso)
    .maybeSingle();

  if (error) {
    throw new MealPlanError(`No se pudo leer el menú de la semana ${semanaIso}: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as MealPlanJoinRow;
  const { menu, slotIds, estados } = reshapeMenu(row.meal_plan_recipes);

  return {
    mealPlanId: row.id,
    semanaIso: row.semana_iso,
    menu,
    slotIds,
    estados,
    advertencias: row.advertencias,
    explicacionAprendizaje: row.explicacion_aprendizaje,
  };
}

/** One row in the "Histórico de menús" list (FRESCO-425). */
export interface PastMealPlanWeek {
  mealPlanId: string
  semanaIso: string
  /** `YYYY-MM-DD` Monday of the week — for date formatting and sorting. */
  mondayIso: string
  /** Count of the 21 slots marked `cocinada`. */
  cocinadas: number
  /** Count of the 21 slots marked `descartada`. */
  descartadas: number
}

/**
 * Lists the CURRENTLY authenticated user's meal plans for weeks BEFORE the
 * current ISO week, newest first (FRESCO-425 "Histórico de menús").
 *
 * The current week is excluded on purpose — it lives on `/calendar`, not in
 * the "anterior" history — and future weeks (a plan generated ahead of time)
 * are excluded too. The comparison is by real Monday date via
 * `getDateFromIsoWeek`, never a lexical compare on `semana_iso`: `'2026-W52'`
 * < `'2027-W01'` holds lexically only by luck, and breaks for any pair that
 * straddles a year boundary.
 *
 * The `cocinada` / `descartada` balance per week is counted here from the
 * embedded `meal_plan_recipes.estado` values rather than via a SQL aggregate
 * view — the row count is small (a handful of past weeks × 21 slots) and a
 * view would need its own migration + RLS policy for a read this cheap.
 *
 * Public method — fails fast (throws `MealPlanError`) on a real read error,
 * same convention as `getMealPlanForWeek()`. Returns `[]` (not a throw) when
 * the user has no past weeks: a household on its first week is a normal
 * state, not a failure.
 */
export async function listPastMealPlanWeeks(
  client: SupabaseClient<Database>,
  userId?: string,
): Promise<PastMealPlanWeek[]> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new MealPlanError('No hay una sesión autenticada para leer el histórico de menús.');
    }

    resolvedUserId = user.id;
  }

  const { data, error } = await client
    .from('meal_plans')
    .select('id, semana_iso, meal_plan_recipes(estado)')
    .eq('user_id', resolvedUserId);

  if (error) {
    throw new MealPlanError(`No se pudo leer el histórico de menús: ${error.message}`);
  }

  const currentMondayMs = new Date(`${getIsoWeekMonday()}T00:00:00.000Z`).getTime();

  return (data ?? [])
    .map((row) => {
      const mondayIso = getDateFromIsoWeek(row.semana_iso).toISOString().slice(0, 10);
      const slots = (row.meal_plan_recipes ?? []) as { estado: EstadoRecetaSlot }[];

      return {
        mealPlanId: row.id,
        semanaIso: row.semana_iso,
        mondayIso,
        cocinadas: slots.filter(slot => slot.estado === 'cocinada').length,
        descartadas: slots.filter(slot => slot.estado === 'descartada').length,
      };
    })
    .filter(week => new Date(`${week.mondayIso}T00:00:00.000Z`).getTime() < currentMondayMs)
    .sort((a, b) => b.mondayIso.localeCompare(a.mondayIso));
}

/**
 * Copies an owned past week's 21-slot menu onto the CURRENT ISO week
 * (FRESCO-427 "Usar este menú en la semana actual"), via the
 * `copy_meal_plan_to_week` RPC (`security definer`, see its migration) —
 * one atomic write: any existing current-week plan is replaced, all 21
 * slots land or none do. The caller is responsible for confirming the
 * replace with the user first when the current week already has a menu.
 *
 * `estado` is reset to `pendiente` for every copied slot — it is a fresh
 * menu to cook, and the source week's cooked/discarded history stays put.
 *
 * Public method — fails fast (throws `MealPlanError`) on any RPC error,
 * same convention as `swapMealPlanSlots()`.
 */
export async function copyMealPlanToCurrentWeek(
  client: SupabaseClient<Database>,
  sourceMealPlanId: string,
): Promise<void> {
  const { error } = await client.rpc('copy_meal_plan_to_week', {
    p_source_meal_plan_id: sourceMealPlanId,
    p_semana_iso: getIsoWeek(),
    p_fecha_inicio: getIsoWeekMonday(),
  });

  if (error) {
    throw new MealPlanError(`No se pudo copiar el menú a la semana actual: ${error.message}`);
  }
}

/**
 * Swaps two `meal_plan_recipes` slots' recipe assignments (STORY-FRESCO-11
 * drag-and-drop calendar reorder) via the `swap_meal_plan_slots` RPC
 * (`security definer`, see ADR-0002) — the single atomic write path for a
 * position swap, so a network drop can never leave one slot updated and the
 * other not.
 *
 * Public method — fails fast (throws `MealPlanError`) on any RPC error,
 * mirroring `getMealPlanForWeek()`'s own convention. Ownership/existence/
 * same-plan invariants are enforced inside the SQL function itself, not
 * re-checked here.
 */
export async function swapMealPlanSlots(
  client: SupabaseClient<Database>,
  slotAId: string,
  slotBId: string,
): Promise<void> {
  const { error } = await client.rpc('swap_meal_plan_slots', {
    p_slot_a_id: slotAId,
    p_slot_b_id: slotBId,
  });

  if (error) {
    throw new MealPlanError(`No se pudo intercambiar los huecos del menú: ${error.message}`);
  }
}

/**
 * Deletes the CURRENTLY authenticated user's own `meal_plans` row (FRESCO-62,
 * `/calendar` "eliminar el menú de la semana" control). `meal_plan_recipes`
 * cascades (`on delete cascade`, `20260725120100_create_fresco_core_tables.sql`)
 * — no separate cleanup needed. Scoped by `user_id` explicitly, on top of the
 * table's own `meal_plans_delete_own` RLS policy, matching the same
 * defense-in-depth pattern `getUserRecipes()` already uses.
 *
 * Public method — fails fast (throws `MealPlanError`), same convention as
 * every other write in this file.
 */
export async function deleteMealPlan(
  client: SupabaseClient<Database>,
  mealPlanId: string,
): Promise<void> {
  const { data: { user }, error: userError } = await client.auth.getUser();

  if (userError || !user) {
    throw new MealPlanError('No hay una sesión autenticada para eliminar el menú.');
  }

  const { error } = await client
    .from('meal_plans')
    .delete()
    .eq('id', mealPlanId)
    .eq('user_id', user.id);

  if (error) {
    throw new MealPlanError(`No se pudo eliminar el menú: ${error.message}`);
  }
}
