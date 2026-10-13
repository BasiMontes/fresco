'use client';

import type { Captcha, CaptchaStatus } from '@/components/auth/use-captcha';
import { useEffect, useRef, useState } from 'react';
import { TURNSTILE_SITE_KEY } from '@/lib/auth/captcha';

interface TurnstileRenderOptions {
  'sitekey': string
  'callback': (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
  'before-interactive-callback': () => void
  'timeout-callback': () => void
  'theme': 'auto' | 'light' | 'dark'
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

/** How long a check may stay undecided before the person is told it is taking long and offered a retry. */
const SLOW_AFTER_MS = 10_000;
/** Turnstile's `flexible` widget is 65px tall; the reserved area never needs less. */
const AREA_MIN_HEIGHT_CLASS = 'min-h-[65px]';
// The widget's own wrapper measured 72px in a browser (the 65px frame sits inline, so the line box
// adds a descender gap). Pinning the container to 65px keeps the reserved area from growing by 7px
// the moment a challenge shows up, which is the very jump this reservation is for.
const INTERACTIVE_WIDGET_CLASS = 'h-[65px] w-full overflow-hidden leading-none';

interface StatusMessage {
  text: string
  retry: boolean
  isError: boolean
}

/**
 * What the reserved area says for each state (FRESCO-944). `challenge` has no text:
 * Cloudflare's own widget fills the area then.
 */
export function statusMessage(status: CaptchaStatus, slow: boolean): StatusMessage | null {
  switch (status) {
    case 'verifying':
      return slow
        ? { text: 'La verificación está tardando más de lo normal.', retry: true, isError: false }
        : { text: 'Comprobando que eres una persona…', retry: false, isError: false };
    case 'passed':
      return { text: 'Verificación completada.', retry: false, isError: false };
    case 'failed':
      return { text: 'No hemos podido verificarte. Inténtalo de nuevo.', retry: true, isError: true };
    case 'expired':
      return { text: 'La verificación caducó. Vuelve a comprobarla.', retry: true, isError: true };
    case 'challenge':
      return null;
  }
}

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
 * The theme the person chose in the app (`app/layout.tsx` sets `data-theme` on
 * `<html>` only for an explicit light/dark choice). `auto` follows the OS, which
 * showed a dark widget on a light page for someone whose OS is dark.
 */
function appTheme(): TurnstileRenderOptions['theme'] {
  const theme = document.documentElement.dataset.theme;
  return theme === 'light' || theme === 'dark' ? theme : 'auto';
}

/**
 * The Turnstile widget. Renders nothing when no site key is configured.
 * The token lands in `captcha.token`; a form is submittable once
 * `captcha.ready` is true. Call `captcha.reset()` after every auth request.
 *
 * By default the widget takes no room unless Cloudflare asks the person to do
 * something. With `reserveSpace` (FRESCO-944, `/login`) the area is there from
 * the first render, so the form does not jump when a challenge shows up late,
 * and it says in words where the check stands, with a retry when it ends badly.
 */
export function CaptchaField({ captcha, reserveSpace = false }: { captcha: Captcha, reserveSpace?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // True only when Cloudflare asks the person to do something.
  const interactive = captcha.status === 'challenge';
  const [slow, setSlow] = useState(false);
  const { enabled, resetKey, setToken, setStatus, status, reset } = captcha;

  useEffect(() => {
    setSlow(false);
    if (!enabled || status !== 'verifying') {
      return;
    }
    const timer = setTimeout(setSlow, SLOW_AFTER_MS, true);
    return () => clearTimeout(timer);
  }, [enabled, status, resetKey]);

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
          'expired-callback': () => {
            setToken(null);
            setStatus('expired');
          },
          'error-callback': () => {
            setToken(null);
            setStatus('failed');
          },
          'timeout-callback': () => {
            setToken(null);
            setStatus('expired');
          },
          'before-interactive-callback': () => setStatus('challenge'),
          'theme': appTheme(),
          'language': 'es',
          // `interaction-only`: hidden unless a challenge needs the person.
          // `flexible`: when it does show, it fills the form width.
          'size': 'flexible',
          'appearance': 'interaction-only',
        });
      })
      .catch(() => {
        setToken(null);
        setStatus('failed');
      });

    return () => {
      cancelled = true;
      if (widgetId !== undefined) {
        window.turnstile?.remove(widgetId);
      }
    };
  }, [enabled, resetKey, setToken, setStatus]);

  if (!enabled) {
    return null;
  }
  // `sr-only` takes the container out of the layout (no height, no flex gap)
  // while it stays in the DOM for Turnstile to render into.
  const widget = <div ref={containerRef} data-testid="captcha_widget" className={interactive ? INTERACTIVE_WIDGET_CLASS : 'sr-only'} />;
  if (!reserveSpace) {
    return widget;
  }

  const message = statusMessage(status, slow);
  return (
    <div data-testid="captcha_area" className={`flex ${AREA_MIN_HEIGHT_CLASS} flex-col items-center justify-center text-center`}>
      {widget}
      {message && (
        <p
          data-testid="captcha_status"
          role="status"
          aria-live="polite"
          className={message.isError ? 'text-body-sm text-error' : 'text-body-sm text-tertiary'}
        >
          {message.text}
        </p>
      )}
      {message?.retry && (
        <button
          type="button"
          data-testid="captcha_retry_button"
          onClick={reset}
          className="inline-flex min-h-[44px] items-center text-body-sm text-primary underline"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
