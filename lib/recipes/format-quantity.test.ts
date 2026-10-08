import { describe, expect, test } from 'bun:test';
import { formatCantidad } from './format-quantity';

const NBSP = ' ';

describe('formatCantidad', () => {
  test('weights and volumes keep their unit after a non-breaking space', () => {
    expect(formatCantidad({ cantidad: 400, unidad: 'g' })).toBe(`400${NBSP}g`);
    expect(formatCantidad({ cantidad: 60, unidad: 'ml' })).toBe(`60${NBSP}ml`);
  });

  test('countable items read as "ud." so no noun has to be pluralised', () => {
    expect(formatCantidad({ cantidad: 2, unidad: 'unidades' })).toBe(`2${NBSP}ud.`);
    expect(formatCantidad({ cantidad: 1, unidad: 'unidades' })).toBe(`1${NBSP}ud.`);
  });

  test('spoon, clove and pinch units agree in number', () => {
    expect(formatCantidad({ cantidad: 1, unidad: 'cucharaditas' })).toBe(`1${NBSP}cucharadita`);
    expect(formatCantidad({ cantidad: 2, unidad: 'cucharadas' })).toBe(`2${NBSP}cucharadas`);
    expect(formatCantidad({ cantidad: 1, unidad: 'dientes' })).toBe(`1${NBSP}diente`);
    expect(formatCantidad({ cantidad: 3, unidad: 'dientes' })).toBe(`3${NBSP}dientes`);
    expect(formatCantidad({ cantidad: 1, unidad: 'pizca' })).toBe(`1${NBSP}pizca`);
    expect(formatCantidad({ cantidad: 2, unidad: 'pizca' })).toBe(`2${NBSP}pizcas`);
  });

  test('decimals use the Spanish comma and at most two digits', () => {
    expect(formatCantidad({ cantidad: 1.5, unidad: 'cucharadas' })).toBe(`1,5${NBSP}cucharadas`);
    expect(formatCantidad({ cantidad: 0.25, unidad: 'ml' })).toBe(`0,25${NBSP}ml`);
  });

  test('"al gusto" ignores the number', () => {
    expect(formatCantidad({ cantidad: 0, unidad: 'al gusto' })).toBe('al gusto');
  });
});
