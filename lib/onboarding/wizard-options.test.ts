import type { PlanningSelection } from '@/lib/planning-selection';
import { describe, expect, test } from 'bun:test';
import { describePlanning } from './wizard-options';

/** FRESCO-755 — planning recap shown in the onboarding summary. */
describe('describePlanning', () => {
  const all = ['desayuno', 'comida', 'cena'] as const;

  test('collapses all 7 days into "Toda la semana"', () => {
    const selection: PlanningSelection = {
      lunes: [...all],
      martes: [...all],
      miercoles: [...all],
      jueves: [...all],
      viernes: [...all],
      sabado: [...all],
      domingo: [...all],
    };

    expect(describePlanning(selection)).toEqual({ days: 'Toda la semana', meals: 'Desayuno, Almuerzo, Cena' });
  });

  test('lists the selected days and only the selected meals', () => {
    const selection: PlanningSelection = {
      lunes: ['comida'],
      martes: [],
      miercoles: ['comida'],
      jueves: [],
      viernes: [],
      sabado: [],
      domingo: [],
    };

    expect(describePlanning(selection)).toEqual({ days: 'Lun, Mié', meals: 'Almuerzo' });
  });

  test('returns empty strings when nothing is selected', () => {
    const selection: PlanningSelection = { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [], sabado: [], domingo: [] };

    expect(describePlanning(selection)).toEqual({ days: '', meals: '' });
  });
});
