import type { ProInterval } from '@/components/profile/pro-checkout-summary';
import { useState } from 'react';
import { postConsents } from '@/lib/legal/consent-client';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';

interface CheckoutResponse {
  url?: string
  error?: string
}

/**
 * The Pro checkout flow behind every "upgrade" CTA (FRESCO-850): open the
 * pre-contract summary, record the withdrawal waiver, create the Stripe
 * session and redirect. It lives in a hook so the CTA and the summary dialog
 * can sit in different places: the sidebar menu is a popover, and a dialog
 * rendered inside it is torn down by the popover's click-outside check.
 *
 * Loading/error state mirrors `AccountActions`' `handleLogout` pattern
 * (`components/profile/danger-zone.tsx`): an inline `role="alert"` message,
 * not a toast (this repo has no toast dependency).
 */
export function useProCheckout() {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  function openSummary() {
    setError(null);
    setSummaryOpen(true);
  }

  async function confirm(interval: ProInterval) {
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
      const response = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interval }) });
      const data = await response.json() as CheckoutResponse;

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? 'No se pudo iniciar el pago.');
      }

      window.location.href = data.url;
    }
    catch (error_) {
      console.error('[useProCheckout] checkout failed', error_);
      setError('No se pudo iniciar el pago. Inténtalo de nuevo.');
      setIsRedirecting(false);
    }
  }

  return { isRedirecting, error, summaryOpen, setSummaryOpen, openSummary, confirm };
}
