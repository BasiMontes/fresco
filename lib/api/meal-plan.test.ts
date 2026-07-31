import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { getMealPlanForWeek, MealPlanError, swapMealPlanSlots } from './meal-plan';

const SEMANA_ISO = '2026-W30';

const SAMPLE_RECIPE_ROW = {
  id: 'recipe-1',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
  nombre: 'Lentejas estofadas',
  slug: 'lentejas-estofadas',
  descripcion_corta: 'Un clásico de cuchara.',
  meta: { tiempo_prep_min: 15, tiempo_coccion_min: 30, tiempo_total_min: 45, raciones: 4, coste_estimado: 'bajo', dificultad: 'facil' },
  clasificacion: { tipo_plato: 'comida', categoria: 'legumbres', cocina: 'española', es_contundente: true, es_ligero: false, es_comfort_food: true, apto_tupper: true, apto_congelar: true },
  dieta: { vegetariano: true, vegano: false, sin_gluten: true, sin_lactosa: false, sin_huevo: false, bajo_fodmap: false, keto: false, paleo: false, halal: true, kosher: false },
  alergenos: [],
  ingredientes_principales: ['lentejas'],
  ingredientes_que_puede_desagradar: [],
  temporada: ['otoño'],
  pasos_resumen: ['Cocer'],
  veces_cocinada: 3,
  veces_descartada: 0,
  rating_promedio: 4.6,
  ultima_vez_en_menu: '2026-07-14',
};

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const TIPOS = ['desayuno', 'comida', 'cena'] as const;

/** Builds all 21 (7x7) join rows a real persisted plan always has. */
function buildCompleteJoinRows() {
  return DIAS.flatMap(dia =>
    TIPOS.map(tipo_plato => ({
      id: `slot-${dia}-${tipo_plato}`,
      dia,
      tipo_plato,
      // lunes/desayuno set to 'cocinada' (not the default) to exercise
      // estados' pass-through of a real, non-pendiente value (STORY-FRESCO-15).
      estado: dia === 'lunes' && tipo_plato === 'desayuno' ? 'cocinada' as const : 'pendiente' as const,
      recipes: dia === 'lunes' && tipo_plato === 'desayuno'
        ? SAMPLE_RECIPE_ROW
        : dia === 'lunes' && tipo_plato === 'comida'
          ? { ...SAMPLE_RECIPE_ROW, id: 'recipe-2', nombre: 'Curry de garbanzos' }
          : { ...SAMPLE_RECIPE_ROW, id: `recipe-${dia}-${tipo_plato}` },
    })),
  );
}

const SAMPLE_JOIN_ROW = {
  semana_iso: SEMANA_ISO,
  advertencias: ['El menú supera tu presupuesto semanal en aproximadamente 5€'],
  meal_plan_recipes: buildCompleteJoinRows(),
};

/** Truncated fixture — only 2 of 21 slots — for the incomplete-plan gap test. */
const INCOMPLETE_JOIN_ROW = {
  semana_iso: SEMANA_ISO,
  advertencias: [],
  meal_plan_recipes: [
    { id: 'slot-lunes-desayuno', dia: 'lunes', tipo_plato: 'desayuno', estado: 'pendiente', recipes: SAMPLE_RECIPE_ROW },
    { id: 'slot-lunes-comida', dia: 'lunes', tipo_plato: 'comida', estado: 'pendiente', recipes: { ...SAMPLE_RECIPE_ROW, id: 'recipe-2', nombre: 'Curry de garbanzos' } },
  ],
};

function createMockClient(options: {
  userId?: string
  planRow?: unknown | null
  dbErrorMessage?: string
} = {}) {
  const mock = {
    auth: {
      getUser: async () => (
        options.userId
          ? { data: { user: { id: options.userId } }, error: null }
          : { data: { user: null }, error: null }
      ),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: options.dbErrorMessage ? null : (options.planRow ?? null),
              error: options.dbErrorMessage ? { message: options.dbErrorMessage } : null,
            }),
          }),
        }),
      }),
    }),
  };

  return { client: mock as unknown as SupabaseClient<Database> };
}

