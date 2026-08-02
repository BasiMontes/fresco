'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * FRESCO-46 — root safety net: catches any uncaught error below the root
 * layout that no closer `error.tsx` handles (none exist elsewhere yet), so
 * a rendering bug falls back to this branded page instead of Next's
 * unstyled default. `unstable_retry` (Next 16.2's replacement for `reset`,
 * per this repo's pinned Next docs) re-renders the failed segment; the
 * `/menu` link is the same "always-safe destination" every other page here
 * falls back to on a real read failure.
 */
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('[app/error] uncaught error', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Card className="text-center">
        <h1 className="text-h3">Algo salió mal</h1>
        <p role="alert" aria-live="assertive" className="mt-2 text-body-sm text-tertiary">
          Tuvimos un problema inesperado. Puedes intentarlo de nuevo o volver al inicio.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button data-testid="error_retry_button" variant="action" onClick={() => unstable_retry()}>
            Intentar de nuevo
          </Button>
          <Link data-testid="error_home_link" href="/menu" className={buttonVariants({ variant: 'secondary' })}>
            Volver al inicio
          </Link>
        </div>
      </Card>
    </div>
  );
}
