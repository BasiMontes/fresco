import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { useOnboardingStore } from './onboarding-store';

/**
 * This suite replaces `globalThis.window` with a bare `{ sessionStorage }`
 * stub. Capture the real happy-dom window and restore it after the file so
 * later component-test files keep a window with `addEventListener` /
 * `dispatchEvent` (the shared `bun-test-setup.ts` re-register guard only
 * fires when `window` is fully `undefined`, not when it is a stub).
 */
const realWindow = (globalThis as { window?: unknown }).window;

/**
 * Bun's default test runtime has no `window`/`sessionStorage` — the store's
 * `getOnboardingStorage()` falls back to a no-op storage when `window` is
 * undefined (the same SSR-safety branch that protects Next.js server
 * rendering). This in-memory `Storage` stand-in lets these tests exercise
 * the real `persist` write/read path instead of the no-op branch.
 */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };
}

const mockSessionStorage = createMemoryStorage();

function readPersisted(): Record<string, unknown> {
  const raw = mockSessionStorage.getItem('fresco-onboarding');
  if (!raw) {
    throw new Error('expected fresco-onboarding to be persisted to sessionStorage');
  }
  return (JSON.parse(raw) as { state: Record<string, unknown> }).state;
}

describe('useOnboardingStore — sessionStorage persistence (FRESCO-94)', () => {
  beforeAll(() => {
    // Assigned after this module's own top-level `create(...)` already ran
    // (with `window` still undefined, same as production SSR) — only
    // affects writes made inside these test bodies, which is what's under
    // test here.
    (globalThis as unknown as { window: { sessionStorage: Storage } }).window
      = { sessionStorage: mockSessionStorage };
  });

  beforeEach(() => {
    useOnboardingStore.getState().reset();
    mockSessionStorage.clear();
  });

  test('toggling a field persists it to sessionStorage', () => {
    useOnboardingStore.getState().toggleDieta('dietaVegano');

    const persisted = readPersisted();
    expect(persisted.dietaVegano).toBe(true);
    expect(persisted.dietaVegetariano).toBe(true);
  });

  test('reset() clears the persisted answers back to defaults', () => {
    useOnboardingStore.getState().toggleAlergeno('gluten');
    useOnboardingStore.getState().reset();

    const persisted = readPersisted();
    expect(persisted.alergenos).toEqual([]);
  });

  test('does not persist action functions, only answer fields', () => {
    useOnboardingStore.getState().setAdultos(4);

    const persisted = readPersisted();
    expect(persisted.adultos).toBe(4);
    expect(persisted.setAdultos).toBeUndefined();
  });
});

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

/**
 * FRESCO-275 — data-derived locks (see lib/constants/dietary-options.ts):
 * a dieta flag that never co-occurs with an alergeno in the real catalog
 * auto-selects that alergeno, and toggleAlergeno refuses to un-toggle it.
 */
