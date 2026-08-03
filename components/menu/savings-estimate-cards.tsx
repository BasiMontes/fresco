import { Clock, TrendingDown, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * FRESCO-58 — three fixed, non-personalized estimate cards, per the story's
 * own Business Rule: "valores orientativos generales para todos los
 * usuarios, no calculados a partir de la actividad real de cada usuario en
 * esta versión." No sourced spend/savings/time-recovered figures exist
 * anywhere in this repo's business docs — these are illustrative
 * placeholders proposed with the user rather than invented unreviewed
 * (see the shared caption below), not validated market numbers.
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
              <p className="text-caption text-tertiary">Valor orientativo</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-2 rounded-md bg-warning/10 p-2 text-caption text-warning">
        Cifras de referencia general, pendientes de validar con datos reales de mercado.
      </p>
    </div>
  );
}
