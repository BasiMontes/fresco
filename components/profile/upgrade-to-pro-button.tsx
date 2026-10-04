'use client';

import { useState } from 'react';
import { ProCheckoutSummary } from '@/components/profile/pro-checkout-summary';
import { Button } from '@/components/ui/button';
import { postConsents } from '@/lib/legal/consent-client';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';

interface CheckoutResponse {
  url?: string
  error?: string
}

export interface UpgradeToProButtonProps {
  /**
   * FRESCO-513 — the sidebar's compact placement wants "Mejorar plan"
   * instead of `/profile`'s persuasive default; same checkout flow either
   * way, this only overrides the visible text.
   */
  label?: string
  size?: 'sm' | 'md'
  className?: string
}

/**
 * `/profile`'s "Pásate a Fresco Pro" card CTA (STORY-FRESCO-228). Opens the
 * pre-contract summary (FRESCO-794, `ProCheckoutSummary`); once the user ticks
 * the withdrawal waiver and confirms, the waiver is recorded and this posts to
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
export function UpgradeToProButton({ label = 'Empezar prueba gratis', size = 'md', className }: UpgradeToProButtonProps = {}) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  async function handleConfirm() {
    setIsRedirecting(true);
    setError(null);
    // FRESCO-794 (ADR-0040): the immediate-execution request is recorded BEFORE
    // the user is sent to pay; no record, no checkout.
    if (!(await postConsents(['withdrawal_waiver']))) {
      setError('No pudimos registrar tu solicitud. Inténtalo de nuevo.');
      setIsRedirecting(false);
      return;
    }
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
    <div className={className}>
      <Button
        type="button"
        variant="action"
        size={size}
        data-testid="upgrade_to_pro_button"
        disabled={isRedirecting}
        onClick={() => {
          setError(null);
          setSummaryOpen(true);
        }}
      >
        {isRedirecting ? 'Redirigiendo…' : label}
      </Button>
      <ProCheckoutSummary
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        onConfirm={() => void handleConfirm()}
        isSubmitting={isRedirecting}
        error={error}
      />
    </div>
  );
}
