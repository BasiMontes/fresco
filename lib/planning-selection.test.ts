import type { PlanningSelection } from './planning-selection';
import { describe, expect, test } from 'bun:test';
import { fromPlanningSelection, toPlanningSelection } from './planning-selection';

describe('fromPlanningSelection', () => {
  test('returns meals in canonical desayuno -> comida -> cena order regardless of storage order', () => {
    // FRESCO-516: `lunes` stores its meals as [cena, desayuno] — whatever
    // order they happened to be saved in — to reproduce the bug the founder
    // saw (Cena rendering before Desayuno on /calendar).
    const selection = {
      lunes: ['cena', 'desayuno'],
      martes: [],
      miercoles: [],
      jueves: [],
      viernes: [],
      sabado: [],
      domingo: [],
    } as unknown as PlanningSelection;

    const { meals } = fromPlanningSelection(selection);

    expect(meals).toEqual(['desayuno', 'cena']);
  });

  test('deduplicates meals across days while preserving canonical order', () => {
    const selection = toPlanningSelection(['lunes', 'martes'], ['cena', 'comida', 'desayuno']);

    const { meals } = fromPlanningSelection(selection);

    expect(meals).toEqual(['desayuno', 'comida', 'cena']);
  });
});