/**
 * bun-types' `.rejects.toThrow()` is typed as returning `void` (not a
 * `Promise`), so `await expect(promise).rejects.toThrow(...)` trips this
 * repo's `ts/await-thenable` lint rule. A plain try/catch avoids the false
 * positive without weakening the assertion — mirrors `user-profile.test.ts`.
 */
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

describe('getMealPlanForWeek', () => {
  test('reshapes a persisted plan into the DiaSemana/TipoPlato menu grid', async () => {
    const { client } = createMockClient({ userId: 'user-123', planRow: SAMPLE_JOIN_ROW });

    const result = await getMealPlanForWeek(client, SEMANA_ISO);

    expect(result).not.toBeNull();
    expect(result?.semanaIso).toBe(SEMANA_ISO);
    expect(result?.advertencias).toEqual(SAMPLE_JOIN_ROW.advertencias);
    expect(result?.menu.lunes.desayuno.nombre).toBe('Lentejas estofadas');
    expect(result?.menu.lunes.comida.nombre).toBe('Curry de garbanzos');
    expect(result?.menu.lunes.desayuno.meta?.coste_estimado).toBe('bajo');

    // STORY-FRESCO-11: slotIds populated in parallel with menu, one id per slot.
    expect(result?.slotIds.lunes.desayuno).toBe('slot-lunes-desayuno');
    expect(result?.slotIds.lunes.comida).toBe('slot-lunes-comida');
    expect(result?.slotIds.domingo.cena).toBe('slot-domingo-cena');
    for (const dia of DIAS) {
      for (const tipo of TIPOS) {
        expect(result?.slotIds[dia]?.[tipo]).toBe(`slot-${dia}-${tipo}`);
      }
    }

    // STORY-FRESCO-15: estados populated in parallel with menu/slotIds —
    // real value (lunes/desayuno) and the default pass through correctly.
    expect(result?.estados.lunes.desayuno).toBe('cocinada');
    expect(result?.estados.lunes.comida).toBe('pendiente');
    expect(result?.estados.domingo.cena).toBe('pendiente');
  });

  test('returns null when no plan exists yet for that week', async () => {
    const { client } = createMockClient({ userId: 'user-123', planRow: null });

    const result = await getMealPlanForWeek(client, SEMANA_ISO);

    expect(result).toBeNull();
  });

  test('throws MealPlanError on a real database error', async () => {
    const { client } = createMockClient({ userId: 'user-123', dbErrorMessage: 'connection reset' });

    await expectRejection(getMealPlanForWeek(client, SEMANA_ISO));
  });

  test('throws MealPlanError when there is no authenticated session', async () => {
    const { client } = createMockClient({});

    await expectRejection(getMealPlanForWeek(client, SEMANA_ISO));
  });

  test('throws MealPlanError when the persisted plan is missing slots (NFR-REL-2 partial-write gap)', async () => {
    const { client } = createMockClient({ userId: 'user-123', planRow: INCOMPLETE_JOIN_ROW });

    await expectRejection(getMealPlanForWeek(client, SEMANA_ISO));
  });
});

/** Minimal mock client exposing only `.rpc()` — all `swapMealPlanSlots()` calls. */
function createRpcMockClient(options: { errorMessage?: string } = {}) {
  const rpc = async (_fn: string, _args: Record<string, unknown>) => ({
    data: null,
    error: options.errorMessage ? { message: options.errorMessage } : null,
  });

  return {
    client: { rpc } as unknown as SupabaseClient<Database>,
    rpc,
  };
}

describe('swapMealPlanSlots', () => {
  test('resolves without throwing when the RPC succeeds', async () => {
    const { client } = createRpcMockClient();

    const result = await swapMealPlanSlots(client, 'slot-a-id', 'slot-b-id');

    expect(result).toBeUndefined();
  });

  test('throws MealPlanError with the underlying message when the RPC fails', async () => {
    const { client } = createRpcMockClient({ errorMessage: 'foreign key violation' });

    await expectRejection(swapMealPlanSlots(client, 'slot-a-id', 'slot-b-id'));
  });
});
