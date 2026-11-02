import type { PlanningSelection } from '@/lib/planning-selection';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { act, renderHook } from '@/tests/component-render';
import { useOnboardingValidation } from './use-onboarding-validation';

// FRESCO-1080 — the footer CTA of the onboarding wizard reads these four flags.
// A wrong flag lets a user on without the explicit health-data consent (GDPR art. 9),
// or lets "Generar mi menú" run with nothing selected.

beforeEach(() => {
  useOnboardingStore.getState().reset();
});

afterEach(() => {
  useOnboardingStore.getState().reset();
});

function validation() {
  return renderHook(() => useOnboardingValidation());
}

describe('useOnboardingValidation', () => {
  test('a fresh draft is valid: a default household, no budget, every slot selected, no health data', () => {
    const { result } = validation();

    expect(result.current.household.valid).toBe(true);
    expect(result.current.presupuestoValid).toBe(true);
    expect(result.current.hasInvalidPlanning).toBe(false);
    expect(result.current.healthConsentOk).toBe(true);
  });

  describe('household', () => {
    test('zero adults is refused with the message the step shows', () => {
      act(() => useOnboardingStore.getState().setAdultos(0));
      const { result } = validation();

      expect(result.current.household).toEqual({ valid: false, message: 'Indica al menos un adulto en el hogar.' });
    });

    test('negative children are refused', () => {
      act(() => useOnboardingStore.getState().setNinos(-1));
      const { result } = validation();

      expect(result.current.household.valid).toBe(false);
    });
  });

  describe('presupuesto (optional, FRESCO-371)', () => {
    test('a positive budget is valid', () => {
      act(() => useOnboardingStore.getState().setPresupuestoSemanaEuros(80));
      expect(validation().result.current.presupuestoValid).toBe(true);
    });

    test('zero and negative budgets are refused, matching the DB check constraint', () => {
      for (const value of [0, -5]) {
        act(() => useOnboardingStore.getState().setPresupuestoSemanaEuros(value));
        expect(validation().result.current.presupuestoValid).toBe(false);
      }
    });

    test('no budget at all stays valid', () => {
      act(() => useOnboardingStore.getState().setPresupuestoSemanaEuros(null));
      expect(validation().result.current.presupuestoValid).toBe(true);
    });
  });

  describe('planning (FRESCO-165/166)', () => {
    const emptyPlanning = (): PlanningSelection => ({ lunes: [], martes: [], miercoles: [], jueves: [], viernes: [], sabado: [], domingo: [] });

    test('no meal in any day blocks generation', () => {
      act(() => useOnboardingStore.getState().setPlanningSelection(emptyPlanning()));
      expect(validation().result.current.hasInvalidPlanning).toBe(true);
    });

    test('a single meal on a single day is enough', () => {
      act(() => useOnboardingStore.getState().setPlanningSelection({ ...emptyPlanning(), lunes: ['comida'] }));
      expect(validation().result.current.hasInvalidPlanning).toBe(false);
    });
  });

  describe('health-data consent (FRESCO-794, ADR-0040)', () => {
    test('an allergen without the consent blocks the wizard', () => {
      act(() => useOnboardingStore.getState().toggleAlergeno('gluten'));
      expect(validation().result.current.healthConsentOk).toBe(false);
    });

    test('the same allergen with the explicit consent lets it on', () => {
      act(() => {
        useOnboardingStore.getState().toggleAlergeno('gluten');
        useOnboardingStore.getState().setHealthDataConsent(true);
      });
      expect(validation().result.current.healthConsentOk).toBe(true);
    });
  });
});
