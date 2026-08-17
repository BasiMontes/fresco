'use client';

import type { LucideIcon } from 'lucide-react';
import type { ShoppingListPersistido } from '@/lib/api/shopping-list';
import type { ShoppingListItem, ShoppingListSuggestion } from '@/lib/api/types';
import {
  Beef,
  Carrot,
  ChefHat,
  CupSoda,
  Droplet,
  Egg,
  Fish,
  Lightbulb,
  Package,
  Plus,
  Sandwich,
  Trash2,
  Utensils,
  Wheat,
} from 'lucide-react';
import * as React from 'react';
import { HorizontalScrollRow } from '@/components/menu/horizontal-scroll-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { getShoppingListSuggestions } from '@/lib/api/edge-functions';
import { addShoppingListItem, toggleShoppingListItem } from '@/lib/api/shopping-list';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Matches the app's existing static-copy convention (`recipe-card.tsx`: "2,80€/persona") — comma decimal, no space before the symbol. */
function formatPrecio(precio: number): string {
  return `${precio.toFixed(2).replace('.', ',')}€`;
}

/**
 * FRESCO-191 — `pasillo.nombre` comes from the Edge Function's fixed-aisle
 * prompt (`types.ts`'s own comment: "exact aisle name, from the fixed
 * 13-aisle vocabulary"), not enumerated anywhere in this repo. Built from
 * the 10 aisle names actually observed in persisted data (sampled live via
 * SQL) rather than guessing the full 13 — an unmapped aisle still renders
 * fine via the `ChefHat` fallback, same graceful-degradation pattern as
 * `lib/recipes/category-icon.tsx`.
 */
const PASILLO_ICONS: Record<string, LucideIcon> = {
  'Frutas y verduras': Carrot,
  'Carnes y aves': Beef,
  'Pescados y mariscos': Fish,
  'Charcutería y embutidos': Sandwich,
  'Lácteos y huevos': Egg,
  'Pan y bollería': Wheat,
  'Pasta/arroz/legumbres': Utensils,
  'Conservas y salsas': Package,
  'Aceites/vinagres/condimentos': Droplet,
  'Bebidas': CupSoda,
};

