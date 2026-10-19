import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenerateShoppingListResponse } from '@/lib/api/types';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { createMockClient } from '@/lib/fixtures/mock-supabase-client';
import { diffNombresNuevos, getShoppingListForPlan, listaDesactualizadaDeSlot, normalizeNombre, removeShoppingListItem, ShoppingListError, toggleShoppingListItem } from './shopping-list';

const MEAL_PLAN_ID = 'plan-1';

const SAMPLE_PASILLOS: GenerateShoppingListResponse['pasillos'] = [
  {
    nombre: 'Frutas y verduras',
    orden: 1,
    items: [
      { nombre: 'Tomate', cantidad: 6, unidad: 'ud', comprado: false },
      { nombre: 'Cebolla', cantidad: 2, unidad: 'ud', comprado: true },
    ],
  },
  {
    nombre: 'Legumbres',
    orden: 2,
    items: [
      { nombre: 'Lentejas', cantidad: 500, unidad: 'g', comprado: false },
    ],
  },
];

const SAMPLE_LIST_ROW = {
  id: 'list-1',
  meal_plan_id: MEAL_PLAN_ID,
  desactualizada_desde: null as string | null,
  items: SAMPLE_PASILLOS,
  coste_estimado_min: 12.5,
  coste_estimado_max: 18.9,
};

/** Minimal mock client exposing only `.rpc()` — all `toggleShoppingListItem()` calls. */
function createRpcMockClient(options: { errorMessage?: string } = {}) {
  const rpcCalls: unknown[] = [];
  const rpc = async (_fn: string, args: Record<string, unknown>) => {
    rpcCalls.push(args);
    return { data: null, error: options.errorMessage ? { message: options.errorMessage } : null };
  };

  return {
    client: { rpc } as unknown as SupabaseClient<Database>,
    rpcCalls,
  };
}

/**
 * bun-types' `.rejects.toThrow()` is typed as returning `void` (not a
 * `Promise`), so `await expect(promise).rejects.toThrow(...)` trips this
 * repo's `ts/await-thenable` lint rule. A plain try/catch avoids the false
 * positive without weakening the assertion — mirrors `meal-plan.test.ts` /
 * `user-profile.test.ts`.
 */
async function expectRejection(promise: Promise<unknown>): Promise<void> {
  let thrownError: unknown;
  try {
    await promise;
  }
  catch (error) {
    thrownError = error;
  }
  expect(thrownError).toBeInstanceOf(ShoppingListError);
}

describe('getShoppingListForPlan', () => {
  test('reshapes a persisted list row into pasillos + a recomputed resumen', async () => {
    const { client } = createMockClient({ data: SAMPLE_LIST_ROW });

    const result = await getShoppingListForPlan(client, MEAL_PLAN_ID);

    expect(result).not.toBeNull();
    expect(result?.id).toBe('list-1');
    expect(result?.pasillos).toEqual(SAMPLE_PASILLOS);

    // total_items is recomputed from items, never trusted from storage.
    expect(result?.resumen.total_items).toBe(3);
    expect(result?.resumen.coste_estimado_min).toBe(12.5);
    expect(result?.resumen.coste_estimado_max).toBe(18.9);
    expect(result?.resumen.moneda).toBe('EUR');
  });

  // FRESCO-1010 — the list says whether the plan changed after it was built, and which plan it belongs to.
  test('exposes the plan id and a fresh list as not stale', async () => {
    const { client } = createMockClient({ data: SAMPLE_LIST_ROW });

    const result = await getShoppingListForPlan(client, MEAL_PLAN_ID);

    expect(result?.mealPlanId).toBe(MEAL_PLAN_ID);
    expect(result?.desactualizada).toBe(false);
  });

  test('a list flagged by the database is stale', async () => {
    const { client } = createMockClient({ data: { ...SAMPLE_LIST_ROW, desactualizada_desde: '2026-10-19T10:00:00Z' } });

    expect((await getShoppingListForPlan(client, MEAL_PLAN_ID))?.desactualizada).toBe(true);
  });

  test('returns null when no list has been generated yet for that plan', async () => {
    const { client } = createMockClient({ data: null });

    const result = await getShoppingListForPlan(client, MEAL_PLAN_ID);

    expect(result).toBeNull();
  });

  test('throws ShoppingListError on a real database error', async () => {
    const { client } = createMockClient({ errorMessage: 'connection reset' });

    await expectRejection(getShoppingListForPlan(client, MEAL_PLAN_ID));
  });

  // FRESCO-948 — the `origen` mark is what puts an item in the "Sugerencias para
  // ti" section. The read schema is a non-strict zod object, so a key it does not
  // list is silently stripped: without `origen` there, a reload would drop the
  // mark and the item would fall back into its aisle.
  test('keeps the origen mark of an item added from a suggestion', async () => {
    const pasillos: GenerateShoppingListResponse['pasillos'] = [
      {
        nombre: 'Especias',
        orden: 1,
        items: [{ nombre: 'Jengibre', cantidad: 1, unidad: 'ud', comprado: false, origen: 'sugerencia' }],
      },
    ];
    const { client } = createMockClient({ data: { ...SAMPLE_LIST_ROW, items: pasillos } });

    const result = await getShoppingListForPlan(client, MEAL_PLAN_ID);

    expect(result?.pasillos[0].items[0].origen).toBe('sugerencia');
  });

  test('rejects an origen value other than "sugerencia"', async () => {
    const pasillos = [{ nombre: 'Especias', orden: 1, items: [{ nombre: 'Jengibre', cantidad: 1, unidad: 'ud', comprado: false, origen: 'otra' }] }];
    const { client } = createMockClient({ data: { ...SAMPLE_LIST_ROW, items: pasillos } });

    await expectRejection(getShoppingListForPlan(client, MEAL_PLAN_ID));
  });

  test('recomputes total_items as 0 for an empty pasillos array', async () => {
    const { client } = createMockClient({ data: { ...SAMPLE_LIST_ROW, items: [] } });

    const result = await getShoppingListForPlan(client, MEAL_PLAN_ID);

    expect(result?.pasillos).toEqual([]);
    expect(result?.resumen.total_items).toBe(0);
  });
});

