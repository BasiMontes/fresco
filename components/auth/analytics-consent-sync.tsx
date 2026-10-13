'use client';

import { useEffect } from 'react';
import { useCookieConsent } from '@/components/legal/cookie-consent-context';
import { hasSupabaseSessionCookie, syncAnalyticsConsent, watchAuthState } from '@/lib/client-api/identity';

/**
 * FRESCO-919 (ADR-0044) — mirrors the cookie-banner decision into
 * `user_profiles.analytics_consent` for a signed-in user, so server-side PostHog
 * events (the Stripe funnel, the weekly push) can honour it. The decision itself
 * lives in a browser cookie the server never sees (ADR-0025).
 *
 * Same constraints as `IdentityCookieSync` (FRESCO-505 / FRESCO-539): it imports
 * only `@/lib/client-api/identity`, never the Supabase client, and does nothing
 * without a session cookie, so a visitor who never signed in loads no SDK.
 * Its own auth subscription, not PostHog's, because this write must happen for a
 * user who REJECTED analytics too (that is the whole point).
 *
 * Re-runs when the decision changes (withdrawal included) and on sign-in. A
 * guest (anonymous) has no profile worth syncing and is skipped. A failed write
 * is retried on the next page load.
 */
export function AnalyticsConsentSync() {
  const { decision } = useCookieConsent();

  useEffect(() => {
    if (decision === null || !hasSupabaseSessionCookie()) { return; }

    const controller = new AbortController();
    let unsubscribe: (() => void) | undefined;

    void watchAuthState({
      signal: controller.signal,
      onChange: (event, session) => {
        const user = session?.user;
        if (event === 'SIGNED_OUT' || !user || user.is_anonymous === true) { return; }

        syncAnalyticsConsent({ userId: user.id, accepted: decision === 'accepted' }).catch((error) => {
          console.error('[analytics-consent-sync] could not store the analytics decision', error);
        });
      },
    }).then((stop) => {
      if (controller.signal.aborted) { stop(); }
      else { unsubscribe = stop; }
    });

    return () => {
      controller.abort();
      unsubscribe?.();
    };
  }, [decision]);

  return null;
}
