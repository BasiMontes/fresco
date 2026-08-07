import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { useOnboardingStore } from './onboarding-store';

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
  } as Storage;
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
