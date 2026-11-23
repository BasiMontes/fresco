import { describe, expect, test } from 'bun:test';
import { advertenciasConPresupuesto, avisoPresupuesto } from './budget-warning';

// FRESCO-1269 (QAFRESCO-2). The warning and the "Gasto semanal estimado" tile are one estimate, so a cost over the
// budget always warns, with the excess computed from that same cost.

describe('avisoPresupuesto', () => {
  test('the finding: 97,32 € against a 90 € budget warns with 7,32 €', () => {
    expect(avisoPresupuesto(97.32, 90)).toBe('El menú supera tu presupuesto semanal en aproximadamente 7.32€');
  });

  test('just under the budget does not warn', () => {
    expect(avisoPresupuesto(89.99, 90)).toBeNull();
  });

  test('exactly the budget does not warn', () => {
    expect(avisoPresupuesto(90, 90)).toBeNull();
  });

  test('just over the budget warns, with two decimals', () => {
    expect(avisoPresupuesto(90.01, 90)).toBe('El menú supera tu presupuesto semanal en aproximadamente 0.01€');
  });

  test('no budget (null or undefined) never warns', () => {
    expect(avisoPresupuesto(500, null)).toBeNull();
    expect(avisoPresupuesto(500, undefined)).toBeNull();
  });

  test('no estimate (the calculation failed and the tile is hidden) never warns', () => {
    expect(avisoPresupuesto(undefined, 90)).toBeNull();
    expect(avisoPresupuesto(Number.NaN, 90)).toBeNull();
  });
});

describe('advertenciasConPresupuesto', () => {
  const OTRA = 'No hemos podido leer tu historial de recetas.';
  const VIEJO = 'El menú supera tu presupuesto semanal en aproximadamente 3.00€';
  const APROXIMADO = 'El cálculo de presupuesto es aproximado: 2 recetas no tienen coste estimado.';

  test('appends the warning after the other warnings', () => {
    expect(advertenciasConPresupuesto([OTRA], 'AVISO')).toEqual([OTRA, 'AVISO']);
  });

  test('replaces a stored budget warning instead of showing two figures', () => {
    expect(advertenciasConPresupuesto([OTRA, VIEJO], 'AVISO')).toEqual([OTRA, 'AVISO']);
  });

  test('drops a stored budget warning when the menu is within budget now', () => {
    expect(advertenciasConPresupuesto([VIEJO, OTRA], null)).toEqual([OTRA]);
  });

  test('drops the old "approximate calculation" note, which described the old estimate', () => {
    expect(advertenciasConPresupuesto([APROXIMADO, OTRA], null)).toEqual([OTRA]);
  });

  test('leaves the list as it was when there is nothing to add or remove', () => {
    expect(advertenciasConPresupuesto([OTRA], null)).toEqual([OTRA]);
    expect(advertenciasConPresupuesto([], null)).toEqual([]);
  });

  test('does not mutate its input', () => {
    const entrada = [OTRA, VIEJO];
    advertenciasConPresupuesto(entrada, 'AVISO');

    expect(entrada).toEqual([OTRA, VIEJO]);
  });
});
