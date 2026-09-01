// FRESCO-241 PR2 — web push re-engagement loop, service worker half.
//
// Scope is deliberately narrow: this file only reacts to `push` and
// `notificationclick` events. It does NOT decide when to send a
// notification (that's the weekly `pg_cron` -> Edge Function trigger,
// PR3) and does NOT know about Supabase, auth, or the
// `push_subscriptions` table — the subscribe/unsubscribe flow that talks
// to those lives in `lib/push/web-push-client.ts`, registered from the
// client via `navigator.serviceWorker.register('/sw.js')`.
//
// Registered at the root scope (`/sw.js`, not `/some/path/sw.js`) so its
// default scope covers the whole app — no `Service-Worker-Allowed` header
// needed.

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
