import { Wallet } from 'lucide-react';
import { StatTile } from '@/components/menu/stat-tile';
import { formatPrecio } from '@/lib/utils';

export interface SavingsEstimateCardsProps {
  /**
   * Weekly menu cost from `estimateMenuCost()` — the single source of the
   * estimate, the same number the shopping list summary shows (FRESCO-792).
   * Absent (no plan yet, or the server-side calculation failed) renders
   * nothing: a figure with no menu behind it would be invented.
   */
  costeEstimado?: number
  /** FRESCO-841 — comparison line from `formatSpendVsAverage`; absent = no line. */
  comparison?: string | null
}

/**
 * FRESCO-58 originally rendered three fixed placeholder tiles (spend,
 * savings, time recovered). FRESCO-792 (audit-6 A6-P5) removed them: none had
 * a source, and showing the same numbers to every user as if they were
 * estimates is a claim the product cannot back. Only the computed weekly cost
 * remains.
 *
 * FRESCO-156: renders as a sibling of `AvailableRecipesCard` inside the shared
 * grid in `/menu`'s page component. FRESCO-444 — top-hairline `StatTile`, not
 * a filled `Card`.
 */
export function SavingsEstimateCards({ costeEstimado, comparison }: SavingsEstimateCardsProps = {}) {
  if (costeEstimado === undefined) { return null; }

  return (
    <StatTile
      icon={Wallet}
      value={formatPrecio(costeEstimado)}
      label="Gasto semanal estimado"
      note={comparison ?? undefined}
      data-testid="savings_estimate_cards"
    />
  );
}
