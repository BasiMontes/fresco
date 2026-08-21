'use client';

import type { RecetaPropia } from '@schemas';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { createRecetaPropia, updateRecetaPropia } from '@/lib/api/recipes';
import { createClient } from '@/lib/supabase/client';

/** One line per item — matches how a user naturally types a list in a plain textarea. */
function linesToItems(value: string): string[] {
  return value.split('\n').map(line => line.trim()).filter(line => line.length > 0);
}

/** Inverse of `linesToItems` — pre-fills the textarea from a saved recipe's array. */
function itemsToLines(items: string[]): string {
  return items.join('\n');
}

export interface CreateRecipeFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (receta: RecetaPropia) => void
  /** Present → edit mode: pre-fills the fields and calls `updateRecetaPropia` instead of `createRecetaPropia` (FRESCO-236). */
  receta?: RecetaPropia
}

/**
 * "Crear propia" / "Editar receta" dialog (FRESCO-68, edit mode added
 * FRESCO-236). Required-nombre validation mirrors
 * `components/profile/nombre-form.tsx` exactly — touched-gated, silent until
 * the field is dirtied, disabled submit while invalid or saving. No
 * textarea primitive exists yet in this design system (same gap `FilterSelect`
 * hit for `<select>` in FRESCO-67) — styled inline to match `Input`'s shape.
 */
export function CreateRecipeForm({ open, onOpenChange, onCreated, receta }: CreateRecipeFormProps) {
  const isEditMode = receta !== undefined;
  const [nombre, setNombre] = useState(receta?.nombre ?? '');
  const [ingredientesText, setIngredientesText] = useState(itemsToLines(receta?.ingredientes ?? []));
  const [pasosText, setPasosText] = useState(itemsToLines(receta?.pasos ?? []));
  const [touched, setTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const trimmedNombre = nombre.trim();
  const isValid = trimmedNombre.length > 0;

  function reset() {
    setNombre(receta?.nombre ?? '');
    setIngredientesText(itemsToLines(receta?.ingredientes ?? []));
    setPasosText(itemsToLines(receta?.pasos ?? []));
    setTouched(false);
    setSaveError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!isValid) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const client = createClient();
      const input = {
        nombre: trimmedNombre,
        ingredientes: linesToItems(ingredientesText),
        pasos: linesToItems(pasosText),
      };
      const savedReceta = isEditMode
        ? await updateRecetaPropia(client, receta.id, input)
        : await createRecetaPropia(client, input);
      onCreated(savedReceta);
      reset();
      onOpenChange(false);
    }
    catch (error) {
      console.error('[CreateRecipeForm] save failed', error);
      setSaveError('No se pudo guardar tu receta. Inténtalo de nuevo.');
    }
    finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      aria-label={isEditMode ? 'Editar receta' : 'Crear receta propia'}
      data-testid="create_recipe_dialog"
    >
      <h2 className="text-h4">{isEditMode ? 'Editar receta' : 'Crear receta propia'}</h2>
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="mt-4 flex flex-col gap-3"
      >
        <div>
          <label htmlFor="receta_nombre_input" className="text-body-sm text-tertiary">Nombre</label>
          <Input
            id="receta_nombre_input"
            data-testid="receta_nombre_input"
            type="text"
            placeholder="Nombre de la receta"
            maxLength={100}
            value={nombre}
            onChange={(event) => {
              setNombre(event.target.value);
              setTouched(true);
            }}
            className={touched && !isValid ? 'border-error' : ''}
          />
          {touched && !isValid && (
            <p data-testid="receta_nombre_validation_message" role="alert" aria-live="polite" className="mt-1 text-body-sm text-error">
              Indica un nombre para guardar la receta.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="receta_ingredientes_input" className="text-body-sm text-tertiary">Ingredientes (uno por línea)</label>
          <textarea
            id="receta_ingredientes_input"
            data-testid="receta_ingredientes_input"
            rows={4}
            value={ingredientesText}
            onChange={event => setIngredientesText(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-body-md text-text placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="receta_pasos_input" className="text-body-sm text-tertiary">Pasos (uno por línea)</label>
          <textarea
            id="receta_pasos_input"
            data-testid="receta_pasos_input"
            rows={4}
            value={pasosText}
            onChange={event => setPasosText(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-body-md text-text placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        {saveError && (
          <p data-testid="receta_save_error_message" role="alert" aria-live="assertive" className="text-body-sm text-error">
            {saveError}
          </p>
        )}

        <div>
          <Button type="submit" variant="action" disabled={!isValid || isSaving} data-testid="guardar_receta_button">
            {isSaving ? 'Guardando…' : (isEditMode ? 'Guardar cambios' : 'Guardar receta')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
