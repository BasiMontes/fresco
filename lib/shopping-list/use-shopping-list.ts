import type { ShoppingListPersistido } from '@/lib/api/shopping-list';
import type { ShoppingListItem, ShoppingListSuggestion } from '@/lib/api/types';
import * as React from 'react';
import { getShoppingListSuggestions } from '@/lib/api/edge-functions';
import { addShoppingListItem, clearComprados, toggleShoppingListItem } from '@/lib/api/shopping-list';
import { createClient } from '@/lib/supabase/client';

interface UseShoppingListArgs {
  list: ShoppingListPersistido
  /** Called after a failed toggle has been reverted, so the view can shake that row. */
  onToggleFailure: (target: { pasilloIdx: number, itemIdx: number }) => void
}

/**
 * State and server actions of the real shopping list (STORY-FRESCO-13).
 * `comprado` toggle calls `toggleShoppingListItem()` directly (no Edge
 * Function, per api-contracts.md §3 / the `jsonb_set_comprado` RPC), mirroring
 * `CalendarGrid`'s optimistic-update-with-revert-on-failure pattern: the
 * checkbox flips immediately, the RPC fires in the background, and a failure
 * reverts the local state + surfaces an inline error — Business Rules: purely
 * a local household action, so a failed toggle should never look like it
 * silently succeeded.
 *
 * FRESCO-809 — extracted from `ShoppingListView` so the component keeps no
 * direct Supabase access.
 */
export function useShoppingList({ list, onToggleFailure }: UseShoppingListArgs) {
  const [pasillos, setPasillos] = React.useState(list.pasillos);
  const [suggestions, setSuggestions] = React.useState<ShoppingListSuggestion[]>([]);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const supabase = React.useMemo(() => createClient(), []);
  const pasillosOriginales = React.useMemo(() => new Set(list.pasillos.map(p => p.nombre)), [list.pasillos]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadSuggestions() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { suggestions: fetched } = await getShoppingListSuggestions(
          { shopping_list_id: list.id },
          session?.access_token ?? null,
        );
        if (!cancelled) { setSuggestions(fetched); }
      }
      catch (error) {
        // Suggestions are a nice-to-have, not core list functionality — a
        // failure here shouldn't block the page or surface an error banner
        // over the real list, just show nothing.
        console.error('[ShoppingListView] getShoppingListSuggestions failed', error);
      }
    }

    void loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [list.id, supabase]);

  const pendientes = pasillos.reduce(
    (count, pasillo) => count + pasillo.items.filter(item => !item.comprado).length,
    0,
  );

  const compradosItems = pasillos.flatMap(pasillo => pasillo.items.filter(item => item.comprado));

  function setComprado({ pasilloIdx, itemIdx, comprado }: { pasilloIdx: number, itemIdx: number, comprado: boolean }) {
    setPasillos(current =>
      current.map((pasillo, pIdx) =>
        pIdx !== pasilloIdx
          ? pasillo
          : {
              ...pasillo,
              items: pasillo.items.map((item, iIdx) =>
                iIdx !== itemIdx ? item : { ...item, comprado },
              ),
            },
      ),
    );
  }

  async function handleToggle({ pasilloIdx, itemIdx, nextComprado }: { pasilloIdx: number, itemIdx: number, nextComprado: boolean }) {
    setErrorMessage(null);
    setComprado({ pasilloIdx, itemIdx, comprado: nextComprado });

    try {
      await toggleShoppingListItem(supabase, { listId: list.id, pasilloIdx, itemIdx, comprado: nextComprado });
    }
    catch (error) {
      console.error('[ShoppingListView] toggleShoppingListItem failed, reverting', error);
      setComprado({ pasilloIdx, itemIdx, comprado: !nextComprado });
      setErrorMessage('No se pudo guardar el cambio. Vuelve a intentarlo.');
      onToggleFailure({ pasilloIdx, itemIdx });
    }
  }

  /**
   * FRESCO-192-ish (receipt ticket follow-up) — was `handleClearComprados`,
   * which only un-checked items (the sole RPC that existed before
   * `jsonb_clear_comprados`). Live usage showed that reads as "nothing
   * happened": the point of "Compra realizada" is that these items are done,
   * not that they should come back as pending next render. Optimistic
   * update + revert-on-failure, same shape as `handleToggle` above.
   */
  async function removeComprados() {
    setErrorMessage(null);
    const snapshot = pasillos;
    setPasillos(current =>
      current
        .map(pasillo => ({ ...pasillo, items: pasillo.items.filter(item => !item.comprado) }))
        .filter(pasillo => pasillo.items.length > 0),
    );

    try {
      await clearComprados(supabase, list.id);
    }
    catch (error) {
      console.error('[ShoppingListView] clearComprados failed, reverting', error);
      setPasillos(snapshot);
      setErrorMessage('No se pudieron quitar los productos comprados. Vuelve a intentarlo.');
    }
  }

  async function handleAddSuggestion(suggestion: ShoppingListSuggestion) {
    setErrorMessage(null);
    const newItem: ShoppingListItem = {
      nombre: suggestion.nombre,
      cantidad: suggestion.cantidad,
      unidad: suggestion.unidad,
      comprado: false,
      precio_estimado: suggestion.precio_estimado,
    };

    setSuggestions(current => current.filter(s => s.nombre !== suggestion.nombre));
    setPasillos((current) => {
      const idx = current.findIndex(p => p.nombre === suggestion.pasillo);
      if (idx === -1) {
        return [...current, { nombre: suggestion.pasillo, orden: current.length + 1, items: [newItem] }];
      }
      return current.map((p, i) => (i === idx ? { ...p, items: [...p.items, newItem] } : p));
    });

    try {
      await addShoppingListItem(supabase, { listId: list.id, pasilloNombre: suggestion.pasillo, item: newItem });
    }
    catch (error) {
      console.error('[ShoppingListView] addShoppingListItem failed, reverting', error);
      setPasillos(current =>
        current
          .map(p => (p.nombre === suggestion.pasillo ? { ...p, items: p.items.filter(i => i !== newItem) } : p))
          .filter(p => p.items.length > 0 || pasillosOriginales.has(p.nombre)),
      );
      setSuggestions(current => [...current, suggestion]);
      setErrorMessage('No se pudo añadir el producto. Vuelve a intentarlo.');
    }
  }

  return { pasillos, suggestions, errorMessage, pendientes, compradosItems, handleToggle, removeComprados, handleAddSuggestion };
}
