import { UpgradeToProButton } from '@/components/profile/upgrade-to-pro-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PRO_TRIAL_DAYS } from '@/lib/legal/pro-terms';

export interface ProUpsellCardProps {
  /** Whether THIS user still has the free trial (`getUserTrialAvailable`). False also covers "could not tell". */
  trialAvailable: boolean
}

/**
 * `/profile`'s "Pásate a Fresco Pro" card for a Free user. FRESCO-822 (audit-6
 * follow-up to A6-S3 / FRESCO-778): the checkout gives a trial only to a user who
 * never started one, so the card must not promise a trial to anyone else. Someone
 * who already used it sees what is true: they come back to Pro with the price and
 * the charge from day one. Extracted from `app/(app)/profile/page.tsx` so both
 * states can be tested.
 */
export function ProUpsellCard({ trialAvailable }: ProUpsellCardProps) {
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
          ? `${PRO_TRIAL_DAYS} días de prueba gratis, sin tarjeta. Después, €4.99/mes.`
          : 'Ya usaste tu prueba gratuita: el plan cuesta €4.99/mes y se cobra desde el primer día. Puedes cancelarlo cuando quieras.'}
      </CardContent>
      <div className="mt-3">
        <UpgradeToProButton trialAvailable={trialAvailable} />
      </div>
    </Card>
  );
}
