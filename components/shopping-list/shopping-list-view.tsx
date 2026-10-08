'use client';

import type { ShoppingListPersistido } from '@/lib/api/shopping-list';
import type { ShoppingListItem } from '@/lib/api/types';
import type { CompraPorItem } from '@/lib/grocery/compra';
import * as React from 'react';
import { CompraRealizadaButton } from '@/components/shopping-list/compra-realizada-button';
import { ExportActions } from '@/components/shopping-list/export-actions';
import { ReceiptTicket } from '@/components/shopping-list/receipt-ticket';
import { ShoppingListAisle } from '@/components/shopping-list/shopping-list-aisle';
import { ShoppingListAllBought } from '@/components/shopping-list/shopping-list-all-bought';
import { ShoppingListSuggestions } from '@/components/shopping-list/shopping-list-suggestions';
import { ShoppingListSummary } from '@/components/shopping-list/shopping-list-summary';
import { useShakeItem } from '@/components/shopping-list/use-shake-item';
import { useShoppingList } from '@/components/shopping-list/use-shopping-list';
import { useListEnterAnimation } from '@/components/ui/use-list-enter-animation';
import { nombresDeCadenas } from '@/lib/grocery/compra';

export interface ShoppingListViewProps {
  list: ShoppingListPersistido
  /**
   * FRESCO-194 — normalized names of items that weren't on last week's list.
   * Optional: absent (or empty) means no "Nuevo" badges this render.
   */
  nuevosNombres?: ReadonlySet<string>
  /**
   * FRESCO-792 — the weekly cost from `costeSemanalEstimado`, the same number
   * `/menu` shows. Absent (calculation failed) falls back to the range the
   * Edge Function stored with the list.
   */
  costeMenu?: number
  /**
   * FRESCO-808 — price and supermarket links per row, resolved on the server
   * (`resolverCompra`, which also applies the shopper's diet and allergens,
   * FRESCO-826). The view prints whatever chains it holds and knows none by
   * name. Absent (or a row missing from it) falls back to the stored estimate
   * with no link.
   */
  compra?: CompraPorItem
}

const EMPTY_NOMBRES: ReadonlySet<string> = new Set();

/**
 * Real shopping list (STORY-FRESCO-13) — replaces the old `MOCK_SHOPPING_LIST`
 * shell. State and server actions (optimistic toggle with revert, suggestions,
 * "Compra realizada") live in `useShoppingList`; this component wires them to
 * the summary, the suggestions carousel, the aisles and the receipt ticket.
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
 * FRESCO-194 (2nd pass) — "Nuevo" badge: an item is flagged when its name
 * wasn't on the immediately-prior week's list (`nuevosNombres`, computed
 * server-side in the page by diffing against the previous meal plan's list).
 * No recency column is persisted — the prior list already exists.
 */
export function ShoppingListView({ list, nuevosNombres = EMPTY_NOMBRES, costeMenu, compra }: ShoppingListViewProps) {
  const fuentesPrecios = nombresDeCadenas(compra);
  const { shakingItem, triggerShake } = useShakeItem();
  const { pasillos, suggestions, errorMessage, pendientes, compradosItems, handleToggle, removeComprados, handleAddSuggestion }
    = useShoppingList({ list, onToggleFailure: triggerShake });
  // FRESCO-246 — item enter animation. A flat index across every aisle so the
  // first-render stagger runs down the whole list, not per aisle.
  const getItemEnterProps = useListEnterAnimation();

  // Receipt ticket (docs/superpowers/specs/2026-09-04-receipt-ticket-design.md)
  // — clicking "Compra realizada" no longer un-checks immediately. It
  // snapshots the checked items, shows the printed ticket, and only removes
  // them once the user dismisses it.
  const [receiptOpen, setReceiptOpen] = React.useState(false);
  const [receiptItems, setReceiptItems] = React.useState<ShoppingListItem[]>([]);

  function handleCompraRealizada() {
    setReceiptItems(compradosItems);
    setReceiptOpen(true);
  }

  function handleReceiptClose() {
    setReceiptOpen(false);
    void removeComprados();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-h2">Lista de la compra</h1>

      <ExportActions pasillos={pasillos} />

      <ShoppingListSummary
        pendientes={pendientes}
        resumen={list.resumen}
        costeMenu={costeMenu}
        fuentesPrecios={fuentesPrecios}
      />

      {errorMessage && (
        <p data-testid="shopping_list_toggle_error_message" className="mt-2 text-body-sm text-error">
          {errorMessage}
        </p>
      )}

      <ShoppingListSuggestions suggestions={suggestions} onAdd={suggestion => void handleAddSuggestion(suggestion)} />

      {pasillos.length === 0 && <ShoppingListAllBought />}

      {/* `pb-24` keeps the last aisle card clear of the floating "Compra
          realizada" button below, once it's showing. */}
      <div className="mt-6 flex flex-col gap-6 pb-24">
        {pasillos.map((pasillo, pasilloIdx) => (
          <ShoppingListAisle
            key={pasillo.nombre}
            pasillo={pasillo}
            pasilloIdx={pasilloIdx}
            flatOffset={pasillos.slice(0, pasilloIdx).reduce((n, p) => n + p.items.length, 0)}
            shakingItem={shakingItem}
            nuevosNombres={nuevosNombres}
            compra={compra}
            getItemEnterProps={getItemEnterProps}
            onToggle={args => void handleToggle(args)}
          />
        ))}
      </div>

      {compradosItems.length > 0 && (
        <CompraRealizadaButton receiptOpen={receiptOpen} onClick={handleCompraRealizada} />
      )}

      <ReceiptTicket open={receiptOpen} items={receiptItems} onClose={handleReceiptClose} />
    </div>
  );
}
