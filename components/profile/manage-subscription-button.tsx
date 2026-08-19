'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface PortalResponse {
  url?: string
  error?: string
}

/**
 * `/profile`'s "Gestionar mi suscripción" card CTA (STORY-FRESCO-231). Posts
 * to `POST /api/stripe/portal`, then does a full-page redirect to the
 * returned Stripe-hosted Billing Portal url — the portal itself shows the
 * next invoice and handles cancel/reactivate, so this component's whole job
 * is the redirect, same as `UpgradeToProButton` (STORY-FRESCO-228).
 *
 * Structurally identical to `UpgradeToProButton`: inline `role="alert"`
 * error message instead of a toast library (this repo has none installed),
 * loading/disabled button state while redirecting.
 */
export function ManageSubscriptionButton() {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsRedirecting(true);
    setError(null);
    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await response.json() as PortalResponse;

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? 'No se pudo abrir la gestión de tu suscripción.');
      }

      window.location.href = data.url;
    }
    catch (error_) {
      console.error('[ManageSubscriptionButton] portal session failed', error_);
      setError('No se pudo abrir la gestión de tu suscripción. Inténtalo de nuevo.');
      setIsRedirecting(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="action"
        data-testid="manage_subscription_button"
        disabled={isRedirecting}
        onClick={() => void handleClick()}
      >
        {isRedirecting ? 'Redirigiendo…' : 'Gestionar mi suscripción'}
      </Button>
      {error && (
        <p data-testid="manage_subscription_error_message" role="alert" aria-live="assertive" className="mt-2 text-body-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
