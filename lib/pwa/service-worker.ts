/**
 * FRESCO-979 — the single source of truth for the service worker URL and the
 * one place that registers it for every signed-in user.
 *
 * `public/sw.js` serves the offline screen (and, since FRESCO-241, handles web
 * push). Registering it is idempotent: `register()` resolves with the existing
 * registration when one already matches the script URL, so the push opt-in in
 * `lib/push/web-push-client.ts` and the registrar below can both call it.
 */

export const SERVICE_WORKER_URL = '/sw.js';

/** Whether this browser can run a service worker at all (old engines, some in-app browsers can't). */
function isServiceWorkerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

/**
 * Registers `/sw.js` at the root scope. Never throws: the worker is an
 * enhancement (an offline screen), so a failed registration must not touch the
 * page that asked for it. Resolves `null` when unsupported or when it failed.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    return null;
  }
  try {
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  }
  catch (error) {
    console.warn('[service-worker] registration failed', error);
    return null;
  }
}
