'use client';

import type { OpenSlot } from '@/lib/api/open-slots';
import type { TipoPlato } from '@/lib/api/types';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { assignRecipeToSlot, listOpenSlots } from '@/lib/client-api/meal-plan';
import { capitalize } from '@/lib/utils';

export interface AddToMenuRecipe {
  id: string
  nombre: string
  tipoPlato: TipoPlato
}

export interface AddToMenuDialogProps {
  /** The recipe to add; `null` closes the dialog. */
  recipe: AddToMenuRecipe | null
  onClose: () => void
}

type Phase
  = | { name: 'loading' }
    | { name: 'ready', slots: OpenSlot[], tieneListaCompra: boolean }
    | { name: 'saving', slots: OpenSlot[], tieneListaCompra: boolean }
    | { name: 'done', slot: OpenSlot, tieneListaCompra: boolean }
    | { name: 'load-error' };

const DAY_FORMAT = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function slotLabel(slot: OpenSlot): string {
  return `${capitalize(DAY_FORMAT.format(new Date(`${slot.fecha}T00:00:00Z`)))} · ${capitalize(slot.tipoPlato)}`;
}

/** The server's reason, in words a person can act on. The raw RPC message never reaches the screen. */
function friendlyError(message: string): string {
  if (message.includes('rate limit')) { return 'Has hecho demasiados cambios seguidos. Inténtalo de nuevo más tarde.'; }
  if (message.includes('not available for this profile')) { return 'Esta receta no encaja con tu perfil alimentario, así que no se puede añadir.'; }
  if (message.includes('does not match')) { return 'Esa receta no es del mismo tipo de plato que el hueco.'; }
  if (message.includes('not open') || message.includes('past day') || message.includes('slot not found')) { return 'Ese hueco ya no está disponible. Elige otro.'; }
  return 'No se pudo añadir la receta. Inténtalo de nuevo.';
}

/**
 * FRESCO-878 — "añadir al menú" from a Biblioteca card. Offers only the open
 * slots of the current week with the recipe's own meal type, today or later;
 * `assign_recipe_to_slot` re-checks all of it (and the food-safety profile) in
 * the database, so what this list shows is a convenience, never the guard.
 *
 * It replaces the slot's recipe, so the confirmation says so, and it warns
 * when a shopping list was already generated: that list does not change.
 */
