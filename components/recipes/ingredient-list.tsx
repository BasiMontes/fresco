'use client';

import type { SafeIngredientSubstitute } from '@/lib/ingredients/get-safe-substitutes';
import type { Sustitucion } from '@/lib/ingredients/get-slot-substitution-context';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { confirmSubstitution } from '@/lib/ingredients/confirm-substitution';
import { getSafeSubstitutes, IngredientSubstitutionError } from '@/lib/ingredients/get-safe-substitutes';
import { createClient } from '@/lib/supabase/client';

interface IngredientListProps {
  ingredientes: string[]
  /** Present only when this recipe is being viewed FROM a specific planned meal (FRESCO-534) — a Biblioteca-browse open never shows the "Sustituir" action. */
  slotId?: string
  initialSustitucion?: Sustitucion | null
}

/**
 * Renders a planned meal's ingredient list with an optional "sustituir"
 * action per item (FRESCO-534). Optimistic-update + revert-on-error mirrors
 * `calendar-grid.tsx`'s existing `commitMark` pattern. Once an ingredient is
 * substituted it renders as replaced, with no further action — reversing a
 * confirmed substitution is explicitly out of this story's scope.
 */
export function IngredientList({ ingredientes, slotId, initialSustitucion }: IngredientListProps) {
  const [sustitucion, setSustitucion] = React.useState<Sustitucion | null>(initialSustitucion ?? null);
  const [openFor, setOpenFor] = React.useState<string | null>(null);
  const [candidates, setCandidates] = React.useState<SafeIngredientSubstitute[] | null>(null);
  const [loadingCandidates, setLoadingCandidates] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const supabase = React.useMemo(() => createClient(), []);

  async function openDialog(ingrediente: string): Promise<void> {
    setOpenFor(ingrediente);
    setCandidates(null);
    setError(null);
    setLoadingCandidates(true);
    try {
      const result = await getSafeSubstitutes(supabase, ingrediente);
      setCandidates(result);
    }
    catch (caught) {
      console.error('[IngredientList] getSafeSubstitutes failed', caught);
      setError(caught instanceof IngredientSubstitutionError ? caught.message : 'No se pudieron buscar sustitutos.');
    }
    finally {
      setLoadingCandidates(false);
    }
  }

  async function confirm(ingrediente: string, sustituto: string): Promise<void> {
    if (!slotId) { return; }
    setConfirming(true);
    setError(null);
    const previous = sustitucion;
    setSustitucion({ original: ingrediente, sustituto });
    try {
      await confirmSubstitution(supabase, slotId, ingrediente, sustituto);
      setOpenFor(null);
    }
    catch (caught) {
      console.error('[IngredientList] confirmSubstitution failed', caught);
      setSustitucion(previous);
      setError(caught instanceof IngredientSubstitutionError ? caught.message : 'No se pudo confirmar la sustitución.');
    }
    finally {
      setConfirming(false);
    }
  }

  return (
    <>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-body-md" data-testid="recipe_detail_ingredientes">
        {ingredientes.map((ingrediente) => {
          const isSubstituted = sustitucion?.original === ingrediente;
          return (
            <li key={ingrediente} className="flex items-center justify-between gap-2">
              <span>
                {isSubstituted && sustitucion
                  ? (
                      <>
                        <span className="text-tertiary line-through">{ingrediente}</span>
                        {' → '}
                        <span className="font-semibold">{sustitucion.sustituto}</span>
                      </>
                    )
                  : ingrediente}
              </span>
              {slotId && !isSubstituted && (
                <button
                  type="button"
                  data-testid={`ingredient_substitute_trigger_${ingrediente}`}
                  className="shrink-0 text-body-sm font-semibold text-primary underline"
                  onClick={() => void openDialog(ingrediente)}
                >
                  Sustituir
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog
        open={openFor !== null}
        onOpenChange={open => !open && setOpenFor(null)}
        aria-label={openFor ? `Sustituir ${openFor}` : 'Sustituir ingrediente'}
        data-testid="ingredient_substitute_dialog"
      >
        <h2 className="text-h4">
          Sustituir "
          {openFor}
          "
        </h2>

        {loadingCandidates && (
          <p className="mt-3 text-body-sm text-tertiary">Buscando sustitutos seguros…</p>
        )}

        {!loadingCandidates && candidates !== null && candidates.length === 0 && (
          <p className="mt-3 text-body-sm text-tertiary" data-testid="ingredient_substitute_none">
            No hay ningún sustituto seguro disponible para tu perfil.
          </p>
        )}

        {!loadingCandidates && candidates !== null && candidates.length > 0 && (
          <ul className="mt-3 space-y-2">
            {candidates.map(candidate => (
              <li key={candidate.ingredienteSustituto}>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full justify-start"
                  disabled={confirming}
                  data-testid={`ingredient_substitute_option_${candidate.ingredienteSustituto}`}
                  onClick={() => openFor && void confirm(openFor, candidate.ingredienteSustituto)}
                >
                  {candidate.ingredienteSustituto}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" aria-live="assertive" className="mt-3 text-body-sm text-error" data-testid="ingredient_substitute_error">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <Button type="button" variant="secondary" onClick={() => setOpenFor(null)}>
            Cerrar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
