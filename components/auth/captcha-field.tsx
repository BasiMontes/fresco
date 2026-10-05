'use client';

import type { Captcha } from '@/lib/auth/use-captcha';
import { useEffect, useRef, useState } from 'react';
import { TURNSTILE_SITE_KEY } from '@/lib/auth/captcha';

interface TurnstileRenderOptions {
  'sitekey': string
  'callback': (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
  'before-interactive-callback': () => void
  'theme': 'auto'
  'language': string
  'size': 'flexible'
  'appearance': 'interaction-only'
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
  // True only when Cloudflare asks the person to do something. Almost every
  // visitor passes silently, and then the widget takes no room on the page.
  const [interactive, setInteractive] = useState(false);
  const { enabled, resetKey, setToken } = captcha;

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) {
      return;
    }
    let cancelled = false;
    let widgetId: string | undefined;
    setInteractive(false);

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
          'before-interactive-callback': () => setInteractive(true),
          'theme': 'auto',
          'language': 'es',
          // `interaction-only`: hidden unless a challenge needs the person.
          // `flexible`: when it does show, it fills the form width.
          'size': 'flexible',
          'appearance': 'interaction-only',
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
  // `sr-only` takes the container out of the layout (no height, no flex gap)
  // while it stays in the DOM for Turnstile to render into.
  return <div ref={containerRef} data-testid="captcha_widget" className={interactive ? 'min-h-[65px]' : 'sr-only'} />;
}
