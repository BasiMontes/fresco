'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * FRESCO-855: shown when the catalog could not be read. The page used to fall
 * back to an empty catalog, which told the user "no hay recetas" about a
 * failure that is usually transient (the session check or the read timed out
 * under load). An error with a retry says what happened and lets them recover.
 */
export function RecipeLibraryLoadError() {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  return (
    <EmptyState
      data-testid="recipe_library_load_error"
      className="mt-6"
      icon={<RefreshCw className="size-8 text-tertiary" aria-hidden="true" />}
      title="No hemos podido cargar el catálogo"
      description="Ha fallado la lectura de las recetas. Suele ser momentáneo: inténtalo de nuevo."
      action={(
        <Button
          type="button"
          data-testid="recipe_library_retry_button"
          disabled={isPending}
          onClick={() => startTransition(() => router.refresh())}
        >
          Reintentar
        </Button>
      )}
    />
  );
}
