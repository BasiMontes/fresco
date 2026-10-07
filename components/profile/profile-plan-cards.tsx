import type { UserProfile } from '@schemas';
import type { ProPrices } from '@/lib/billing/pro-prices';
import { ManageSubscriptionButton } from '@/components/profile/manage-subscription-button';
import { ProUpsellCard } from '@/components/profile/pro-upsell-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isPaymentFailedAlertActive } from '@/lib/api/user-profile';

interface ProfilePlanCardsProps {
  plan: UserProfile['plan']
  paymentFailedAt: string | null
  trialAvailable: boolean
  /** The Pro prices for the upsell (only read for Free users); `null` when Stripe could not be read. */
  prices: ProPrices | null
}

/** Free: the upsell. Pro: the payment-failed aviso (when active) and the subscription card. */
export function ProfilePlanCards({ plan, paymentFailedAt, trialAvailable, prices }: ProfilePlanCardsProps) {
  return (
    <>
      {plan === 'free' && <ProUpsellCard trialAvailable={trialAvailable} prices={prices} />}

      {/* STORY-FRESCO-232: payment-failed aviso — only ever shown alongside
          the Pro card below (plan stays 'pro' during Stripe's own retry
          window, see lib/stripe.ts `resolvePaymentStatusUpdate`), never
          alongside the upsell above. Points at that card's
          `ManageSubscriptionButton` (FRESCO-231) rather than rendering a
          second instance here — the Billing Portal it opens is also where
          the payment method gets updated, no separate flow needed. */}
      {isPaymentFailedAlertActive(plan, paymentFailedAt) && (
        <Card variant="danger" className="mt-4" data-testid="payment_failed_notice">
          <CardHeader>
            <CardTitle>Tu último pago falló</CardTitle>
          </CardHeader>
          <CardContent className="text-body-sm text-tertiary">
            No pudimos cobrar tu suscripción Pro. Actualiza tu método de pago desde
            &ldquo;Gestionar mi suscripción&rdquo; más abajo para que no pierdas el acceso —
            seguimos intentando el cobro mientras tanto.
          </CardContent>
        </Card>
      )}

      {/* STORY-FRESCO-231: symmetric card for Pro users — exactly one of this
          card and the upsell above ever renders, gated on the same `plan`.
          "Manage" delegates entirely to the Stripe-hosted Billing Portal
          (next invoice date/amount, cancel/reactivate, payment method) —
          no custom UI needed for any of that here. */}
      {plan === 'pro' && (
        <Card variant="pro" className="mt-4">
          <CardHeader>
            <CardTitle>Tu suscripción</CardTitle>
          </CardHeader>
          <CardContent className="text-body-sm text-tertiary">
            Ya eres Fresco Pro. Desde aquí puedes ver tu próxima factura, cambiar tu método de
            pago o cancelar cuando quieras.
          </CardContent>
          <div className="mt-3">
            <ManageSubscriptionButton />
          </div>
        </Card>
      )}
    </>
  );
}
