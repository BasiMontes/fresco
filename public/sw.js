// FRESCO-241 PR2 — web push re-engagement loop, service worker half.
// FRESCO-979 — plus an offline fallback screen.
//
// Scope is deliberately narrow. This file does two things and nothing else:
//   1. reacts to `push` and `notificationclick` events (FRESCO-241). It does
//      NOT decide when to send a notification (that's the weekly `pg_cron` ->
//      Edge Function trigger) and does NOT know about Supabase, auth, or the
//      `push_subscriptions` table — the subscribe/unsubscribe flow that talks
//      to those lives in `lib/push/web-push-client.ts`;
//   2. when a NAVIGATION fails because there is no connection, answers with the
//      precached `/offline.html` instead of the browser's error page.
//
// Rules for (2), which are what keep this safe for every signed-in user
// (it is registered by `components/layout/service-worker-registrar.tsx`):
//   - It caches ONLY the static file in PRECACHE_URLS (`/offline.html`, which is
//     self-contained: inline styles and logo), at install time and, if it ever
//     goes missing, again after a navigation that reached the server.
//     It never stores a response to a navigation or an API call, so no page
//     with account data ever lands in the Cache Storage.
//   - It touches ONLY `navigate` requests. Scripts, images, API calls and
//     everything else go straight to the network, untouched.
//   - A navigation that reaches the server is returned as it came, including a
//     5xx: only a network failure falls back to the offline screen.
//
// Kill switch: if this worker ever misbehaves, publish a `sw.js` that calls
// `globalThis.registration.unregister()` in `activate`; the next visit replaces
// this one and the browser goes back to having no worker.
//
// Registered at the root scope (`/sw.js`, not `/some/path/sw.js`) so its
// default scope covers the whole app — no `Service-Worker-Allowed` header
// needed.

// Bump the suffix when the precached files change: `activate` deletes every
// `fresco-offline-*` cache that is not this one.
const OFFLINE_CACHE = 'fresco-offline-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [OFFLINE_URL];

function precache() {
  return globalThis.caches.open(OFFLINE_CACHE).then(cache => cache.addAll(PRECACHE_URLS));
}

// Self-repair: the cache can be missing while the worker is active (a browser
// that evicted it under storage pressure, a manual cache clear). Refill it after
// the next navigation that reached the server, so the screen is there the next
// time the connection drops. It stores the static file only, never the page.
async function ensurePrecached() {
  const cached = await globalThis.caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE });
  if (!cached) {
    await precache();
  }
}

globalThis.addEventListener('install', (event) => {
  event.waitUntil(
    precache()
      // A worker that was already installed (push subscribers) takes over now
      // instead of waiting for every tab to close.
      .then(() => globalThis.skipWaiting()),
  );
});

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(
    globalThis.caches
      .keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('fresco-offline-') && key !== OFFLINE_CACHE)
          .map(key => globalThis.caches.delete(key)),
      ))
      .then(() => globalThis.clients.claim()),
  );
});

globalThis.addEventListener('fetch', (event) => {
  const { request } = event;
  // Not a page navigation: leave it to the browser, no `respondWith`.
  if (request.mode !== 'navigate' || request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(request).then(
      (response) => {
        event.waitUntil(ensurePrecached().catch(() => undefined));
        return response;
      },
      async () => {
        const offline = await globalThis.caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE });
        return offline || Response.error();
      },
    ),
  );
});

globalThis.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  }
  catch {
    // A push with no JSON body (or a malformed one) still shows a
    // generic re-engagement notification rather than silently no-op'ing —
    // a delivered push with no visible notification looks like a bug to
    // the user, not a graceful fallback.
    payload = {};
  }

  const title = payload.title || 'Fresco';
  const body = payload.body || 'Tu menú de la semana te está esperando. Vuelve a planificar en un momento.';
  // PR3's send logic decides the real deep-link per notification; `/menu`
  // is the sane default landing screen for a re-engagement ping either way.
  const url = payload.url || '/menu';

  event.waitUntil(
    globalThis.registration.showNotification(title, {
      body,
      icon: '/brand/logo-base.svg',
      badge: '/brand/logo-base.svg',
      data: { url },
    }),
  );
});

globalThis.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const baseUrl = (event.notification.data && event.notification.data.url) || '/menu';
  // FRESCO-372 (A4-H15): tags the click so the client app can fire
  // `push_opened` once it loads — `PushOpenedTracker` on /menu strips this
  // again immediately, so it never shows up in the visible URL or history.
  const targetUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}push_opened=1`;

  event.waitUntil(
    globalThis.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an already-open tab on the target route instead of always
      // opening a new one — a re-engagement notification shouldn't pile up
      // duplicate tabs for a user who already has the app open. Compared
      // against `baseUrl`'s pathname (not `targetUrl`, which carries the
      // FRESCO-372 push_opened query param `client.url` won't have yet).
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === baseUrl && 'focus' in client) {
          // FRESCO-372: an already-open tab needs `navigate()`, not just
          // `focus()`, or it never picks up `?push_opened=1` and the open
          // never gets counted. `navigate` is unsupported in a few older
          // engines — fall back to a plain focus rather than throwing.
          if ('navigate' in client) {
            return client.navigate(targetUrl).then(navigated => (navigated || client).focus());
          }
          return client.focus();
        }
      }
      if (globalThis.clients.openWindow) {
        return globalThis.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
