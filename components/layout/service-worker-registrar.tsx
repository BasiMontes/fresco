'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/pwa/service-worker';

/**
 * FRESCO-979 — registers `/sw.js` for every signed-in user (mounted once, in
 * `app/(app)/layout.tsx`), so the offline screen reaches them without having to
 * enable notifications first. Founder decision 2026-10-16 (option A); the
 * worker only caches static files and is listed in the cookie policy.
 *
 * It waits for the window `load` event so it never competes with the page the
 * person came for, and renders nothing.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (document.readyState === 'complete') {
      void registerServiceWorker();
      return undefined;
    }
    const onLoad = () => { void registerServiceWorker(); };
    window.addEventListener('load', onLoad, { once: true });
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
