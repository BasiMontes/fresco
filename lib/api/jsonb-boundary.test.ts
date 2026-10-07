import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecipeRow } from './recipes';
import type { Database } from '@/lib/supabase/types';
import { readFileSync } from 'node:fs';
import { Glob } from 'bun';
import { describe, expect, spyOn, test } from 'bun:test';
import { toRecipe, toRecipes } from './recipes';
import { getShoppingListForPlan, ShoppingListError } from './shopping-list';

const VALID_ROW: RecipeRow = {
  activo: true,
  veces_calificada: 0,
  id: 'recipe-1',
  nombre: 'Risotto de setas',
  slug: 'risotto-de-setas',
  descripcion_corta: null,
  foto_url: null,
  meta: {
    tiempo_prep_min: 10,
    tiempo_coccion_min: 25,
    tiempo_total_min: 35,
    raciones: 2,
    coste_estimado: 'medio',
    dificultad: 'facil',
  },
  clasificacion: null,
  dieta: null,
  alergenos: ['lacteos'],
  ingredientes_principales: ['arroz', 'setas'],
  ingredientes_que_puede_desagradar: null,
  temporada: ['otono', 'todo_el_ano'],
  pasos_resumen: null,
  rating_promedio: null,
  veces_cocinada: 0,
  veces_descartada: 0,
  ultima_vez_en_menu: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

describe('toRecipe (jsonb boundary)', () => {
  test('keeps a row whose jsonb columns match the domain shape', () => {
    expect(toRecipe(VALID_ROW)?.meta?.coste_estimado).toBe('medio');
  });

  test('keeps live clasificacion values the old unions never listed (bowls, casera)', () => {
    const live: RecipeRow = {
      ...VALID_ROW,
      clasificacion: {
        tipo_plato: 'comida',
        categoria: 'bowls',
        cocina: 'casera',
        es_contundente: false,
        es_ligero: true,
        es_comfort_food: false,
        apto_tupper: true,
        apto_congelar: false,
      },
    };

    expect(toRecipe(live)?.clasificacion?.categoria).toBe('bowls');
  });

  test('drops a row with a malformed jsonb column and logs it', () => {
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const broken: RecipeRow = { ...VALID_ROW, id: 'recipe-bad', meta: { raciones: 'dos' } };

    expect(toRecipe(broken)).toBeNull();
    expect(errorSpy.mock.calls[0]?.[0]).toContain('[recipes]');
    expect(errorSpy.mock.calls[0]?.[0]).toContain('recipe-bad');

    errorSpy.mockRestore();
  });

  test('toRecipes skips the dropped row and keeps the rest', () => {
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const broken: RecipeRow = { ...VALID_ROW, id: 'recipe-bad', temporada: ['otoño'] };

    expect(toRecipes([VALID_ROW, broken]).map(r => r.id)).toEqual(['recipe-1']);

    errorSpy.mockRestore();
  });
});

describe('getShoppingListForPlan (jsonb boundary)', () => {
  function clientWithItems(items: unknown) {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({
        data: { id: 'list-1', items, coste_estimado_min: 1, coste_estimado_max: 2 },
        error: null,
      }),
    };

    return { from: () => query } as unknown as SupabaseClient<Database>;
  }

  test('returns the pasillos when items match the shape', async () => {
    const items = [{ nombre: 'Frutas', orden: 1, items: [{ nombre: 'Manzana', cantidad: 2, unidad: 'ud', comprado: false }] }];

    const result = await getShoppingListForPlan(clientWithItems(items), 'plan-1');

    expect(result?.resumen.total_items).toBe(1);
  });

  test('throws ShoppingListError when items no longer match the shape', async () => {
    const items = [{ nombre: 'Frutas', orden: 1, items: [{ nombre: 'Manzana', cantidad: 'dos' }] }];

    await expect(getShoppingListForPlan(clientWithItems(items), 'plan-1')).rejects.toBeInstanceOf(ShoppingListError);
  });
});

describe('lib/api cast ratchet (FRESCO-820)', () => {
  test('no `as unknown as` outside tests', () => {
    const offenders: string[] = [];

    for (const file of new Glob('lib/api/**/*.ts').scanSync('.')) {
      if (file.endsWith('.test.ts')) {
        continue;
      }
      if (readFileSync(file, 'utf8').includes('as unknown as')) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
