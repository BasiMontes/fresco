import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

/**
 * FRESCO-979 — `public/sw.js` is a plain script (no exports) that registers
 * listeners on `globalThis`. These tests load it once against fakes of the
 * service-worker globals and drive its handlers with fake events.
 *
 * What they pin down is what keeps the worker safe for every signed-in user:
 * it precaches ONLY static files, it never stores a navigation, it ignores
 * everything that is not a page navigation, and the push handlers (FRESCO-241)
 * are still there.
 */

type Handler = (event: Record<string, unknown>) => void;
/** The worker globals the script reads, as a bag we can swap in and out. */
const scope = globalThis as unknown as Record<string, unknown>;
const handlers: Record<string, Handler> = {};

/** A tiny Cache Storage: named caches holding url -> Response. */
class FakeCache {
  entries = new Map<string, Response>();
  puts = 0;
  async addAll(urls: string[]) { for (const url of urls) { this.entries.set(url, new Response(`static:${url}`)); } }
  async put(url: string, response: Response) { this.puts++; this.entries.set(url, response); }
}

class FakeCacheStorage {
  stores = new Map<string, FakeCache>();
  opened: string[] = [];
  async open(name: string) {
    this.opened.push(name);
    if (!this.stores.has(name)) { this.stores.set(name, new FakeCache()); }
    return this.stores.get(name)!;
  }

  async keys() { return [...this.stores.keys()]; }
  async delete(name: string) { return this.stores.delete(name); }
  async match(url: string, options?: { cacheName?: string }) {
    const names = options?.cacheName ? [options.cacheName] : [...this.stores.keys()];
    for (const name of names) {
      const hit = this.stores.get(name)?.entries.get(url);
      if (hit) { return hit.clone(); }
    }
    return undefined;
  }
}

let caches: FakeCacheStorage;
let calls: { skipWaiting: number, claim: number };
let networkResponse: () => Promise<Response>;

const original: Record<string, unknown> = {};
const GLOBALS = ['addEventListener', 'caches', 'skipWaiting', 'clients', 'registration', 'fetch'] as const;

beforeAll(async () => {
  for (const key of GLOBALS) { original[key] = scope[key]; }
  scope.addEventListener = (type: string, handler: Handler) => { handlers[type] = handler; };
  scope.caches = new Proxy({}, { get: (_t, prop) => (caches as unknown as Record<string, (...args: unknown[]) => unknown>)[prop as string].bind(caches) });
  scope.skipWaiting = async () => { calls.skipWaiting++; };
  scope.clients = { claim: async () => { calls.claim++; }, matchAll: async () => [], openWindow: async () => undefined };
  scope.registration = { showNotification: async () => undefined };
  scope.fetch = async (..._args: unknown[]) => networkResponse();
  await import(new URL('../../public/sw.js', import.meta.url).href);
});

afterAll(() => {
  for (const key of GLOBALS) { scope[key] = original[key]; }
});

beforeEach(() => {
  caches = new FakeCacheStorage();
  calls = { skipWaiting: 0, claim: 0 };
  networkResponse = async () => new Response('network page');
});

/** Runs a handler and awaits whatever it passes to `waitUntil` / `respondWith`. */
async function dispatch(type: string, extra: Record<string, unknown> = {}) {
  let waited: Promise<unknown> | undefined;
  let responded: Promise<Response> | undefined;
  handlers[type]({
    ...extra,
    waitUntil: (p: Promise<unknown>) => { waited = p; },
    respondWith: (p: Promise<Response>) => { responded = p; },
  });
  await waited;
  return { responded: responded ? await responded : undefined, respondWithCalled: responded !== undefined };
}

const navigation = (overrides: Record<string, unknown> = {}) => ({ request: { mode: 'navigate', method: 'GET', url: 'https://fresco.test/menu', ...overrides } });

describe('sw.js offline fallback (FRESCO-979)', () => {
  test('keeps the push handlers of FRESCO-241', () => {
    expect(typeof handlers.push).toBe('function');
    expect(typeof handlers.notificationclick).toBe('function');
  });

  test('install precaches only the offline screen, then takes over', async () => {
    await dispatch('install');

    const cache = caches.stores.get('fresco-offline-v1')!;

    expect([...cache.entries.keys()]).toEqual(['/offline.html']);
    expect(calls.skipWaiting).toBe(1);
  });

  test('activate drops older fresco-offline caches, keeps the current one and unrelated ones, then claims', async () => {
    await caches.open('fresco-offline-v0');
    await caches.open('fresco-offline-v1');
    await caches.open('someone-elses-cache');

    await dispatch('activate');

    expect([...caches.stores.keys()].sort()).toEqual(['fresco-offline-v1', 'someone-elses-cache']);
    expect(calls.claim).toBe(1);
  });

  test('ignores anything that is not a GET page navigation: no respondWith', async () => {
    for (const request of [
      { mode: 'cors', method: 'GET', url: 'https://fresco.test/api/health' },
      { mode: 'no-cors', method: 'GET', url: 'https://fresco.test/_next/static/app.js' },
      { mode: 'navigate', method: 'POST', url: 'https://fresco.test/login' },
    ]) {
      const { respondWithCalled } = await dispatch('fetch', { request });

      expect(respondWithCalled).toBe(false);
    }
  });

  test('a navigation that reaches the server is returned as it came and its page is never stored', async () => {
    await dispatch('install');
    const cache = caches.stores.get('fresco-offline-v1')!;

    const { responded } = await dispatch('fetch', navigation());

    expect(await responded!.text()).toBe('network page');
    // Nothing but the static offline screen is ever in the cache.
    expect([...cache.entries.keys()]).toEqual(['/offline.html']);
    // And no `put`: the response to the navigation was not written anywhere.
    expect(cache.puts).toBe(0);
  });

  test('repairs a missing cache after a navigation that reached the server', async () => {
    await dispatch('install');
    caches.stores.delete('fresco-offline-v1');

    await dispatch('fetch', navigation());
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect([...caches.stores.get('fresco-offline-v1')!.entries.keys()]).toEqual(['/offline.html']);
  });

  test('a server error is passed through: only a network failure shows the offline screen', async () => {
    await dispatch('install');
    networkResponse = async () => new Response('Service Unavailable', { status: 503 });

    const { responded } = await dispatch('fetch', navigation());

    expect(responded!.status).toBe(503);
    expect(await responded!.text()).toBe('Service Unavailable');
  });

  test('a failed navigation answers with the precached offline screen', async () => {
    await dispatch('install');
    networkResponse = async () => { throw new TypeError('Failed to fetch'); };

    const { responded } = await dispatch('fetch', navigation());

    expect(await responded!.text()).toBe('static:/offline.html');
  });

  test('a failed navigation with nothing precached yields a network error, not a hang', async () => {
    networkResponse = async () => { throw new TypeError('Failed to fetch'); };

    const { responded } = await dispatch('fetch', navigation());

    expect(responded!.type).toBe('error');
  });
});
