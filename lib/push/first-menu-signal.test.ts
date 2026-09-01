import { beforeEach, describe, expect, test } from 'bun:test';
import { consumeFirstMenuSignal, markFirstMenuGenerated } from './first-menu-signal';

/**
 * FRESCO-372 — same in-memory `Storage` stand-in `onboarding-store.test.ts`
 * uses for the same reason: Bun's default test runtime has no `window`.
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

describe('first-menu-signal', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    (globalThis as unknown as { window: { sessionStorage: Storage } }).window
      = { sessionStorage: mockSessionStorage };
  });

  test('consumeFirstMenuSignal is false when the signal was never set', () => {
    expect(consumeFirstMenuSignal()).toBe(false);
  });

  test('markFirstMenuGenerated then consumeFirstMenuSignal returns true exactly once', () => {
    markFirstMenuGenerated();

    expect(consumeFirstMenuSignal()).toBe(true);
    // One-shot: a second read after the first consume must not resurface it.
    expect(consumeFirstMenuSignal()).toBe(false);
  });

  test('consumeFirstMenuSignal returns false when window is undefined (SSR)', () => {
    const globalWithWindow = globalThis as { window?: { sessionStorage: Storage } };
    delete globalWithWindow.window;
    expect(consumeFirstMenuSignal()).toBe(false);
  });
});
