import { beforeEach, describe, expect, test } from 'bun:test';
import { useOnboardingStore } from './onboarding-store';

/**
 * Covers AC-2 ("Laura declara una dieta vegana" → vegetariana queda
 * implícita) at the store level — the invariant must hold on every
 * intermediate render, not just at submit time.
 */
describe('useOnboardingStore — toggleDieta vegano/vegetariano lock (AC-2)', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  test('toggling dietaVegano on also sets dietaVegetariano true', () => {
    useOnboardingStore.getState().toggleDieta('dietaVegano');

    const state = useOnboardingStore.getState();
    expect(state.dietaVegano).toBe(true);
    expect(state.dietaVegetariano).toBe(true);
  });

  test('attempting to untoggle dietaVegetariano while dietaVegano is active is a no-op', () => {
    useOnboardingStore.getState().toggleDieta('dietaVegano');
    useOnboardingStore.getState().toggleDieta('dietaVegetariano');

    const state = useOnboardingStore.getState();
    expect(state.dietaVegano).toBe(true);
    expect(state.dietaVegetariano).toBe(true);
  });

  test('untoggling dietaVegano does not force dietaVegetariano off', () => {
    useOnboardingStore.getState().toggleDieta('dietaVegano');
    useOnboardingStore.getState().toggleDieta('dietaVegano');

    const state = useOnboardingStore.getState();
    expect(state.dietaVegano).toBe(false);
    expect(state.dietaVegetariano).toBe(true);
  });

  test('toggling an unrelated diet flag works independently', () => {
    useOnboardingStore.getState().toggleDieta('dietaSinGluten');

    expect(useOnboardingStore.getState().dietaSinGluten).toBe(true);
    expect(useOnboardingStore.getState().dietaVegetariano).toBe(false);
  });
});
