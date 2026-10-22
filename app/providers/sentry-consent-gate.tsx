'use client';

import { useEffect } from 'react';
import { useCookieConsent } from '@/components/legal/cookie-consent-context';
import { clientSentry } from '@/lib/observability/client-sentry';

/**
 * FRESCO-1042 / ADR-0065: the browser Sentry SDK runs only while the cookie decision is
 * `'accepted'`, the same gate PostHog uses (ADR-0025). Renders nothing. Must sit inside
 * `CookieConsentProvider`. Server and edge Sentry are not affected.
 */
export function SentryConsentGate({ sentry = clientSentry }: { sentry?: Pick<typeof clientSentry, 'start' | 'stop'> }) {
  const { decision } = useCookieConsent();

  useEffect(() => {
    if (decision === 'accepted') {
      void sentry.start()?.catch((error) => {
        console.error('[sentry-consent-gate] failed to load @sentry/nextjs', error);
      });
      return;
    }
    void sentry.stop().catch((error) => {
      console.error('[sentry-consent-gate] failed to close Sentry', error);
    });
  }, [decision, sentry]);

  return null;
}
