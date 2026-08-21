'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { deleteRecetaPropia, RecipesError } from '@/lib/api/recipes';
import { createClient } from '@/lib/supabase/client';

/**
 * FRESCO-236 — deletes the currently-viewed personal recipe. Same Cancel/
 * Confirm `Dialog` gate as `components/calendar/delete-week-button.tsx`, but
 * navigates away with `router.push('/recipes')` instead of `router.refresh()`
 * on success — this button lives on the recipe's own detail page, which no
 * longer exists once the recipe is deleted.
 */
export function DeleteRecipeButton({ recetaId }: { recetaId: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const supabase = React.useMemo(() => createClient(), []);

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      await deleteRecetaPropia(supabase, recetaId);
      router.push('/recipes');
    }
    catch (caught) {
      const message = caught instanceof RecipesError ? caught.message : 'No se pudo eliminar la receta.';
      console.error('[DeleteRecipeButton] deleteRecetaPropia failed', caught);
      setError(message);
      setPending(false);
    }
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="icon"
        size="sm"
        aria-label="Eliminar esta receta"
        data-testid="delete_recipe_button"
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="size-6 text-error" />
      </Button>
      {error && (
        <p
          data-testid="delete_recipe_error_message"
          role="alert"
          aria-live="assertive"
          className="absolute right-0 top-full mt-1 whitespace-nowrap text-body-sm text-error"
        >
          {error}
        </p>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        aria-label="Eliminar esta receta"
        data-testid="delete_recipe_confirm_dialog"
      >
        <h2 className="text-h4 text-error">¿Eliminar esta receta?</h2>
        <p className="mt-2 text-body-sm text-tertiary">
          Se borrará esta receta de tu biblioteca. Esta acción no se puede deshacer.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirmOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="border-error text-error hover:bg-error hover:text-background"
            disabled={pending}
            data-testid="delete_recipe_confirm_button"
            onClick={() => {
              setConfirmOpen(false);
              void handleDelete();
            }}
          >
            {pending ? 'Eliminando…' : 'Eliminar receta'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
