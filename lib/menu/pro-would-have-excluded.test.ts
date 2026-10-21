import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';
import { describe, expect, test } from 'bun:test';
import { addIsoWeeks } from '@/lib/date/iso-week';
import { createMockClient } from '@/lib/fixtures/mock-supabase-client';
import { getPriorMarks, PriorMarksError, proWouldHaveExcluded } from './pro-would-have-excluded';

/** A week where every slot is empty except the ones the test places. */
function menuWith(placed: Record<string, { id: string, nombre: string } | null>): MenuSemanalPersistido['menu'] {
  const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
  const tipos = ['desayuno', 'comida', 'cena'] as const;
  const menu = Object.fromEntries(dias.map(dia => [dia, Object.fromEntries(tipos.map(tipo => [tipo, null]))]));
  for (const [slot, recipe] of Object.entries(placed)) {
    const [dia, tipo] = slot.split(':');
    (menu as Record<string, Record<string, unknown>>)[dia][tipo] = recipe;
  }
  return menu as MenuSemanalPersistido['menu'];
}

const LENTEJAS = { id: 'r-lentejas', nombre: 'Lentejas estofadas' };
const TORTILLA = { id: 'r-tortilla', nombre: 'Tortilla de patata' };
const PASTA = { id: 'r-pasta', nombre: 'Pasta al pesto' };

describe('proWouldHaveExcluded', () => {
  test('lists a dish of the menu that was marked in the previous weeks, with its mark', () => {
    const menu = menuWith({ 'lunes:comida': LENTEJAS, 'martes:cena': PASTA });

    expect(proWouldHaveExcluded({ menu, priorMarks: [{ recipeId: LENTEJAS.id, estado: 'descartada' }] }))
      .toEqual([{ id: LENTEJAS.id, nombre: LENTEJAS.nombre, estado: 'descartada' }]);
  });

  test('a cooked dish counts too: Pro excludes cocinada as well as descartada', () => {
    const menu = menuWith({ 'lunes:comida': TORTILLA });

    expect(proWouldHaveExcluded({ menu, priorMarks: [{ recipeId: TORTILLA.id, estado: 'cocinada' }] }).map(dish => dish.estado)).toEqual(['cocinada']);
  });

  test('a recipe marked both ways counts as descartada, the more decisive signal', () => {
    const menu = menuWith({ 'lunes:comida': LENTEJAS });
    const priorMarks = [{ recipeId: LENTEJAS.id, estado: 'descartada' as const }, { recipeId: LENTEJAS.id, estado: 'cocinada' as const }];

    expect(proWouldHaveExcluded({ menu, priorMarks })[0].estado).toBe('descartada');
    expect(proWouldHaveExcluded({ menu, priorMarks: [...priorMarks].reverse() })[0].estado).toBe('descartada');
  });

  test('a dish that appears twice in the menu is listed once, in menu order', () => {
    const menu = menuWith({ 'lunes:comida': LENTEJAS, 'jueves:cena': LENTEJAS, 'martes:comida': TORTILLA });
    const priorMarks = [{ recipeId: TORTILLA.id, estado: 'cocinada' as const }, { recipeId: LENTEJAS.id, estado: 'descartada' as const }];

    expect(proWouldHaveExcluded({ menu, priorMarks }).map(dish => dish.id)).toEqual([LENTEJAS.id, TORTILLA.id]);
  });

  test('a marked recipe that is not in this menu is not listed', () => {
    const menu = menuWith({ 'lunes:comida': PASTA });

    expect(proWouldHaveExcluded({ menu, priorMarks: [{ recipeId: LENTEJAS.id, estado: 'descartada' }] })).toEqual([]);
  });

  test('no marks, or an empty menu, gives nothing', () => {
    expect(proWouldHaveExcluded({ menu: menuWith({ 'lunes:comida': LENTEJAS }), priorMarks: [] })).toEqual([]);
    expect(proWouldHaveExcluded({ menu: menuWith({}), priorMarks: [{ recipeId: LENTEJAS.id, estado: 'descartada' }] })).toEqual([]);
  });

  test('an empty slot (null recipe) never matches a mark', () => {
    expect(proWouldHaveExcluded({ menu: menuWith({ 'lunes:comida': null }), priorMarks: [{ recipeId: LENTEJAS.id, estado: 'descartada' }] })).toEqual([]);
  });
});

describe('getPriorMarks', () => {
  const SEMANA = '2026-W43';

  test('reads the two ISO weeks before the current one, for this user, marks that count only', async () => {
    const { client, callsOf } = createMockClient({ data: [] });

    await getPriorMarks(client, { semanaIso: SEMANA, userId: 'user-1' });

    expect(callsOf('from')).toEqual([['meal_plan_recipes']]);
    expect(callsOf('eq')).toEqual([['meal_plans.user_id', 'user-1']]);
    expect(callsOf('in')).toEqual([
      ['meal_plans.semana_iso', [addIsoWeeks(SEMANA, -1), addIsoWeeks(SEMANA, -2)]],
      ['estado', ['cocinada', 'descartada']],
    ]);
  });

  test('maps each row to a mark and drops a slot with no catalogue recipe', async () => {
    const { client } = createMockClient({
      data: [
        { recipe_id: 'r-1', estado: 'descartada' },
        { recipe_id: null, estado: 'cocinada' },
        { recipe_id: 'r-2', estado: 'cocinada' },
      ],
    });

    expect(await getPriorMarks(client, { semanaIso: SEMANA, userId: 'user-1' })).toEqual([
      { recipeId: 'r-1', estado: 'descartada' },
      { recipeId: 'r-2', estado: 'cocinada' },
    ]);
  });

  test('a failed read throws so the caller can hide the notice', async () => {
    const { client } = createMockClient({ errorMessage: 'boom' });

    await expect(getPriorMarks(client, { semanaIso: SEMANA, userId: 'user-1' })).rejects.toBeInstanceOf(PriorMarksError);
  });
});
