import type { MenuGrid } from '@/lib/calendar/apply-slot-swap';
import { describe, expect, test } from 'bun:test';
import { estimateMenuCost } from './estimate-menu-cost';
import { costeSemanalEstimado } from './weekly-cost';

const EMPTY_MENU = Object.fromEntries(
  ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
    .map(dia => [dia, { desayuno: null, comida: null, cena: null }]),
) as unknown as MenuGrid;

function menuWith(ingredientes: string[]): MenuGrid {
  const recipe = { id: 'r1', nombre: 'Plato', ingredientes_principales: ingredientes, meta: { raciones: 2 } };
  return { ...EMPTY_MENU, lunes: { desayuno: null, comida: recipe, cena: null } } as unknown as MenuGrid;
}

describe('costeSemanalEstimado (FRESCO-792 — one weekly figure for /menu and the shopping list)', () => {
  test('equals estimateMenuCost for the same plan and household size, so both screens agree', () => {
    const menu = menuWith(['leche', 'aceite de oliva', 'avena']);

    expect(costeSemanalEstimado(menu, { numPersonas: 3 })).toBe(estimateMenuCost(menu, { numPersonas: 3 }));
    expect(costeSemanalEstimado(menu, { numPersonas: 3 })).toBeGreaterThan(0);
  });

  test('defaults the household to 2 people when the profile has none', () => {
    const menu = menuWith(['leche']);

    expect(costeSemanalEstimado(menu, { numPersonas: null })).toBe(estimateMenuCost(menu, { numPersonas: 2 }));
    expect(costeSemanalEstimado(menu, {})).toBe(estimateMenuCost(menu, { numPersonas: 2 }));
  });

  test('is 0 for an empty menu, not undefined', () => {
    expect(costeSemanalEstimado(EMPTY_MENU, { numPersonas: 2 })).toBe(0);
  });

  test('is undefined instead of throwing when the calculation fails', () => {
    expect(costeSemanalEstimado(null as unknown as MenuGrid, { numPersonas: 2 })).toBeUndefined();
  });

  test('passes the profile through, so /menu and the list drop the same incompatible product', () => {
    const menu = menuWith(['caldo']);
    const base = costeSemanalEstimado(menu, { numPersonas: 2 }) as number;
    const vegano = costeSemanalEstimado(menu, { numPersonas: 2, perfil: { vegano: true } }) as number;

    expect(vegano).toBe(estimateMenuCost(menu, { numPersonas: 2, perfil: { vegano: true } }));
    expect(vegano).not.toBe(base);
  });
});
