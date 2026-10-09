import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { mockAuthGetUser } from '@/lib/fixtures/mock-supabase-auth';
import { MealPlanError } from './meal-plan';
import { listOpenSlots } from './open-slots';

async function expectRejection(promise: Promise<unknown>): Promise<void> {
  let thrownError: unknown;
  try {
    await promise;
  }
  catch (error) {
    thrownError = error;
  }
  expect(thrownError).toBeInstanceOf(MealPlanError);
}

describe('listOpenSlots (FRESCO-878)', () => {
  // 2026-10-05 is a Monday; "today" is the Wednesday of that week.
  const PLAN_ROW = {
    id: 'plan-1',
    fecha_inicio: '2026-10-05',
    meal_plan_recipes: [
      { id: 's-lunes', dia: 'lunes', tipo_plato: 'comida', estado: 'pendiente', recipes: { nombre: 'Lentejas' } },
      { id: 's-miercoles', dia: 'miercoles', tipo_plato: 'comida', estado: 'pendiente', recipes: { nombre: 'Paella' } },
      { id: 's-jueves', dia: 'jueves', tipo_plato: 'comida', estado: 'cocinada', recipes: { nombre: 'Cocido' } },
      { id: 's-viernes', dia: 'viernes', tipo_plato: 'comida', estado: 'sustituida', recipes: null },
      { id: 's-viernes-cena', dia: 'viernes', tipo_plato: 'cena', estado: 'pendiente', recipes: { nombre: 'Tortilla' } },
      { id: 's-sabado', dia: 'sabado', tipo_plato: 'comida', estado: 'excluida', recipes: null },
    ],
  };

  /** One result per table, so the plan read and the shopping-list read can differ. */
  function createSlotsClient({ plan, lista, userId = 'user-1' }: { plan: unknown, lista: unknown, userId?: string }) {
    const resultFor = (table: string) => ({ data: table === 'meal_plans' ? plan : lista, error: null });
    const chain = (table: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq']) {
        builder[method] = () => builder;
      }
      builder.maybeSingle = () => ({ overrideTypes: async () => Promise.resolve(resultFor(table)), then: (resolve: (value: unknown) => unknown) => resolve(resultFor(table)) });
      return builder;
    };
    return { auth: mockAuthGetUser(userId), from: (table: string) => chain(table) } as unknown as SupabaseClient<Database>;
  }

  test('offers open slots of the same meal type from today on, soonest first, and names what they hold today', async () => {
    const client = createSlotsClient({ plan: PLAN_ROW, lista: null });

    const result = await listOpenSlots(client, { tipoPlato: 'comida', hoy: '2026-10-07' });

    expect(result.slots).toEqual([
      { slotId: 's-miercoles', dia: 'miercoles', fecha: '2026-10-07', tipoPlato: 'comida', recetaActual: 'Paella' },
      { slotId: 's-viernes', dia: 'viernes', fecha: '2026-10-09', tipoPlato: 'comida', recetaActual: null },
    ]);
  });

  test('never offers a past day, a cooked / discarded / excluded slot or another meal type', async () => {
    const client = createSlotsClient({ plan: PLAN_ROW, lista: null });

    const ids = (await listOpenSlots(client, { tipoPlato: 'comida', hoy: '2026-10-07' })).slots.map(slot => slot.slotId);

    expect(ids).not.toContain('s-lunes');
    expect(ids).not.toContain('s-jueves');
    expect(ids).not.toContain('s-sabado');
    expect(ids).not.toContain('s-viernes-cena');
  });

  test('reports whether a shopping list already exists for the plan', async () => {
    const con = await listOpenSlots(createSlotsClient({ plan: PLAN_ROW, lista: { id: 'list-1' } }), { tipoPlato: 'comida', hoy: '2026-10-07' });
    const sin = await listOpenSlots(createSlotsClient({ plan: PLAN_ROW, lista: null }), { tipoPlato: 'comida', hoy: '2026-10-07' });

    expect(con.tieneListaCompra).toBe(true);
    expect(sin.tieneListaCompra).toBe(false);
  });

  test('returns no slots when there is no menu this week', async () => {
    const result = await listOpenSlots(createSlotsClient({ plan: null, lista: null }), { tipoPlato: 'comida', hoy: '2026-10-07' });

    expect(result).toEqual({ slots: [], tieneListaCompra: false });
  });

  test('throws MealPlanError without a session', async () => {
    const client = { auth: mockAuthGetUser(undefined) } as unknown as SupabaseClient<Database>;

    await expectRejection(listOpenSlots(client, { tipoPlato: 'comida' }));
  });
});
