'use client';

import { useEffect } from 'react';
import './globals.css';

/**
 * FRESCO-46 — catches errors in the root layout itself (`app/layout.tsx`),
 * where `app/error.tsx` can't reach (it wraps everything BELOW the root
 * layout, not the layout itself — Next.js docs). Must define its own
 * `<html>`/`<body>`, since it replaces the root layout when active; skips
 * next/font (root layout is what's failing) and falls back to the
 * Caprasimo/Figtree fallback chain already declared in tailwind.config.ts.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('[app/global-error] uncaught root-layout error', error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 text-center">
          <h1 className="text-h3">Algo salió mal</h1>
          <p role="alert" aria-live="assertive" className="mt-2 text-body-sm text-tertiary">
            Fresco tuvo un problema inesperado. Intenta de nuevo.
          </p>
          <button
            type="button"
            data-testid="global_error_retry_button"
            onClick={() => unstable_retry()}
            className="mt-6 inline-flex items-center justify-center gap-2 self-center rounded-full bg-secondary px-6 py-3 text-label font-sans text-text transition-colors hover:bg-accent-2-400"
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  );
}
