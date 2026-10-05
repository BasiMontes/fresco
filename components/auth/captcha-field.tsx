'use client';

import type { Captcha } from '@/lib/auth/use-captcha';
import { useEffect, useRef } from 'react';
import { TURNSTILE_SITE_KEY } from '@/lib/auth/captcha';

interface TurnstileRenderOptions {
  'sitekey': string
  'callback': (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
  'theme': 'auto'
  'language': string
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise: Promise<TurnstileApi> | null = null;

/**
 * Loads Cloudflare's script once per page. Injected from our own (nonce'd)
 * bundle, which the CSP's `'strict-dynamic'` trusts (`lib/security/csp.ts`).
 */
async function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) {
    return window.turnstile;
  }
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      }
      else {
        reject(new Error('turnstile script loaded without window.turnstile'));
      }
    };
    script.onerror = () => reject(new Error('turnstile script failed to load'));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    // Let the next mount retry instead of caching a failure for the whole session.
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

/**
 * The Turnstile widget. Renders nothing when no site key is configured.
 * The token lands in `captcha.token`; a form is submittable once
 * `captcha.ready` is true. Call `captcha.reset()` after every auth request.
 */
export function CaptchaField({ captcha }: { captcha: Captcha }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { enabled, resetKey, setToken } = captcha;

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) {
      return;
    }
    let cancelled = false;
    let widgetId: string | undefined;

    loadTurnstile()
      .then((api) => {
        if (cancelled) {
          return;
        }
        widgetId = api.render(container, {
          'sitekey': TURNSTILE_SITE_KEY,
          'callback': token => setToken(token),
          'expired-callback': () => setToken(null),
          'error-callback': () => setToken(null),
          'theme': 'auto',
          'language': 'es',
        });
      })
      .catch(() => setToken(null));

    return () => {
      cancelled = true;
      if (widgetId !== undefined) {
        window.turnstile?.remove(widgetId);
      }
    };
  }, [enabled, resetKey, setToken]);

  if (!enabled) {
    return null;
  }
  return <div ref={containerRef} data-testid="captcha_widget" className="min-h-[65px]" />;
}
