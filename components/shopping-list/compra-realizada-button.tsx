import { Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CompraRealizadaButtonProps {
  /** True while the receipt ticket dialog is open. */
  receiptOpen: boolean
  onClick: () => void
}

/**
 * FRESCO-214: floating instead of inline-at-the-bottom-of-the-list —
 * stays reachable without scrolling past every aisle first. Sits
 * above `BottomTabBar` (mobile, `z-100`) and clears it plus the
 * device safe area via the `bottom-[calc(...)]` offset; `md:` drops
 * to a smaller offset once that tab bar is hidden.
 *
 * FRESCO-433: was `flex justify-center`, same vertical axis as the
 * `ReceiptTicket` dialog's own centered overlay — the button peeked
 * out from behind the ticket on open. While the ticket is open it's
 * moved clear (desktop: right-aligned, out from under the centered
 * modal) rather than just hidden — the Dialog's backdrop already
 * makes it inert to clicks either way, but this keeps it visually
 * present. On mobile there's no room to reposition without still
 * colliding with the near-full-width modal, so it's hidden there
 * instead (`invisible`, not `hidden` — no layout jump when the
 * ticket closes and the button reappears).
 */
export function CompraRealizadaButton({ receiptOpen, onClick }: CompraRealizadaButtonProps) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-90 flex px-4 md:bottom-[calc(2rem+env(safe-area-inset-bottom))]',
        receiptOpen ? 'invisible justify-end md:visible md:pr-8' : 'justify-center',
      )}
    >
      {/* FRESCO-451 (slice 5/5): shadow-md matches every other floating
          control's elevation (e.g. HorizontalScrollRow's arrows) —
          shadow-lg on top of an already-solid `action` fill overstated
          this button's weight relative to the rest of the system. */}
      <Button
        type="button"
        size="lg"
        className="shadow-md"
        onClick={onClick}
        data-testid="shopping_list_clear_comprados_button"
      >
        <Receipt className="size-4" aria-hidden="true" />
        Compra realizada
      </Button>
    </div>
  );
}
