'use client';

import { Trash2 } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { deleteCatalogRecipe, EdgeFunctionError } from '@/lib/api/edge-functions';
import { createClient } from '@/lib/supabase/client';

export interface DeleteCatalogRecipeButtonProps {
  recipeId: string
  recipeName: string
  /** Called once the delete succeeds — the row is this list's to remove, not this button's. */
  onDeleted: (recipeId: string) => void
}

/**
 * FRESCO-237 PR3 — deletes a catalog recipe from the admin search list.
 * Same Cancel/Confirm `Dialog` gate as `components/recipes/delete-recipe-
 * button.tsx`, but calls the `delete-catalog-recipe` Edge Function (via
 * `lib/api/edge-functions.ts`) instead of a direct table delete — `recipes`
 * has no authenticated-role write RLS policy, so this always goes through
 * the service-role-backed function, admin gate and all. A 409 here means the
 * recipe is still referenced by at least one `meal_plan_recipes` row; that
 * message comes straight from the Edge Function via `EdgeFunctionError`.
 */
export function DeleteCatalogRecipeButton({ recipeId, recipeName, onDeleted }: DeleteCatalogRecipeButtonProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      await deleteCatalogRecipe({ recipe_id: recipeId }, session?.access_token ?? null);
      onDeleted(recipeId);
    }
    catch (caught) {
      const message = caught instanceof EdgeFunctionError ? caught.body.error : 'No se pudo eliminar la receta.';
      console.error('[DeleteCatalogRecipeButton] deleteCatalogRecipe failed', caught);
      setError(message);
      setPending(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <Button
        type="button"
        variant="icon"
        size="sm"
        aria-label={`Eliminar "${recipeName}" del catálogo`}
        data-testid="delete_catalog_recipe_button"
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="size-5 text-error" />
      </Button>
      {error && (
        <p
          data-testid="delete_catalog_recipe_error_message"
          role="alert"
          aria-live="assertive"
          className="absolute right-0 top-full mt-1 w-64 text-right text-body-sm text-error"
        >
          {error}
        </p>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        aria-label={`Eliminar "${recipeName}" del catálogo`}
        data-testid="delete_catalog_recipe_confirm_dialog"
      >
        <h2 className="text-h4 text-error">
          ¿Eliminar &quot;
          {recipeName}
          &quot; del catálogo?
        </h2>
        <p className="mt-2 text-body-sm text-tertiary">
          Se borrará esta receta del catálogo para todos los usuarios. Esta acción no se puede deshacer.
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
            data-testid="delete_catalog_recipe_confirm_button"
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
