'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';

interface CheckoutResponse {
  url?: string
  error?: string
}

/**
 * `/profile`'s "Pásate a Fresco Pro" card CTA (STORY-FRESCO-228). Posts to
 * `POST /api/stripe/checkout`, then does a full-page redirect to the
 * returned Stripe-hosted Checkout url (ADR-0007 — the redirect itself is the
 * whole client-side job here; the return page never writes `plan`, the
 * webhook does).
 *
 * Loading/error state mirrors `AccountActions`' `handleLogout` pattern
 * (`components/profile/danger-zone.tsx`) rather than a toast library — this
 * repo has no toast dependency installed, and the existing convention for
 * every other async profile action is an inline `role="alert"` message next
 * to the button, so this follows that instead of introducing a new one.
 */
export function UpgradeToProButton() {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsRedirecting(true);
    setError(null);
    // FRESCO-366: the `checkout` funnel step — fired before the redirect so it
    // lands even though the Stripe-hosted page is a full navigation away.
    captureEvent(POSTHOG_EVENTS.CHECKOUT_STARTED);
    try {
      const response = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await response.json() as CheckoutResponse;

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? 'No se pudo iniciar el pago.');
      }

      window.location.href = data.url;
    }
    catch (error_) {
      console.error('[UpgradeToProButton] checkout failed', error_);
      setError('No se pudo iniciar el pago. Inténtalo de nuevo.');
      setIsRedirecting(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="action"
        data-testid="upgrade_to_pro_button"
        disabled={isRedirecting}
        onClick={() => void handleClick()}
      >
        {isRedirecting ? 'Redirigiendo…' : 'Empezar prueba gratis'}
      </Button>
      {error && (
        <p data-testid="upgrade_to_pro_error_message" role="alert" aria-live="assertive" className="mt-2 text-body-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
