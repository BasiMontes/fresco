'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** How often /profile re-reads the plan while the Stripe webhook has not landed yet. */
export const ACTIVATION_POLL_MS = 3000;
/** After this long without the plan flipping to Pro, stop polling and say it is taking longer. */
export const ACTIVATION_GIVE_UP_MS = 60_000;

/**
 * FRESCO-1122 (A8-PAY-05) — shown on `/profile?checkout=success` while `plan` is still `free`.
 * The plan is written only by the Stripe webhook (ADR-0007), which can lag the redirect by a few
 * seconds, so the page re-reads the server on an interval. Once the plan is `pro` the parent stops
 * rendering this and the interval is cleared on unmount.
 */
export function PlanActivatingNotice() {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    const poll = setInterval(() => router.refresh(), ACTIVATION_POLL_MS);
    const giveUp = setTimeout(() => {
      clearInterval(poll);
      setGaveUp(true);
    }, ACTIVATION_GIVE_UP_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(giveUp);
    };
  }, [router]);

  return (
    <Card variant="pro" className="mt-4" data-testid="plan_activating_notice" role="status" aria-live="polite">
      <CardHeader>
        <CardTitle>Activando tu plan Pro</CardTitle>
      </CardHeader>
      <CardContent className="text-body-sm text-tertiary">
        {gaveUp
          ? 'Tu pago se ha recibido, pero la activación está tardando más de lo normal. Recarga la página en unos minutos; si sigue igual, escríbenos.'
          : 'Tu pago se ha recibido. Estamos activando tu plan, solo tardará unos segundos.'}
      </CardContent>
    </Card>
  );
}
