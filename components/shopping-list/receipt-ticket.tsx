'use client';

import type { ShoppingListItem } from '@/lib/api/types';
import { Check, Loader2 } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface ReceiptTicketProps {
  open: boolean
  items: Pick<ShoppingListItem, 'nombre' | 'cantidad' | 'unidad'>[]
  onClose: () => void
}

type ReceiptStage = 'printing' | 'complete';

/**
 * Perforated bottom edge — same zigzag `clip-path` technique as the dqnamo
 * reference (https://www.dqnamo.com/experiments/receipt-printer), computed
 * once at module load rather than per-render since the tooth count/depth
 * never change at runtime.
 */
const RECEIPT_TOOTH_COUNT = 24;
const RECEIPT_TOOTH_DEPTH = 4;
const RECEIPT_CLIP_PATH = (() => {
  const points = Array.from({ length: RECEIPT_TOOTH_COUNT * 2 }, (_, index) => {
    const x = 100 - ((index + 1) * 100) / (RECEIPT_TOOTH_COUNT * 2);
    const y = index % 2 === 0 ? '100%' : `calc(100% - ${RECEIPT_TOOTH_DEPTH}px)`;
    return `${x}% ${y}`;
  }).join(', ');
  return `polygon(0 0, 100% 0, 100% calc(100% - ${RECEIPT_TOOTH_DEPTH}px), ${points})`;
})();

function formatFecha(date: Date): string {
  const datePart = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(date)
    .toUpperCase()
    .replace('.', '');
  const timePart = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date);
  return `${datePart} · ${timePart}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Duplicated (not imported) from `shopping-list-view.tsx` on purpose — that
 * file renders this component, so importing the function back from it would
 * create a circular module dependency for the sake of sharing two lines.
 * Same singularization rule, same source data shape.
 */
function formatUnidad(cantidad: number, unidad: string): string {
  return cantidad === 1 && unidad === 'unidades' ? 'unidad' : unidad;
}

/**
 * Receipt-printer-style confirmation shown from `ShoppingListView` when
 * "Compra realizada" is clicked — see
 * `docs/superpowers/specs/2026-09-04-receipt-ticket-design.md`. Wraps the
 * existing `Dialog` primitive for overlay/focus-trap/Escape/portal and
 * strips its default surface chrome (`className` below) since the printer
 * "machine" body is the visual surface here, not `Dialog`'s own card.
 *
 * Stage machine is `'printing' -> 'complete'`, driven by the paper's
 * `onAnimationEnd` (`.t-receipt-print` in `app/globals.css`) rather than a
 * `setTimeout` — see that CSS block's comment for why.
 */
export function ReceiptTicket({ open, items, onClose }: ReceiptTicketProps) {
  const [stage, setStage] = React.useState<ReceiptStage>('printing');
  // Snapshot the print timestamp once per open, not on every render, and
  // not stale from a previous open — resets alongside `stage` below.
  const fechaRef = React.useRef(new Date());

  React.useEffect(() => {
    if (!open) { return; }
    setStage('printing');
    fechaRef.current = new Date();
  }, [open]);

  const isComplete = stage === 'complete';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next) { onClose(); } }}
      aria-label="Ticket de compra"
      data-testid="receipt_ticket_dialog"
      className="max-w-sm border-none bg-transparent p-0 shadow-none"
    >
      {/* Machine body: deliberately a distinct (darker) tone from the paper
          below (`bg-surface`) — same color would make the perforated
          `clip-path` edge invisible, since there'd be no boundary to see. */}
      <div className="relative isolate w-full overflow-hidden rounded-3xl border border-neutral-700 bg-neutral-800 p-3 pb-6 shadow-lg">
        <div className="relative z-10 mb-3 flex items-center gap-2 rounded-xl bg-text px-4 py-3 text-background">
          {isComplete
            ? (
                <span className="t-success-check" data-state="in" aria-hidden="true">
                  <Check className="size-4 text-success" strokeWidth={3} />
                </span>
              )
            : (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              )}
          <p role="status" aria-live="polite" className="text-body-sm">
            {isComplete ? 'Ticket listo' : 'Imprimiendo tu ticket…'}
          </p>
        </div>

        {/* Output window: fixed height while printing (keeps the "sliding
            out of the slot" illusion), scrollable once complete so long
            lists don't get clipped. */}
        <div
          className={cn(
            'relative h-[26rem] w-full px-1',
            isComplete ? 'overflow-y-auto' : 'overflow-hidden',
          )}
        >
          <article
            data-testid="receipt_ticket_paper"
            onAnimationEnd={() => setStage('complete')}
            className="t-receipt-print relative bg-surface px-5 pb-6 pt-6 font-mono text-body-sm text-text motion-reduce:transform-none"
            style={{ clipPath: RECEIPT_CLIP_PATH }}
          >
            <p className="text-center font-semibold tracking-widest">FRESCO</p>
            <p className="mt-1 text-center text-caption text-tertiary">{formatFecha(fechaRef.current)}</p>
            <div className="my-3 border-t border-dashed border-tertiary/40" />
            <p className="font-semibold">
              {items.length}
              {' '}
              ITEM
              {items.length === 1 ? '' : 'S'}
              {' '}
              COMPRADO
              {items.length === 1 ? '' : 'S'}
            </p>
            <div className="my-3 border-t border-dashed border-tertiary/40" />
            <ul>
              {items.map((item, index) => (
                <li key={`${item.nombre}-${index}`} className="flex justify-between gap-3 py-0.5">
                  <span className="truncate">{capitalize(item.nombre)}</span>
                  <span className="shrink-0 text-tertiary">
                    {item.cantidad}
                    {' '}
                    {formatUnidad(item.cantidad, item.unidad)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="my-3 border-t border-dashed border-tertiary/40" />
            <p className="text-center">¡Buen provecho!</p>
          </article>
        </div>

        {isComplete && (
          <div className="relative z-10 mt-3 flex justify-center">
            <Button type="button" onClick={onClose} data-testid="receipt_ticket_done_button">
              Listo
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