describe('useOnboardingStore — dieta implies alergeno locks (FRESCO-275)', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  test('toggling dietaVegano adds huevo and pescado to alergenos, never sulfitos', () => {
    useOnboardingStore.getState().toggleDieta('dietaVegano');

    expect(useOnboardingStore.getState().alergenos.sort()).toEqual(['huevo', 'pescado']);
  });

  test('toggling dietaVegetariano alone adds pescado, not huevo nor sulfitos', () => {
    useOnboardingStore.getState().toggleDieta('dietaVegetariano');

    expect(useOnboardingStore.getState().alergenos).toEqual(['pescado']);
  });

  test('sulfitos stays a free choice while a diet is active', () => {
    useOnboardingStore.getState().toggleDieta('dietaVegano');
    useOnboardingStore.getState().toggleAlergeno('sulfitos');

    expect(useOnboardingStore.getState().alergenos).toContain('sulfitos');

    useOnboardingStore.getState().toggleAlergeno('sulfitos');

    expect(useOnboardingStore.getState().alergenos).not.toContain('sulfitos');
  });

  test('toggling dietaSinGluten adds gluten', () => {
    useOnboardingStore.getState().toggleDieta('dietaSinGluten');

    expect(useOnboardingStore.getState().alergenos).toEqual(['gluten']);
  });

  test('toggleAlergeno on a locked value is a no-op', () => {
    useOnboardingStore.getState().toggleDieta('dietaVegano');
    useOnboardingStore.getState().toggleAlergeno('pescado');

    expect(useOnboardingStore.getState().alergenos).toContain('pescado');
  });

  // FRESCO-1321/QAFRESCO-37: a diet takes with it only what it put there.
  const toggle = (...fields: Parameters<ReturnType<typeof useOnboardingStore.getState>['toggleDieta']>[0][]) =>
    fields.forEach(field => useOnboardingStore.getState().toggleDieta(field));
  const selected = () => useOnboardingStore.getState().alergenos;

  test('switching a diet off removes the alergeno it added', () => {
    toggle('dietaVegetariano', 'dietaVegetariano');
    toggle('dietaSinGluten', 'dietaSinGluten');

    expect(selected()).toEqual([]);
  });

  test('a hand-chosen alergeno survives the diet that also implies it', () => {
    useOnboardingStore.getState().toggleAlergeno('pescado');
    toggle('dietaVegetariano', 'dietaVegetariano');

    expect(selected()).toEqual(['pescado']);
  });

  test('an alergeno that was already there with its diet stays when the diet goes off', () => {
    useOnboardingStore.setState({ dietaVegetariano: true, alergenos: ['pescado'] });
    toggle('dietaVegetariano');

    expect(selected()).toEqual(['pescado']);
  });

  test('Vegano off keeps what Vegetariano still implies, which goes when Vegetariano goes off', () => {
    toggle('dietaVegano', 'dietaVegano');
    expect(selected()).toEqual(['pescado']);

    toggle('dietaVegetariano');
    expect(selected()).toEqual([]);
  });

  test('a hand-chosen sulfitos survives a diet going off and on (QAFRESCO-29)', () => {
    useOnboardingStore.getState().toggleAlergeno('sulfitos');
    toggle('dietaVegano', 'dietaVegano', 'dietaVegetariano', 'dietaVegano', 'dietaVegano', 'dietaVegetariano');

    expect(selected()).toEqual(['sulfitos']);
  });

  test('a reload remembers what the diet added', () => {
    toggle('dietaVegetariano');
    const persisted = useOnboardingStore.persist.getOptions().partialize!(useOnboardingStore.getState());

    expect(persisted).toMatchObject({ alergenosPorDieta: ['pescado'] });
  });

  test('a manually-added alergeno unrelated to any dieta stays freely toggleable', () => {
    useOnboardingStore.getState().toggleDieta('dietaVegano');
    useOnboardingStore.getState().toggleAlergeno('apio');
    useOnboardingStore.getState().toggleAlergeno('apio');

    expect(useOnboardingStore.getState().alergenos).not.toContain('apio');
  });
});

describe('onboarding summary navigation (FRESCO-755)', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  test('editFromSummary opens the step and marks the return to the summary', () => {
    useOnboardingStore.getState().editFromSummary(2);

    expect(useOnboardingStore.getState().step).toBe(2);
    expect(useOnboardingStore.getState().returnToSummary).toBe(true);
  });

  test('goToSummary lands on step 4 and clears the return flag', () => {
    useOnboardingStore.getState().editFromSummary(3);
    useOnboardingStore.getState().goToSummary();

    expect(useOnboardingStore.getState().step).toBe(4);
    expect(useOnboardingStore.getState().returnToSummary).toBe(false);
  });

  test('reset clears the return flag', () => {
    useOnboardingStore.getState().editFromSummary(1);
    useOnboardingStore.getState().reset();

    expect(useOnboardingStore.getState().returnToSummary).toBe(false);
  });
});

afterAll(() => {
  (globalThis as { window?: unknown }).window = realWindow;
});
