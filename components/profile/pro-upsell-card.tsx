import type { ProPrices } from '@/lib/billing/pro-prices';
import { UpgradeToProButton } from '@/components/profile/upgrade-to-pro-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatEuros, yearlySavingsEuros } from '@/lib/billing/pro-prices';
import { PRO_TRIAL_DAYS } from '@/lib/legal/pro-terms';

export interface ProUpsellCardProps {
  /** Whether THIS user still has the free trial (`getUserTrialAvailable`). False also covers "could not tell". */
  trialAvailable: boolean
  /** The Pro prices read from Stripe (`getProPrices`), or `null` when they could not be read. */
  prices: ProPrices | null
}

/**
 * `/profile`'s "Pásate a Fresco Pro" card for a Free user. FRESCO-822 (audit-6
 * follow-up to A6-S3 / FRESCO-778): the checkout gives a trial only to a user who
 * never started one, so the card must not promise a trial to anyone else. Someone
 * who already used it sees what is true: they come back to Pro with the price and
 * the charge from day one. Extracted from `app/(app)/profile/page.tsx` so both
 * states can be tested.
 */
export function ProUpsellCard({ trialAvailable, prices }: ProUpsellCardProps) {
  // FRESCO-871: amounts come from Stripe. FRESCO-1166: without them the card states no amount (it used to fall
  // back to a typed 4,99) and says the price is shown before paying.
  const month = prices ? formatEuros(prices.month) : null;
  const year = prices?.year != null ? formatEuros(prices.year) : null;
  const savings = prices ? yearlySavingsEuros(prices) : null;
  // FRESCO-1004: said once, and only when Stripe declares the prices tax-inclusive.
  const taxNote = prices?.taxIncluded ? ' Precios con IVA incluido.' : '';
  const yearlyOption = year ? ` O ${year}/año${savings !== null ? ` (ahorras ${formatEuros(savings)})` : ''}.` : '';

  return (
    <Card variant="pro" className="mt-4" data-testid="pro_upsell_card">
      <CardHeader>
        <CardTitle>{trialAvailable ? 'Pásate a Fresco Pro' : 'Vuelve a Fresco Pro'}</CardTitle>
      </CardHeader>
      <CardContent className="text-body-sm text-tertiary">
        Con Pro, cada menú aprende de lo que cocinas y descartas la semana anterior — cuanto
        más lo uses, menos tienes que pensar.
        {' '}
        {trialAvailable
          ? `${PRO_TRIAL_DAYS} días de prueba gratis, sin tarjeta. ${month ? `Después, ${month}/mes.` : 'Después, el precio lo ves antes de pagar.'}${yearlyOption}${taxNote}`
          : `Ya usaste tu prueba gratuita: ${month ? `el plan cuesta ${month}/mes${year ? ` o ${year}/año` : ''} y se cobra` : 'el plan se cobra'} desde el primer día.${month ? '' : ' El precio lo ves antes de pagar.'}${taxNote} Puedes cancelarlo cuando quieras.`}
      </CardContent>
      <div className="mt-3">
        <UpgradeToProButton trialAvailable={trialAvailable} />
      </div>
    </Card>
  );
}
