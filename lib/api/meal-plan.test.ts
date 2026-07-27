import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { getMealPlanForWeek, MealPlanError } from './meal-plan';

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

const SAMPLE_JOIN_ROW = {
  semana_iso: SEMANA_ISO,
  advertencias: ['El menú supera tu presupuesto semanal en aproximadamente 5€'],
  meal_plan_recipes: [
    { dia: 'lunes', tipo_plato: 'desayuno', recipes: SAMPLE_RECIPE_ROW },
    { dia: 'lunes', tipo_plato: 'comida', recipes: { ...SAMPLE_RECIPE_ROW, id: 'recipe-2', nombre: 'Curry de garbanzos' } },
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
});
