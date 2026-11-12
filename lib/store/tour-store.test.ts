import { beforeEach, describe, expect, test } from 'bun:test';
import { useTourStore } from './tour-store';

// FRESCO-1197 — the Configuración row asks the layout's tour to start again. A store rather than a
// prop because the row and the tour live in different parts of the tree, and the request has to
// survive the navigation to /menu (same reason as `useAccountModalStore`, FRESCO-1074).

describe('useTourStore', () => {
  beforeEach(() => {
    useTourStore.getState().clear();
  });

  test('starts with no replay requested', () => {
    expect(useTourStore.getState().replayRequested).toBe(false);
  });

  test('requestReplay asks for the tour', () => {
    useTourStore.getState().requestReplay();

    expect(useTourStore.getState().replayRequested).toBe(true);
  });

  test('clear consumes the request so it never starts the tour twice', () => {
    useTourStore.getState().requestReplay();
    useTourStore.getState().clear();

    expect(useTourStore.getState().replayRequested).toBe(false);
  });
});
