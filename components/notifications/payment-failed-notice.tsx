import { AlertTriangle } from 'lucide-react';
import { ManageSubscriptionButton } from '@/components/profile/manage-subscription-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Centro de Avisos payment-failed alert (FRESCO-234) — the real system
 * notice this screen was missing (see the "Centro de Avisos" `/notifications`
 * page doc comment): a failed Stripe renewal charge (`getPaymentFailedAt`,
 * FRESCO-232) already exists as data and already renders on `/profile`
 * (`payment_failed_notice`), it just wasn't routed here. Same copy/CTA as
 * that card, reusing `ManageSubscriptionButton` directly instead of a plain
 * link — it already redirects to the Stripe-hosted Billing Portal where the
 * payment method itself gets updated, no separate flow needed.
 */
export function PaymentFailedNotice({ paymentFailedAt }: { paymentFailedAt: string | null }) {
  if (!paymentFailedAt) {
    return null;
  }

  return (
    <Card variant="danger" className="mt-6" data-testid="notifications_payment_failed_notice">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-error" aria-hidden="true" />
          <CardTitle>Tu último pago falló</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="text-body-sm text-tertiary">
        No pudimos cobrar tu suscripción Pro. Actualiza tu método de pago para que no
        pierdas el acceso — seguimos intentando el cobro mientras tanto.
      </CardContent>
      <div className="mt-3">
        <ManageSubscriptionButton />
      </div>
    </Card>
  );
}
