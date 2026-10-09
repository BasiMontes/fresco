import type { SupabaseClient } from '@supabase/supabase-js';
import type { DiaSemana, EstadoRecetaSlot, TipoPlato } from '@/lib/api/types';
import type { Database } from '@/lib/supabase/types';
import { MealPlanError } from '@/lib/api/meal-plan';
import { getIsoWeek } from '@/lib/date/iso-week';
import { hoyEnMadrid, sumarDias } from '@/lib/date/madrid-date';

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

/** A slot of the current week's menu a recipe could be put into (FRESCO-878). */
export interface OpenSlot {
  slotId: string
  dia: DiaSemana
  /** `YYYY-MM-DD` of that day. */
  fecha: string
  tipoPlato: TipoPlato
  /** Name of the recipe the slot holds today, `null` for an empty slot. */
  recetaActual: string | null
}

export interface OpenSlotsResult {
  slots: OpenSlot[]
  /** Whether a shopping list was already generated from this plan: it will not reflect a change. */
  tieneListaCompra: boolean
}

interface OpenSlotsRow {
  id: string
  fecha_inicio: string
  meal_plan_recipes: {
    id: string
    dia: DiaSemana
    tipo_plato: TipoPlato
    estado: EstadoRecetaSlot
    recipes: { nombre: string } | null
  }[]
}

/**
 * The slots of the CURRENTLY authenticated user's current-week menu a recipe of
 * `tipoPlato` could be put into (FRESCO-878): open (`pendiente` / `sustituida`),
 * of the same meal type, today or later in Madrid. `assign_recipe_to_slot`
 * enforces the same rules in the database; this read only decides what the
 * modal offers. Returns no slots (not a throw) when there is no menu this week.
 *
 * Public method — fails fast (throws `MealPlanError`) on a real read error.
 */
export async function listOpenSlots(
  client: SupabaseClient<Database>,
  { tipoPlato, hoy = hoyEnMadrid() }: { tipoPlato: TipoPlato, hoy?: string },
): Promise<OpenSlotsResult> {
  const { data: { user }, error: userError } = await client.auth.getUser();

  if (userError || !user) {
    throw new MealPlanError('No hay una sesión autenticada para leer el menú.');
  }

  const { data, error } = await client
    .from('meal_plans')
    .select('id, fecha_inicio, meal_plan_recipes(id, dia, tipo_plato, estado, recipes(nombre))')
    .eq('user_id', user.id)
    .eq('semana_iso', getIsoWeek())
    .maybeSingle()
    .overrideTypes<OpenSlotsRow | null>();

  if (error) {
    throw new MealPlanError(`No se pudo leer el menú de la semana: ${error.message}`);
  }

  if (!data) {
    return { slots: [], tieneListaCompra: false };
  }

  const slots = data.meal_plan_recipes
    .filter(slot => slot.tipo_plato === tipoPlato && (slot.estado === 'pendiente' || slot.estado === 'sustituida'))
    .map(slot => ({
      slotId: slot.id,
      dia: slot.dia,
      fecha: sumarDias(data.fecha_inicio, DIAS.indexOf(slot.dia)),
      tipoPlato,
      recetaActual: slot.recipes?.nombre ?? null,
    }))
    .filter(slot => slot.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const { data: lista, error: listaError } = await client
    .from('shopping_lists')
    .select('id')
    .eq('meal_plan_id', data.id)
    .maybeSingle();

  if (listaError) {
    throw new MealPlanError(`No se pudo comprobar la lista de la compra: ${listaError.message}`);
  }

  return { slots, tieneListaCompra: lista !== null };
}
