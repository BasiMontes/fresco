# Receipt ticket on "Compra realizada" — design

**Date:** 2026-09-04
**Status:** approved, ready for implementation plan
**Reference:** [dqnamo — Receipt Printer](https://www.dqnamo.com/experiments/receipt-printer) (visual/interaction reference only — implementation is native, no shared code)

## Problem

Clicking "Compra realizada" on `/shopping-list` today has no feedback of its own — it silently un-checks every checked item (`handleClearComprados`, a repurposed placeholder from FRESCO-191; no dedicated "purchase complete" backend action exists or is being added here). The click needs a moment of delight: a printed receipt-style ticket listing what was bought, echoing a real till printer.

## Scope

UI-only. No backend/DB changes. The existing toggle-to-unchecked side effect (`toggleShoppingListItem` via `handleClearComprados`) is kept as-is, only **resequenced** to fire after the user dismisses the ticket instead of on the original click.

## Architecture

New component `components/shopping-list/receipt-ticket.tsx` (client), self-contained. Mounts inside the existing `components/ui/dialog.tsx` primitive to reuse its overlay, focus trap, Escape-to-close, portal, and `prefers-reduced-motion`-aware open/close transition — the printer "machine" body replaces `Dialog`'s default surface chrome (`className` override strips padding/shadow/background since the machine graphic *is* the surface).

No new dependencies. The codebase has zero `framer-motion`/`motion` usage anywhere — `Dialog` itself is hand-rolled CSS-driven motion (`.is-open`/`.is-closing` + `--modal-close-dur`, documented in the `transitions-dev` skill's `06-modal.md` pattern). This component follows the same convention: CSS custom properties + keyframe animations, no animation library. The receipt's perforated bottom edge is a static precomputed `clip-path: polygon(...)` (same zigzag technique as the dqnamo reference, computed once at module load — no per-render JS cost).

## Component

```
ReceiptTicket({ open, items, onClose })

items: { nombre: string; cantidad: number; unidad: string }[]

internal stage state machine:
  'processing' (~400ms fixed pause, "warming up" beat, no real async work)
    -> 'printing' (~1.75s, paper feeds in 10 stepped keyframes — thermal-printer
       "chunky" motion, not a smooth glide; matches the chosen "a saltos" option)
    -> 'complete' (checkmark, status text flips to done, "Listo" button appears)

onClose fires ONLY from the "Listo" button, Escape, or click-outside (via Dialog)
— never automatically, and never before the user has had a chance to see the
printed ticket.
```

Internal pieces (all in one file — this is one visual unit, not a subsystem):

- `Machine` — rounded body, subtle plastic look via CSS gradient (no external texture asset)
- `Screen` — dark readout: spinner (processing/printing) crossfades to a green checkmark (complete) + status label
- `Paper` — `<article className="font-mono">` (Tailwind's default mono stack — no new font load), perforated bottom edge, ticket content (see Copy below)
- Output window: fixed height, `overflow-hidden` while `stage !== 'complete'`, switches to `overflow-y-auto` once `stage === 'complete'` — so long lists (20-30+ items) scroll *inside the already-printed ticket* rather than being clipped or summarized. The "sliding out of the slot" illusion is preserved because scroll only activates after the feed animation finishes.

## Data flow

In `components/shopping-list/shopping-list-view.tsx`:

```tsx
const [receiptOpen, setReceiptOpen] = React.useState(false);
const [receiptItems, setReceiptItems] = React.useState<ReceiptItem[]>([]);

function handleCompraRealizada() {
  const items = compradosCoords.map(([p, i]) => pasillos[p].items[i]);
  setReceiptItems(items);
  setReceiptOpen(true); // does NOT uncheck yet
}

function handleReceiptClose() {
  setReceiptOpen(false);
  void handleClearComprados(); // existing toggle side effect, now fires on dismiss
}
```

The `data-testid="shopping_list_clear_comprados_button"` button's `onClick` moves from `handleClearComprados` to `handleCompraRealizada`. `handleClearComprados` itself is unchanged.

## Copy (placeholder — to be refined together)

```
      FRESCO
--------------------------------
11 SEP 2026 · 18:42

7 ITEMS COMPRADOS
--------------------------------
2x    Tomate
1x    Aceite de oliva
500g  Pollo
1x    Leche
...
--------------------------------
¡Buen provecho!
```

- Date/time: `Intl.DateTimeFormat('es-ES', ...)` formatted inline — no existing shared date-formatting helper found in the repo to reuse, so a small local formatter is added in this file.
- Item line format reuses the existing `formatUnidad(cantidad, unidad)` helper from `shopping-list-view.tsx` (singularizes "1 unidades" → "1 unidad", etc.) for the qty/unit half of each line.

## Edge cases

- **0 comprados** — button already doesn't render when `compradosCoords.length === 0` (unchanged).
- **Odd cantidad/unidad values** — reuses `formatUnidad`, same rules already proven live on the shopping list itself.
- **`prefers-reduced-motion`** — paper appears directly at its final position, no stepped feed animation (same reduced-motion posture `Dialog` already has, CSS-only, no JS branch needed).
- **Closed mid-print** (Escape/click-outside while `stage === 'printing'`) — allowed; `handleReceiptClose` still runs in full (still un-checks the items) — the user isn't forced to watch the full animation.

## Testing

- `components/shopping-list/receipt-ticket.test.tsx` (bun + RTL, matches repo convention): render with items, advance fake timers through `processing` → `printing` → `complete`, assert "Listo" appears, click it, assert `onClose` fires.
- `components/shopping-list/shopping-list-view.test.tsx`: clicking "Compra realizada" opens the ticket with the checked items and does **not** immediately uncheck them (assert `toggleShoppingListItem` not yet called); clicking "Listo" closes the ticket and un-checks them (existing assertion, moved to fire after close).
