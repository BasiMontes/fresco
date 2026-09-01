import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenerateShoppingListResponse } from '@/lib/api/types';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { diffNombresNuevos, getShoppingListForPlan, normalizeNombre, ShoppingListError, toggleShoppingListItem } from './shopping-list';

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
  items: SAMPLE_PASILLOS,
  coste_estimado_min: 12.5,
  coste_estimado_max: 18.9,
};

/** Minimal mock client exposing `.select().eq().maybeSingle()` — all `getShoppingListForPlan()` calls. */
function createMockClient(options: { listRow?: unknown | null, dbErrorMessage?: string } = {}) {
  const mock = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: options.dbErrorMessage ? null : (options.listRow ?? null),
            error: options.dbErrorMessage ? { message: options.dbErrorMessage } : null,
          }),
        }),
      }),
    }),
  };

  return { client: mock as unknown as SupabaseClient<Database> };
}

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
    const { client } = createMockClient({ listRow: SAMPLE_LIST_ROW });

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

  test('returns null when no list has been generated yet for that plan', async () => {
    const { client } = createMockClient({ listRow: null });

    const result = await getShoppingListForPlan(client, MEAL_PLAN_ID);

    expect(result).toBeNull();
  });

  test('throws ShoppingListError on a real database error', async () => {
    const { client } = createMockClient({ dbErrorMessage: 'connection reset' });

    await expectRejection(getShoppingListForPlan(client, MEAL_PLAN_ID));
  });

  test('recomputes total_items as 0 for an empty pasillos array', async () => {
    const { client } = createMockClient({ listRow: { ...SAMPLE_LIST_ROW, items: [] } });

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

    const result = await toggleShoppingListItem(client, 'list-1', 0, 1, true);

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

    await expectRejection(toggleShoppingListItem(client, 'list-1', 0, 1, true));
  });
});
