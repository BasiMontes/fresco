'use client';

import type { RecetaPropia } from '@schemas';
import { Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { CreateRecipeForm } from '@/components/recipes/create-recipe-form';
import { DeleteRecipeButton } from '@/components/recipes/delete-recipe-button';
import { Button } from '@/components/ui/button';

/**
 * FRESCO-236 — edit/delete actions for a personal recipe's detail page.
 * A dedicated client wrapper: `recipe-detail.tsx`'s `PersonalRecipeDetail` is
 * a Server Component (rendered from `app/(app)/recipes/[id]/page.tsx`), so
 * the dialog-open state and the edit form both need to live behind their own
 * `'use client'` boundary, same as `FavoriteToggleButton` does for the
 * catalog branch.
 */
export function PersonalRecipeActions({ receta }: { receta: RecetaPropia }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="icon"
        size="sm"
        aria-label="Editar esta receta"
        data-testid="edit_recipe_button"
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="size-6" />
      </Button>
      <DeleteRecipeButton recetaId={receta.id} />

      <CreateRecipeForm
        open={editOpen}
        onOpenChange={setEditOpen}
        receta={receta}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}