describe('normalizeNombre', () => {
  test('lowercases, trims, collapses whitespace and strips accents', () => {
    expect(normalizeNombre('  Tomate   Frito ')).toBe('tomate frito');
    expect(normalizeNombre('JAMÓN')).toBe('jamon');
    expect(normalizeNombre('Piña')).toBe('pina');
    expect(normalizeNombre('Aceite de OliVÁ')).toBe('aceite de oliva');
  });
});

describe('diffNombresNuevos', () => {
  const semana = (nombres: string[]): GenerateShoppingListResponse['pasillos'] => [
    {
      nombre: 'Varios',
      orden: 1,
      items: nombres.map(nombre => ({ nombre, cantidad: 1, unidad: 'ud', comprado: false })),
    },
  ];

  test('flags items on the current list that were not on the prior list', () => {
    const nuevos = diffNombresNuevos(semana(['Tomate', 'Lentejas', 'Pan']), semana(['Tomate', 'Arroz']));

    expect([...nuevos].sort()).toEqual(['lentejas', 'pan']);
  });

  test('does not flag an item present on both weeks, ignoring case and accents', () => {
    const nuevos = diffNombresNuevos(semana(['Jamón', 'Piña']), semana(['jamon', '  PIÑA ']));

    expect(nuevos.size).toBe(0);
  });

  test('returns an empty set when there is no prior list (never flags everything)', () => {
    const nuevos = diffNombresNuevos(semana(['Tomate', 'Pan']), []);

    expect(nuevos.size).toBe(0);
  });

  test('dedupes a name that appears in more than one aisle of the current list', () => {
    const actuales: GenerateShoppingListResponse['pasillos'] = [
      { nombre: 'A', orden: 1, items: [{ nombre: 'Sal', cantidad: 1, unidad: 'ud', comprado: false }] },
      { nombre: 'B', orden: 2, items: [{ nombre: 'sal', cantidad: 1, unidad: 'ud', comprado: false }] },
    ];

    const nuevos = diffNombresNuevos(actuales, semana(['Azúcar']));

    expect([...nuevos]).toEqual(['sal']);
  });
});

describe('toggleShoppingListItem', () => {
  test('resolves without throwing and forwards the correct RPC params when the call succeeds', async () => {
    const { client, rpcCalls } = createRpcMockClient();

    const result = await toggleShoppingListItem(client, { listId: 'list-1', pasilloIdx: 0, itemIdx: 1, comprado: true });

    expect(result).toBeUndefined();
    expect(rpcCalls).toEqual([{
      p_list_id: 'list-1',
      p_pasillo_idx: 0,
      p_item_idx: 1,
      p_comprado: true,
    }]);
  });

  test('throws ShoppingListError with the underlying message when the RPC fails', async () => {
    const { client } = createRpcMockClient({ errorMessage: 'row not found' });

    await expectRejection(toggleShoppingListItem(client, { listId: 'list-1', pasilloIdx: 0, itemIdx: 1, comprado: true }));
  });
});

describe('removeShoppingListItem', () => {
  test('resolves without throwing and forwards the pasillo and item names to the RPC', async () => {
    const { client, rpcCalls } = createRpcMockClient();

    const result = await removeShoppingListItem(client, { listId: 'list-1', pasilloNombre: 'Especias', itemNombre: 'Jengibre' });

    expect(result).toBeUndefined();
    expect(rpcCalls).toEqual([{
      p_list_id: 'list-1',
      p_pasillo_nombre: 'Especias',
      p_item_nombre: 'Jengibre',
    }]);
  });

  test('throws ShoppingListError when the RPC fails', async () => {
    const { client } = createRpcMockClient({ errorMessage: 'list not found or not owned by caller' });

    await expectRejection(removeShoppingListItem(client, { listId: 'list-1', pasilloNombre: 'Especias', itemNombre: 'Jengibre' }));
  });
});

describe('listaDesactualizadaDeSlot (FRESCO-1010)', () => {
  test('true when the slot\'s plan has a list the database flagged as stale', async () => {
    const { client } = createMockClient({ data: { meal_plan_id: MEAL_PLAN_ID, desactualizada_desde: '2026-10-19T10:00:00Z' } });

    expect(await listaDesactualizadaDeSlot(client, 'slot-1')).toBe(true);
  });

  test('false for a list that matches its plan', async () => {
    const { client } = createMockClient({ data: { meal_plan_id: MEAL_PLAN_ID, desactualizada_desde: null } });

    expect(await listaDesactualizadaDeSlot(client, 'slot-1')).toBe(false);
  });

  test('false when the slot or the list is not there', async () => {
    const { client } = createMockClient({ data: null });

    expect(await listaDesactualizadaDeSlot(client, 'slot-1')).toBe(false);
  });

  test('false on a database error: the notice is a courtesy and never breaks the flow that asked', async () => {
    const { client } = createMockClient({ errorMessage: 'connection reset' });

    expect(await listaDesactualizadaDeSlot(client, 'slot-1')).toBe(false);
  });

  test('false when the client itself throws', async () => {
    const client = { from: () => { throw new Error('boom'); } } as unknown as SupabaseClient<Database>;

    expect(await listaDesactualizadaDeSlot(client, 'slot-1')).toBe(false);
  });
});
