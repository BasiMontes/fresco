import { Clock, TrendingDown, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * FRESCO-58 — three fixed, non-personalized estimate cards, per the story's
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
  { icon: TrendingDown, value: '~15€', label: 'Ahorro estimado' },
  { icon: Clock, value: '~3h', label: 'Tiempo recuperado' },
] as const;

export function SavingsEstimateCards() {
  return (
    <div className="mt-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="savings_estimate_cards">
        {ESTIMATES.map(({ icon: Icon, value, label }) => (
          <Card key={label}>
            <CardContent className="flex flex-col items-start gap-1">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <p className="text-h3">{value}</p>
              <p className="text-body-sm text-tertiary">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
