import { Clock, TrendingDown, Wallet } from 'lucide-react';
import { StatTile } from '@/components/menu/stat-tile';

/**
 * FRESCO-58 — three fixed, non-personalized estimate tiles, per the story's
 * own Business Rule: "valores orientativos generales para todos los
 * usuarios, no calculados a partir de la actividad real de cada usuario en
 * esta versión." No sourced spend/savings/time-recovered figures exist
 * anywhere in this repo's business docs — these are illustrative
 * placeholders proposed with the user rather than invented unreviewed, not
 * validated market numbers. FRESCO-75 — the disclaimer caption that used to
 * sit under these cards was removed at the user's request; the estimates
 * themselves are unchanged.
 */
const ESTIMATES = [
  { icon: Wallet, value: '~45€', label: 'Gasto semanal estimado' },
  { icon: TrendingDown, value: '~15€', label: 'Ahorro orientativo' },
  { icon: Clock, value: '~3h', label: 'Tiempo recuperado' },
] as const;

/**
 * FRESCO-156: no longer owns its own grid wrapper — renders as siblings of
 * `AvailableRecipesCard` inside the shared 2x2/4-col grid in `/menu`'s page
 * component, so all four value-indicator tiles (recetas disponibles + these
 * 3) reflow together on mobile instead of stacking as 4 separate rows.
 * FRESCO-444 — top-hairline `StatTile`s, not filled `Card`s.
 */
export function SavingsEstimateCards() {
  return (
    <>
      {ESTIMATES.map(({ icon, value, label }) => (
        <StatTile key={label} icon={icon} value={value} label={label} data-testid="savings_estimate_cards" />
      ))}
    </>
  );
}
