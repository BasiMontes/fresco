import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { renderWithProviders } from '@/tests/component-render';
import { ServiceWorkerRegistrar } from './service-worker-registrar';

/**
 * FRESCO-979 — the registrar puts `/sw.js` in every signed-in browser. It must
 * register once, after the page has loaded, never throw when the browser has no
 * service workers, and render nothing.
 */

let registered: string[];
const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
const readyStateDescriptor = Object.getOwnPropertyDescriptor(document, 'readyState');

function setReadyState(value: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', { value, configurable: true });
}

beforeEach(() => {
  registered = [];
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register: async (url: string) => { registered.push(url); return {}; } },
  });
  setReadyState('complete');
});

afterEach(() => {
  if (originalDescriptor) { Object.defineProperty(navigator, 'serviceWorker', originalDescriptor); }
  else { Reflect.deleteProperty(navigator, 'serviceWorker'); }
  if (readyStateDescriptor) { Object.defineProperty(document, 'readyState', readyStateDescriptor); }
  else { Reflect.deleteProperty(document, 'readyState'); }
});

describe('ServiceWorkerRegistrar', () => {
  test('registers /sw.js once when the page is already loaded, and renders nothing', async () => {
    const { container } = renderWithProviders(<ServiceWorkerRegistrar />);
    await Promise.resolve();

    expect(registered).toEqual(['/sw.js']);
    expect(container).toBeEmptyDOMElement();
  });

  test('waits for the window load event when the page is still loading', async () => {
    setReadyState('loading');

    renderWithProviders(<ServiceWorkerRegistrar />);
    await Promise.resolve();

    expect(registered).toEqual([]);

    window.dispatchEvent(new Event('load'));
    await Promise.resolve();

    expect(registered).toEqual(['/sw.js']);
  });

  test('does nothing and does not throw when the browser has no service workers', async () => {
    Reflect.deleteProperty(navigator, 'serviceWorker');

    expect(() => renderWithProviders(<ServiceWorkerRegistrar />)).not.toThrow();
    await Promise.resolve();

    expect(registered).toEqual([]);
  });

  test('swallows a failed registration instead of breaking the page', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register: async () => { throw new Error('boom'); } },
    });

    expect(() => renderWithProviders(<ServiceWorkerRegistrar />)).not.toThrow();
    await Promise.resolve();
  });
});
