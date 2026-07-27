import type { Recipe } from '@schemas';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DiaSemana, TipoPlato } from '@/lib/api/types';
import type { Database } from '@/lib/supabase/types';
import { getIsoWeek } from '@/lib/date/iso-week';

/** Raw `public.recipes` row shape — jsonb columns typed as `Json`, per `lib/supabase/types.ts`. */
type RecipeRow = Database['public']['Tables']['recipes']['Row'];

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const TIPOS: TipoPlato[] = ['desayuno', 'comida', 'cena'];

/** One `meal_plans` row joined to its 21 `meal_plan_recipes` rows and their `recipes`. */
interface MealPlanJoinRow {
  semana_iso: string
  advertencias: string[]
  meal_plan_recipes: {
    dia: DiaSemana
    tipo_plato: Database['public']['Enums']['tipo_plato']
    recipes: RecipeRow | null
  }[]
}

export interface MenuSemanalPersistido {
  semanaIso: string
  menu: Record<DiaSemana, Record<TipoPlato, Recipe>>
  advertencias: string[]
}

export class MealPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MealPlanError';
  }
}

/**
 * Reshapes a raw `recipes` row (jsonb columns typed as `Json`) into the
 * strongly-typed `@schemas` `Recipe` shape. A cast, not a runtime validation
 * — mirrors the same trust boundary `generate-meal-plan/index.ts` already
 * takes on the backend (`.returns<Recipe[]>()` on the same table).
 */
function toRecipe(row: RecipeRow): Recipe {
  return {
    ...row,
    meta: row.meta as unknown as Recipe['meta'],
    clasificacion: row.clasificacion as unknown as Recipe['clasificacion'],
    dieta: row.dieta as unknown as Recipe['dieta'],
    alergenos: row.alergenos as unknown as Recipe['alergenos'],
    ingredientes_principales: row.ingredientes_principales as unknown as Recipe['ingredientes_principales'],
    ingredientes_que_puede_desagradar: row.ingredientes_que_puede_desagradar as unknown as Recipe['ingredientes_que_puede_desagradar'],
    temporada: row.temporada as unknown as Recipe['temporada'],
    pasos_resumen: row.pasos_resumen as unknown as Recipe['pasos_resumen'],
  };
}

/**
 * Reshapes the 21 `meal_plan_recipes` join rows into the
 * `Record<DiaSemana, Record<TipoPlato, Recipe>>` grid the pages expect —
 * the same shape `buildMockWeeklyMenu()` already produces, so page
 * components don't need to change beyond swapping the data source.
 *
 * `tipo_plato` on the DB enum also allows `'snack'`, which a persisted
 * weekly plan never contains (business rule: exactly 21 slots = 7 days x
 * desayuno/comida/cena) — narrowed to `TipoPlato` here rather than widening
 * the page-facing return type for a slot that can't occur.
 *
 * Validates all 21 slots are present before returning: `generate-meal-plan`'s
 * `index.ts` documents a known non-transactional-write gap (NFR-REL-2, no
 * native multi-table transaction across the `meal_plans` + `meal_plan_recipes`
 * inserts) that can leave a plan header with an incomplete set of children.
 * Every page consuming this grid indexes it unconditionally
 * (`plan.menu[dia][tipo]`) with no undefined guard, so a silent partial grid
 * would crash the page render instead of falling back to the pages' existing
 * "no plan yet" empty state — fail fast here instead, exactly like the
 * missing-recipe check below, so callers' existing catch blocks handle it.
 */
function reshapeMenu(rows: MealPlanJoinRow['meal_plan_recipes']): Record<DiaSemana, Record<TipoPlato, Recipe>> {
  const menu = {} as Record<DiaSemana, Record<TipoPlato, Recipe>>;

  for (const row of rows) {
    if (!row.recipes) {
      throw new MealPlanError(`Falta la receta para el hueco ${row.dia}/${row.tipo_plato} del menú.`);
    }
    menu[row.dia] ??= {} as Record<TipoPlato, Recipe>;
    menu[row.dia][row.tipo_plato as TipoPlato] = toRecipe(row.recipes);
  }

  for (const dia of DIAS) {
    for (const tipo of TIPOS) {
      if (!menu[dia]?.[tipo]) {
        throw new MealPlanError(`El menú persistido está incompleto: falta el hueco ${dia}/${tipo}.`);
      }
    }
  }

  return menu;
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
 */
export async function getMealPlanForWeek(
  client: SupabaseClient<Database>,
  semanaIso: string = getIsoWeek(),
): Promise<MenuSemanalPersistido | null> {
  const { data: { user }, error: userError } = await client.auth.getUser();

  if (userError || !user) {
    throw new MealPlanError('No hay una sesión autenticada para leer el menú.');
  }

  const { data, error } = await client
    .from('meal_plans')
    .select('semana_iso, advertencias, meal_plan_recipes(dia, tipo_plato, recipes(*))')
    .eq('user_id', user.id)
    .eq('semana_iso', semanaIso)
    .maybeSingle();

  if (error) {
    throw new MealPlanError(`No se pudo leer el menú de la semana ${semanaIso}: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as MealPlanJoinRow;

  return {
    semanaIso: row.semana_iso,
    menu: reshapeMenu(row.meal_plan_recipes),
    advertencias: row.advertencias,
  };
}