export function AddToMenuDialog({ recipe, onClose }: AddToMenuDialogProps) {
  const router = useRouter();
  // Keep the last recipe while the dialog plays its close transition.
  const shownRecipe = React.useRef<AddToMenuRecipe | null>(recipe);
  if (recipe) { shownRecipe.current = recipe; }
  const current = recipe ?? shownRecipe.current;

  const [phase, setPhase] = React.useState<Phase>({ name: 'loading' });
  const [selectedSlotId, setSelectedSlotId] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);

  const recipeId = recipe?.id;
  const tipoPlato = recipe?.tipoPlato;

  React.useEffect(() => {
    if (!recipeId || !tipoPlato) { return; }
    let cancelled = false;
    setPhase({ name: 'loading' });
    setSelectedSlotId(null);
    setSaveError(null);

    listOpenSlots({ tipoPlato })
      .then(({ slots, tieneListaCompra }) => {
        if (!cancelled) { setPhase({ name: 'ready', slots, tieneListaCompra }); }
      })
      .catch((error: unknown) => {
        console.error('[AddToMenuDialog] could not load the open slots', error);
        if (!cancelled) { setPhase({ name: 'load-error' }); }
      });

    return () => { cancelled = true; };
  }, [recipeId, tipoPlato, attempt]);

  async function handleConfirm() {
    if (phase.name !== 'ready' || !selectedSlotId || !recipe) { return; }
    const slot = phase.slots.find(candidate => candidate.slotId === selectedSlotId);
    if (!slot) { return; }

    setSaveError(null);
    setPhase({ name: 'saving', slots: phase.slots, tieneListaCompra: phase.tieneListaCompra });
    try {
      await assignRecipeToSlot({ slotId: slot.slotId, recipeId: recipe.id });
      setPhase({ name: 'done', slot, tieneListaCompra: phase.tieneListaCompra });
    }
    catch (error) {
      console.error('[AddToMenuDialog] assign failed', error);
      setSaveError(friendlyError(error instanceof Error ? error.message : ''));
      setPhase({ name: 'ready', slots: phase.slots, tieneListaCompra: phase.tieneListaCompra });
    }
  }

  return (
    <Dialog
      open={recipe !== null}
      onOpenChange={(open) => { if (!open) { onClose(); } }}
      aria-label="Añadir al menú"
      data-testid="add_to_menu_dialog"
    >
      <h2 className="text-h4">Añadir al menú</h2>
      {current && (
        <p className="mt-2 text-body-sm text-tertiary">
          Elige el hueco de
          {' '}
          {current.tipoPlato}
          {' '}
          que quieres sustituir por
          {' '}
          <strong className="text-text">{current.nombre}</strong>
          .
        </p>
      )}

      {phase.name === 'loading' && (
        <p className="mt-4 text-body-sm text-tertiary" role="status" data-testid="add_to_menu_loading">Buscando huecos en tu menú…</p>
      )}

      {phase.name === 'load-error' && (
        <div className="mt-4" role="alert" data-testid="add_to_menu_load_error">
          <p className="text-body-sm text-error">No pudimos leer tu menú.</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => setAttempt(value => value + 1)}>
            Reintentar
          </Button>
        </div>
      )}

      {(phase.name === 'ready' || phase.name === 'saving') && phase.slots.length === 0 && (
        <p className="mt-4 text-body-sm text-tertiary" data-testid="add_to_menu_empty_state">
          No te quedan huecos de
          {' '}
          {current?.tipoPlato}
          {' '}
          libres en el menú de esta semana.
        </p>
      )}

      {(phase.name === 'ready' || phase.name === 'saving') && phase.slots.length > 0 && (
        <fieldset className="mt-4 flex flex-col gap-2" disabled={phase.name === 'saving'}>
          <legend className="sr-only">Huecos disponibles</legend>
          {phase.slots.map(slot => (
            <label
              key={slot.slotId}
              className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-card border border-neutral-600 px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-accent-100"
            >
              <input
                type="radio"
                name="add-to-menu-slot"
                value={slot.slotId}
                checked={selectedSlotId === slot.slotId}
                onChange={() => setSelectedSlotId(slot.slotId)}
                className="size-4 accent-primary"
                data-testid="add_to_menu_slot_option"
              />
              <span className="flex flex-col">
                <span className="text-body-sm">{slotLabel(slot)}</span>
                <span className="text-body-sm text-tertiary">
                  {slot.recetaActual ? `Ahora: ${slot.recetaActual}` : 'Sin receta'}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {saveError && (
        <p className="mt-3 text-body-sm text-error" role="alert" data-testid="add_to_menu_error">{saveError}</p>
      )}

      {phase.name === 'done' && (
        <div className="mt-4" role="status" data-testid="add_to_menu_success">
          <p className="text-body-sm">
            Hecho: «
            {current?.nombre}
            » sustituye a la
            {' '}
            {phase.slot.tipoPlato}
            {' '}
            del
            {' '}
            {slotLabel(phase.slot).split(' · ')[0].toLowerCase()}
            .
          </p>
          {phase.tieneListaCompra && (
            <p className="mt-2 text-body-sm text-tertiary" data-testid="add_to_menu_stale_list_notice">
              Tu lista de la compra ya estaba generada y no incluye este cambio.
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        {phase.name === 'done'
          ? (
              <>
                <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
                <Button type="button" onClick={() => { onClose(); router.push('/calendar'); }} data-testid="add_to_menu_view_calendar_button">
                  Ver calendario
                </Button>
              </>
            )
          : (
              <>
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button
                  type="button"
                  data-testid="add_to_menu_confirm_button"
                  disabled={phase.name !== 'ready' || selectedSlotId === null}
                  onClick={() => { void handleConfirm(); }}
                >
                  {phase.name === 'saving' ? 'Añadiendo…' : 'Añadir al menú'}
                </Button>
              </>
            )}
      </div>
    </Dialog>
  );
}
