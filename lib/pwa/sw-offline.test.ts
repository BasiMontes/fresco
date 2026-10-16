import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

/**
 * FRESCO-979 — `public/sw.js` is a plain script (no exports) that registers
 * listeners on `globalThis`. These tests load it once against fakes of the
 * service-worker globals and drive its handlers with fake events.
 *
 * What they pin down is what keeps the worker safe for every signed-in user:
 * it precaches ONLY static files, it never stores a navigation, it ignores
 * everything that is not a page navigation, and the push handlers (FRESCO-241,
 * FRESCO-372) still do what they did before the offline screen was added.
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

interface FakeClient {
  url: string
  focus: () => Promise<unknown>
  navigate?: (url: string) => Promise<FakeClient | null>
}

let caches: FakeCacheStorage;
let calls: { skipWaiting: number, claim: number };
let networkResponse: () => Promise<Response>;
let shown: Array<{ title: string, options: Record<string, unknown> }>;
let clientList: FakeClient[];
let opened: string[];

const original: Record<string, unknown> = {};
const GLOBALS = ['addEventListener', 'caches', 'skipWaiting', 'clients', 'registration', 'fetch'] as const;

beforeAll(async () => {
  for (const key of GLOBALS) { original[key] = scope[key]; }
  scope.addEventListener = (type: string, handler: Handler) => { handlers[type] = handler; };
  scope.caches = new Proxy({}, { get: (_t, prop) => (caches as unknown as Record<string, (...args: unknown[]) => unknown>)[prop as string].bind(caches) });
  scope.skipWaiting = async () => { calls.skipWaiting++; };
  scope.clients = {
    claim: async () => { calls.claim++; },
    matchAll: async () => clientList,
    openWindow: async (url: string) => { opened.push(url); },
  };
  scope.registration = { showNotification: async (title: string, options: Record<string, unknown>) => { shown.push({ title, options }); } };
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
  shown = [];
  clientList = [];
  opened = [];
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

describe('sw.js push handlers (FRESCO-241, FRESCO-372) are unchanged', () => {
  const pushEvent = (data: unknown) => ({ data });

  test('push shows the notification from the payload, with the brand icon and the target url', async () => {
    await dispatch('push', pushEvent({ json: () => ({ title: 'Tu menú', body: 'Ya está listo', url: '/calendar' }) }));

    expect(shown).toHaveLength(1);
    expect(shown[0].title).toBe('Tu menú');
    expect(shown[0].options).toMatchObject({ body: 'Ya está listo', icon: '/brand/logo-base.svg', badge: '/brand/logo-base.svg', data: { url: '/calendar' } });
  });

  test('push with no body still shows the generic re-engagement notification', async () => {
    await dispatch('push', pushEvent(null));

    expect(shown[0].title).toBe('Fresco');
    expect(shown[0].options.body).toBe('Tu menú de la semana te está esperando. Vuelve a planificar en un momento.');
    expect(shown[0].options.data).toEqual({ url: '/menu' });
  });

  test('push with a malformed body falls back to the same generic notification', async () => {
    await dispatch('push', pushEvent({ json: () => { throw new SyntaxError('not json'); } }));

    expect(shown).toHaveLength(1);
    expect(shown[0].title).toBe('Fresco');
    expect(shown[0].options.data).toEqual({ url: '/menu' });
  });

  const click = (data?: { url?: string }) => {
    let closed = 0;
    const notification = { close: () => { closed++; }, data };
    return { notification, closedCount: () => closed };
  };
  const client = (url: string, withNavigate: boolean) => {
    const navigated: string[] = [];
    let focused = 0;
    const fake: FakeClient = { url, focus: async () => { focused++; return fake; } };
    if (withNavigate) { fake.navigate = async (target: string) => { navigated.push(target); return fake; }; }
    return { fake, navigated, focusedCount: () => focused };
  };

  test('a click opens a new window on the target url tagged push_opened, and closes the notification', async () => {
    const { notification, closedCount } = click({ url: '/calendar' });

    await dispatch('notificationclick', { notification });

    expect(closedCount()).toBe(1);
    expect(opened).toEqual(['/calendar?push_opened=1']);
  });

  test('a click with no url goes to /menu, and an url that already has a query gets &push_opened', async () => {
    await dispatch('notificationclick', { notification: click().notification });
    await dispatch('notificationclick', { notification: click({ url: '/menu?x=1' }).notification });

    expect(opened).toEqual(['/menu?push_opened=1', '/menu?x=1&push_opened=1']);
  });

  test('a click reuses an already-open tab on that route: navigates it to the tagged url and focuses it', async () => {
    const tab = client('https://fresco.test/menu', true);
    clientList = [client('https://fresco.test/profile', true).fake, tab.fake];

    await dispatch('notificationclick', { notification: click({ url: '/menu' }).notification });

    expect(tab.navigated).toEqual(['/menu?push_opened=1']);
    expect(tab.focusedCount()).toBe(1);
    expect(opened).toEqual([]);
  });

  test('a click falls back to a plain focus when the open tab cannot navigate', async () => {
    const tab = client('https://fresco.test/menu', false);
    clientList = [tab.fake];

    await dispatch('notificationclick', { notification: click({ url: '/menu' }).notification });

    expect(tab.focusedCount()).toBe(1);
    expect(opened).toEqual([]);
  });
});
