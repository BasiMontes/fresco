import type { Recipe } from '@schemas';
import type { MenuGrid } from './apply-slot-swap';
import type { DiaSemana, TipoPlato } from '@/lib/api/types';
import { describe, expect, test } from 'bun:test';
import { applySlotSwap } from './apply-slot-swap';

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const TIPOS: TipoPlato[] = ['desayuno', 'comida', 'cena'];

/** Minimal-but-valid `Recipe` fixture, one per (día, tipo) so identity is easy to assert on. */
function buildRecipe(dia: DiaSemana, tipo: TipoPlato): Recipe {
  return {
    id: `recipe-${dia}-${tipo}`,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    nombre: `${dia}-${tipo}`,
    slug: `${dia}-${tipo}`,
    descripcion_corta: null,
    foto_url: null,
    meta: null,
    clasificacion: null,
    dieta: null,
    alergenos: null,
    ingredientes_principales: null,
    ingredientes_que_puede_desagradar: null,
    temporada: null,
    pasos_resumen: null,
    veces_cocinada: 0,
    veces_descartada: 0,
    rating_promedio: null,
    ultima_vez_en_menu: null,
  };
}

/** Builds a full 7x3 grid, every slot holding its own uniquely-identifiable recipe. */
function buildFullGrid(): MenuGrid {
  const grid = {} as MenuGrid;
  for (const dia of DIAS) {
    grid[dia] = {} as Record<TipoPlato, Recipe>;
    for (const tipo of TIPOS) {
      grid[dia][tipo] = buildRecipe(dia, tipo);
    }
  }
  return grid;
}

describe('applySlotSwap', () => {
  test('swaps two different-day slots, leaving the other 19 untouched', () => {
    const menu = buildFullGrid();

    const result = applySlotSwap(
      menu,
      { dia: 'lunes', tipo: 'cena' },
      { dia: 'martes', tipo: 'comida' },
    );

    expect(result.lunes.cena?.id).toBe('recipe-martes-comida');
    expect(result.martes.comida?.id).toBe('recipe-lunes-cena');

    for (const dia of DIAS) {
      for (const tipo of TIPOS) {
        if ((dia === 'lunes' && tipo === 'cena') || (dia === 'martes' && tipo === 'comida')) { continue; }
        expect(result[dia][tipo]?.id).toBe(`recipe-${dia}-${tipo}`);
      }
    }
  });

  test('swaps same-day different-tipo slots', () => {
    const menu = buildFullGrid();

    const result = applySlotSwap(
      menu,
      { dia: 'miercoles', tipo: 'desayuno' },
      { dia: 'miercoles', tipo: 'cena' },
    );

    expect(result.miercoles.desayuno?.id).toBe('recipe-miercoles-cena');
    expect(result.miercoles.cena?.id).toBe('recipe-miercoles-desayuno');
    // Sibling slot on the same day, untouched by the swap.
    expect(result.miercoles.comida?.id).toBe('recipe-miercoles-comida');
  });

  test('does not mutate its input and returns a new grid object', () => {
    const menu = buildFullGrid();
    const originalLunesCena = menu.lunes.cena;
    const originalMartesComida = menu.martes.comida;

    const result = applySlotSwap(
      menu,
      { dia: 'lunes', tipo: 'cena' },
      { dia: 'martes', tipo: 'comida' },
    );

    // The input grid, and its day objects, are unchanged.
    expect(menu.lunes.cena).toBe(originalLunesCena);
    expect(menu.martes.comida).toBe(originalMartesComida);
    expect(menu.lunes.cena?.id).toBe('recipe-lunes-cena');
    expect(menu.martes.comida?.id).toBe('recipe-martes-comida');

    // The output is a distinct object from the input at every touched level.
    expect(result).not.toBe(menu);
    expect(result.lunes).not.toBe(menu.lunes);
    expect(result.martes).not.toBe(menu.martes);
  });

  test('applying the same swap twice reverts to the original grid (revert-by-reapplying)', () => {
    const menu = buildFullGrid();
    const slotA = { dia: 'lunes', tipo: 'cena' } as const;
    const slotB = { dia: 'martes', tipo: 'comida' } as const;

    const swapped = applySlotSwap(menu, slotA, slotB);
    const reverted = applySlotSwap(swapped, slotA, slotB);

    for (const dia of DIAS) {
      for (const tipo of TIPOS) {
        expect(reverted[dia][tipo]?.id).toBe(menu[dia][tipo]?.id);
      }
    }
  });

  test('swapping a slot with itself is a documented no-op (same value, new object)', () => {
    const menu = buildFullGrid();
    const slot = { dia: 'jueves', tipo: 'comida' } as const;

    const result = applySlotSwap(menu, slot, slot);

    expect(result.jueves.comida?.id).toBe('recipe-jueves-comida');
    expect(result).not.toBe(menu);
  });

  test('an untouched day keeps its original object reference (only swapped days are copied)', () => {
    const menu = buildFullGrid();
    const originalDomingo = menu.domingo;

    const result = applySlotSwap(
      menu,
      { dia: 'lunes', tipo: 'cena' },
      { dia: 'martes', tipo: 'comida' },
    );

    expect(result.domingo).toBe(originalDomingo);
  });
});