function getPasilloIcon(nombre: string): LucideIcon {
  return PASILLO_ICONS[nombre] ?? ChefHat;
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
 *
 * FRESCO-191 — visual pass against a Stitch mockup the user provided
 * (screenshot + exported HTML on the Jira ticket): summary card, per-aisle
 * icon headers, rounded checkbox rows. Adopted only what real data
 * supports — `resumen.coste_estimado_min/max` and a live pending-count were
 * already computed, just not surfaced in a dedicated card before. Left out
 * deliberately: "Nuevo" badges (no recency data exists anywhere — see
 * FRESCO-194) and its Pantry/History bottom nav (that's `AppShell`'s shared
 * nav across every route, out of scope here). Per-item price is NOT in that
 * left-out list — `aisle-pricing.ts` already computed a real per-ingredient
 * price to build the list-level total, just never kept it on the item;
 * `precio_estimado` exposes that same number instead of only summing it.
 *
 * FRESCO-191 QA rework — mockup's "Completar compra" CTA had no backing
 * action (only get/toggle exist), so it's repurposed as "Compra realizada"
 * (FRESCO-215: bulk-untoggle already-checked items via the same
 * `toggleShoppingListItem` used per-row, framed as finishing the shopping
 * trip rather than a technical "clear" action) instead of built as a
 * decorative no-op. Also fixed the
 * pasillo icon glyph, which was rendering at ~4px — `size-4` and `p-1.5` on
 * the same element (border-box) let the padding eat into the fixed box; the
 * padding now lives on a wrapper span around the icon.
 *
 * FRESCO-194 — "Sugerencias para ti" carousel, real data only: ingredients
 * from the caller's own favorited recipes not already in this list
 * (`get-shopping-list-suggestions` Edge Function — no suggestion/recency
 * data exists anywhere else in this app, so favorites is the only real
 * signal; "Nuevo" stays out, it needs recency tracking this app doesn't
 * have). "+ Añadir" uses the same optimistic-update-with-revert pattern as
 * the checkbox toggle, via the new `jsonb_add_item` RPC.
 */
export function ShoppingListView({ list }: ShoppingListViewProps) {
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

  const compradosCoords = pasillos.flatMap((pasillo, pasilloIdx) =>
    pasillo.items
      .map((item, itemIdx) => ({ item, pasilloIdx, itemIdx }))
      .filter(({ item }) => item.comprado)
      .map(({ pasilloIdx: pIdx, itemIdx: iIdx }) => [pIdx, iIdx] as const),
  );

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

  async function handleClearComprados() {
    await Promise.all(
      compradosCoords.map(async ([pasilloIdx, itemIdx]) => handleToggle(pasilloIdx, itemIdx, false)),
    );
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
      await addShoppingListItem(supabase, list.id, suggestion.pasillo, newItem);
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

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-h2">Lista de la compra</h1>

      <Card className="mt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-h5">Resumen</h2>
            <p className="mt-1 flex items-center gap-1.5 text-body-sm text-tertiary">
              <span className="inline-block size-2 rounded-full bg-secondary" aria-hidden="true" />
              {pendientes}
              {' '}
              {pendientes === 1 ? 'artículo pendiente' : 'artículos pendientes'}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-caption uppercase tracking-wide text-tertiary">Total estimado</p>
            <p className="text-h5 font-heading text-primary">
              {list.resumen.coste_estimado_min.toFixed(2).replace('.', ',')}
              –
              {formatPrecio(list.resumen.coste_estimado_max)}
            </p>
          </div>
        </div>
      </Card>

      {errorMessage && (
        <p data-testid="shopping_list_toggle_error_message" className="mt-2 text-body-sm text-error">
          {errorMessage}
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="mt-6" data-testid="shopping_list_suggestions_section">
          <h3 className="flex items-center gap-2 text-caption uppercase tracking-wide text-tertiary">
            <Lightbulb className="size-3.5" aria-hidden="true" />
            Sugerencias para ti
          </h3>
          <HorizontalScrollRow className="mt-2">
            {suggestions.map((suggestion) => {
              const SuggestionIcon = getPasilloIcon(suggestion.pasillo);
              return (
                <Card key={suggestion.nombre} className="flex w-40 shrink-0 flex-col justify-between gap-3">
                  <div>
                    <span className="flex size-10 items-center justify-center rounded-full bg-accent-2-100">
                      <SuggestionIcon className="size-5 text-secondary" aria-hidden="true" />
                    </span>
                    <p className="mt-2 line-clamp-2 text-body-sm font-medium text-text">
                      {capitalize(suggestion.nombre)}
                    </p>
                    <p className="mt-1 text-caption text-tertiary">{formatPrecio(suggestion.precio_estimado)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleAddSuggestion(suggestion)}
                    data-testid={`shopping_list_add_suggestion_${suggestion.nombre}`}
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    Añadir
                  </Button>
                </Card>
              );
            })}
          </HorizontalScrollRow>
        </div>
      )}

      {/* `pb-24` keeps the last aisle card clear of the floating "Compra
          realizada" button below, once it's showing. */}
      <div className="mt-6 flex flex-col gap-6 pb-24">
        {pasillos.map((pasillo, pasilloIdx) => {
          const PasilloIcon = getPasilloIcon(pasillo.nombre);
          return (
            <div key={pasillo.nombre} className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 border-b border-border pb-1 text-h6">
                {/* accent-2-100 is secondary's own pre-computed light tint, not
                    an opacity modifier — bg-secondary/10 silently resolves to
                    transparent, same root cause as FRESCO-169 (tailwind.config.ts
                    maps every semantic color to a raw var(--color-*) reference,
                    which Tailwind can't decompose for the alpha channel).

                    Padding lives on this wrapper span, not on the icon itself —
                    size-4 + p-1.5 on the same element (border-box) ate into the
                    icon's own fixed box, shrinking the visible glyph to ~4px. */}
                <span className="flex shrink-0 items-center justify-center rounded-lg bg-accent-2-100 p-1.5">
                  <PasilloIcon className="size-4 text-secondary" aria-hidden="true" />
                </span>
                {pasillo.nombre}
              </h3>
              <Card className="p-0">
                <ul className="flex flex-col divide-y divide-border">
                  {pasillo.items.map((item, itemIdx) => (
                    <li key={item.nombre} className="flex items-center gap-4 p-4">
                      <Checkbox
                        data-testid={`shopping_list_item_${pasilloIdx}_${itemIdx}`}
                        checked={item.comprado}
                        onChange={e => void handleToggle(pasilloIdx, itemIdx, e.target.checked)}
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span
                          className={cn(
                            'truncate text-body-lg',
                            item.comprado ? 'text-tertiary line-through opacity-70' : 'text-text',
                          )}
                        >
                          {capitalize(item.nombre)}
                        </span>
                        <span className="text-caption text-tertiary">
                          {item.cantidad}
                          {' '}
                          {formatUnidad(item.cantidad, item.unidad)}
                          {item.precio_estimado !== undefined && (
                            <>
                              {' · '}
                              {formatPrecio(item.precio_estimado)}
                            </>
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          );
        })}
      </div>

      {compradosCoords.length > 0 && (
        // FRESCO-214: floating instead of inline-at-the-bottom-of-the-list —
        // stays reachable without scrolling past every aisle first. Sits
        // above `BottomTabBar` (mobile, `z-[100]`) and clears it plus the
        // device safe area via the `bottom-[calc(...)]` offset; `md:` drops
        // to a smaller offset once that tab bar is hidden.
        <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[90] flex justify-center px-4 md:bottom-[calc(2rem+env(safe-area-inset-bottom))]">
          <Button
            type="button"
            size="lg"
            className="shadow-lg"
            onClick={() => void handleClearComprados()}
            data-testid="shopping_list_clear_comprados_button"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Compra realizada
          </Button>
        </div>
      )}
    </div>
  );
}
