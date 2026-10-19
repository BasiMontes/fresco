import type { ShoppingListPersistido } from '@/lib/api/shopping-list';
import type { ShoppingListSuggestion } from '@/lib/api/types';
import * as React from 'react';
import { addSuggestionToPasillos, countPendientes, removeAddedItem, suggestionFromAddedItem } from '@/components/shopping-list/added-suggestions';
import { getShoppingListSuggestions } from '@/lib/api/edge-functions';
import { getAccessToken } from '@/lib/client-api/auth';
import { addShoppingListItem, clearComprados, removeShoppingListItem, toggleShoppingListItem } from '@/lib/client-api/shopping-list';

/** FRESCO-1014: shown while ticks are waiting for the connection. */
const OFFLINE_MESSAGE = 'Sin conexión. Hemos dejado marcado el producto y lo guardaremos cuando vuelva la señal. Mantén esta pantalla abierta.';

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
  // FRESCO-1014 (A7-UI-10): ticks that could not reach the server for lack of signal, kept here (name-keyed, so
  // they survive the list changing under them) and sent when the connection returns. In memory only: they
  // live as long as this screen does, which the notice says.
  const pendingToggles = React.useRef(new Map<string, { pasilloNombre: string, itemNombre: string, comprado: boolean }>());
  const pasillosRef = React.useRef(pasillos);
  React.useEffect(() => {
    pasillosRef.current = pasillos;
  }, [pasillos]);
  const pasillosOriginales = React.useMemo(() => new Set(list.pasillos.map(p => p.nombre)), [list.pasillos]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadSuggestions() {
      try {
        const accessToken = await getAccessToken();
        const { suggestions: fetched } = await getShoppingListSuggestions(
          { shopping_list_id: list.id },
          accessToken,
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
  }, [list.id]);

  const pendientes = countPendientes(pasillos);

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

  /** Sends every tick that was waiting for the connection; whatever still fails stays queued. */
  const flushPendingToggles = React.useCallback(async () => {
    for (const [key, pending] of [...pendingToggles.current]) {
      const pasilloIdx = pasillosRef.current.findIndex(p => p.nombre === pending.pasilloNombre);
      const itemIdx = pasilloIdx < 0 ? -1 : pasillosRef.current[pasilloIdx].items.findIndex(i => i.nombre === pending.itemNombre);
      if (itemIdx < 0) {
        // The item is gone from the list (bought and cleared, removed): nothing left to tick.
        pendingToggles.current.delete(key);
        continue;
      }
      try {
        await toggleShoppingListItem({ listId: list.id, pasilloIdx, itemIdx, comprado: pending.comprado });
        pendingToggles.current.delete(key);
      }
      catch (error) {
        console.error('[ShoppingListView] queued toggle still failing, kept for later', error);
        return;
      }
    }
    if (pendingToggles.current.size === 0) {
      setErrorMessage(current => (current === OFFLINE_MESSAGE ? null : current));
    }
  }, [list.id]);

  React.useEffect(() => {
    const onOnline = () => void flushPendingToggles();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushPendingToggles]);

  async function handleToggle({ pasilloIdx, itemIdx, nextComprado }: { pasilloIdx: number, itemIdx: number, nextComprado: boolean }) {
    setErrorMessage(null);
    setComprado({ pasilloIdx, itemIdx, comprado: nextComprado });

    try {
      await toggleShoppingListItem({ listId: list.id, pasilloIdx, itemIdx, comprado: nextComprado });
      // The connection is back: send what was waiting.
      if (pendingToggles.current.size > 0) { void flushPendingToggles(); }
    }
    catch (error) {
      // FRESCO-1014 (A7-UI-10): in a shop with no signal the tick must not silently undo itself. Offline, keep it
      // ticked, queue it for when the connection returns and say so in an alert the person can see; any other
      // failure (the server refused it) reverts the tick, with the same visible alert.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.error('[ShoppingListView] toggleShoppingListItem failed offline, queued', error);
        const pasillo = pasillosRef.current[pasilloIdx];
        const item = pasillo?.items[itemIdx];
        if (pasillo && item) {
          pendingToggles.current.set(`${pasillo.nombre}::${item.nombre}`, { pasilloNombre: pasillo.nombre, itemNombre: item.nombre, comprado: nextComprado });
        }
        setErrorMessage(OFFLINE_MESSAGE);
        return;
      }
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
      await clearComprados(list.id);
    }
    catch (error) {
      console.error('[ShoppingListView] clearComprados failed, reverting', error);
      setPasillos(snapshot);
      setErrorMessage('No se pudieron quitar los productos comprados. Vuelve a intentarlo.');
    }
  }

  /**
   * FRESCO-948 — the item keeps living in its aisle (so the toggle coordinates
   * are unchanged) but carries `origen: 'sugerencia'`, and the view shows it in
   * the "Sugerencias para ti" section right under the card the person just
   * tapped. Revert-on-failure like every other action here.
   */
  async function handleAddSuggestion(suggestion: ShoppingListSuggestion) {
    setErrorMessage(null);
    const { item: newItem } = addSuggestionToPasillos([], suggestion);

    setSuggestions(current => current.filter(s => s.nombre !== suggestion.nombre));
    setPasillos(current => addSuggestionToPasillos(current, suggestion).pasillos);

    try {
      await addShoppingListItem({ listId: list.id, pasilloNombre: suggestion.pasillo, item: newItem });
    }
    catch (error) {
      console.error('[ShoppingListView] addShoppingListItem failed, reverting', error);
      setPasillos(current =>
        removeAddedItem(current, { pasilloNombre: suggestion.pasillo, itemNombre: suggestion.nombre, pasillosOriginales }),
      );
      setSuggestions(current => [...current, suggestion]);
      setErrorMessage('No se pudo añadir el producto. Vuelve a intentarlo.');
    }
  }

  /** FRESCO-948 — "Quitar": takes an added suggestion off the list and puts its card back in the carousel. */
  async function handleRemoveSuggestion({ pasilloNombre, itemNombre }: { pasilloNombre: string, itemNombre: string }) {
    setErrorMessage(null);
    const snapshot = pasillos;
    const target = snapshot.find(p => p.nombre === pasilloNombre)?.items.find(i => i.nombre === itemNombre && i.origen === 'sugerencia');
    if (!target) { return; }

    setPasillos(current => removeAddedItem(current, { pasilloNombre, itemNombre, pasillosOriginales }));
    setSuggestions(current => [...current.filter(s => s.nombre !== itemNombre), suggestionFromAddedItem(pasilloNombre, target)]);

    try {
      await removeShoppingListItem({ listId: list.id, pasilloNombre, itemNombre });
    }
    catch (error) {
      console.error('[ShoppingListView] removeShoppingListItem failed, reverting', error);
      setPasillos(snapshot);
      setSuggestions(current => current.filter(s => s.nombre !== itemNombre));
      setErrorMessage('No se pudo quitar el producto. Vuelve a intentarlo.');
    }
  }

  return { pasillos, suggestions, errorMessage, pendientes, compradosItems, handleToggle, removeComprados, handleAddSuggestion, handleRemoveSuggestion };
}
