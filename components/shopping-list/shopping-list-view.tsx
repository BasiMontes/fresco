'use client';

import type { ShoppingListPersistido } from '@/lib/api/shopping-list';
import * as React from 'react';
import { Card } from '@/components/ui/card';
import { toggleShoppingListItem } from '@/lib/api/shopping-list';
import { createClient } from '@/lib/supabase/client';

export interface ShoppingListViewProps {
  list: ShoppingListPersistido
}

/**
 * FRESCO-180 — `unidad` is free text from the shopping-list Edge Function
 * (Gemini classification, `lib/api/types.ts`'s `unidad: string`), not a
 * fixed union, so this only singularizes the one unit the QA sweep actually
 * found broken ("1 unidades") rather than guessing a general Spanish
 * pluralization rule for units we have no confirmed data on.
 */
function formatUnidad(cantidad: number, unidad: string): string {
  return cantidad === 1 && unidad === 'unidades' ? 'unidad' : unidad;
}

/**
 * Real shopping list (STORY-FRESCO-13) — replaces the old `MOCK_SHOPPING_LIST`
 * shell. `comprado` toggle calls `toggleShoppingListItem()` directly (no
 * Edge Function, per api-contracts.md §3 / the `jsonb_set_comprado` RPC),
 * mirroring `CalendarGrid`'s optimistic-update-with-revert-on-failure
 * pattern: the checkbox flips immediately, the RPC fires in the background,
 * and a failure reverts the local state + surfaces an inline error —
 * Business Rules: purely a local household action, so a failed toggle
 * should never look like it silently succeeded.
 */
export function ShoppingListView({ list }: ShoppingListViewProps) {
  const [pasillos, setPasillos] = React.useState(list.pasillos);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const supabase = React.useMemo(() => createClient(), []);

  function setComprado(pasilloIdx: number, itemIdx: number, comprado: boolean) {
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

  async function handleToggle(pasilloIdx: number, itemIdx: number, nextComprado: boolean) {
    setErrorMessage(null);
    setComprado(pasilloIdx, itemIdx, nextComprado);

    try {
      await toggleShoppingListItem(supabase, list.id, pasilloIdx, itemIdx, nextComprado);
    }
    catch (error) {
      console.error('[ShoppingListView] toggleShoppingListItem failed, reverting', error);
      setComprado(pasilloIdx, itemIdx, !nextComprado);
      setErrorMessage('No se pudo guardar el cambio. Vuelve a intentarlo.');
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-h2">Lista de la compra</h1>
      <p className="mt-1 text-body-md text-tertiary">
        {list.resumen.total_items}
        {' '}
        productos · estimado
        {' '}
        {list.resumen.coste_estimado_min}
        –
        {list.resumen.coste_estimado_max}
        {' '}
        {list.resumen.moneda}
      </p>

      {errorMessage && (
        <p data-testid="shopping_list_toggle_error_message" className="mt-2 text-body-sm text-error">
          {errorMessage}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {pasillos.map((pasillo, pasilloIdx) => (
          <Card key={pasillo.nombre}>
            <p className="mb-2 text-label">{pasillo.nombre}</p>
            <ul className="flex flex-col gap-2">
              {pasillo.items.map((item, itemIdx) => (
                <li key={item.nombre} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    data-testid={`shopping_list_item_${pasilloIdx}_${itemIdx}`}
                    checked={item.comprado}
                    onChange={e => void handleToggle(pasilloIdx, itemIdx, e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  <span
                    className={`text-body-sm ${item.comprado ? 'text-neutral-500 line-through' : 'text-text'}`}
                  >
                    {item.nombre}
                    {' '}
                    ·
                    {item.cantidad}
                    {' '}
                    {formatUnidad(item.cantidad, item.unidad)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
