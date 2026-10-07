'use client';

import type { PlanUsuario } from '@schemas';
import type { ReactNode } from 'react';
import type { AuthUser } from '@/lib/client-api/identity';
import { useEffect, useRef } from 'react';
import { useCookieConsent } from '@/components/legal/cookie-consent-context';
import { getPlanTierForAnalyticsLazy, watchAuthState } from '@/lib/client-api/identity';
import { captureEvent, identifyUser, POSTHOG_EVENTS } from '@/lib/posthog/events';
import { loadPosthog } from '@/lib/posthog/load';
import { derivePersonProperties } from '@/lib/posthog/person-properties';

// Module-level, not component state: React StrictMode double-invokes effects
// in dev, and posthog.init() is not itself idempotent-safe to call twice.
let initialized = false;

// FRESCO-496: lazy, cached-after-first-resolution import of posthog-js.
// This provider wraps every route via `app/layout.tsx`, so a static
// `import posthog from 'posthog-js'` here shipped the whole SDK in the
// initial JS of every page even though `posthog.init()` never runs until
// cookie consent is `'accepted'` — never true on a fresh/anonymous visit,
// which is exactly what a Lighthouse-style audit measures.
/**
 * ADR-0013: the app's first client provider (`app/layout.tsx` had none
 * before this). Initializes `posthog-js` once — a silent no-op when
 * `NEXT_PUBLIC_POSTHOG_KEY` is unset, mirroring `instrumentation-client.ts`'s
 * Sentry guard, since analytics must never block the app from rendering.
 *
 * `identify()` is wired centrally here via Supabase's `onAuthStateChange`
 * rather than duplicated at every sign-in/sign-up call site: a guest's
 * `signInAnonymously()` (ADR-0003) fires the same `SIGNED_IN` event as a
 * real login, and the anonymous user's `auth.uid()` is what
 * `reassignGuestData`/`updateUser` (ADR-0004) carries forward on upgrade —
 * so one listener covers guest, login, and signup identity linkage without
 * drift between call sites.
 *
 * FRESCO-366 / A4-B4: each identify also `$set`s the person properties
 * (`plan`, `is_guest`, `signup_method`) that PostHog funnels segment by.
 * `plan` needs one lightweight `user_profiles` read; it is skipped for
 * guests (never have a row) and de-duped per `auth.uid()` for the lifetime
 * of this provider (a Pro upgrade re-`$set`s `plan` server-side from the
 * Stripe webhook, so a stale client value self-heals).
 *
 * FRESCO-428 / ADR-0025: `posthog.init()` — and everything downstream of it
 * in this effect (identify, `SESSION_STARTED` capture) — is gated behind
 * `useCookieConsent().decision === 'accepted'`. No PostHog code runs before
 * consent, not even in an "opted out" state; this is a deliberate divergence
 * from PostHog's own documented `opt_out_capturing_by_default` pattern — see
 * the ADR for why. Must render inside `CookieConsentProvider`
 * (`app/layout.tsx`).
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  const { decision } = useCookieConsent();
  // Keyed on uid + anonymity, not uid alone: ADR-0004's OTP conversion keeps
  // the same auth.uid() while flipping is_anonymous, and that transition must
  // re-`$set` `is_guest` / `plan`.
  const identifiedKey = useRef<string | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || decision !== 'accepted') {
      return;
    }

    loadPosthog().then(({ default: posthog }) => {
      if (!initialized) {
        posthog.init(key, {
          // FRESCO-366 / A4-B4: route ingestion through the same-origin
          // `/ingest` reverse proxy (Next rewrites in `next.config.mjs`) so
          // ad-blockers that filter `*.posthog.com` don't silently drop
          // 15-30% of client events. `ui_host` keeps "open in PostHog" links
          // and the toolbar pointing at the real app host.
          api_host: '/ingest',
          ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.replace('.i.posthog.com', '.posthog.com'),
          // FRESCO-240: PostHog's default DOM-click autocapture would scrape
          // allergen/diet/health-adjacent UI text (e.g. "Vegano", "Sin
          // gluten", "Halal" tags in app/onboarding/page.tsx) outside the
          // reviewed event catalog in lib/posthog/event-names.ts — every event
          // this app emits goes through that catalog deliberately, so
          // autocapture is off. Pageview capture stays on default (URLs only,
          // no DOM content) — the landing→signup→onboarding funnel builds on
          // those plus the explicit events.
          autocapture: false,
        });
        initialized = true;
      }
      else {
        // A re-accept after an earlier withdrawal: `initialized` is already
        // true so `init()` above is skipped, but the SDK is still internally
        // opted-out from the `opt_out_capturing()` call in
        // cookie-consent-context.tsx's withdrawal path — nothing else ever
        // reverses that. Found in review (FRESCO-428): without this, capture
        // silently stays off for the rest of the session after a
        // reject-then-accept cycle. Idempotent when there was nothing to
        // reverse (first-ever accept never reaches this branch).
        posthog.opt_in_capturing();
      }
    }).catch((error) => {
      console.error('[posthog-provider] failed to load posthog-js', error);
    });

    // FRESCO-505: same class of bug FRESCO-496 already fixed for
    // `posthog-js` above. The Supabase client is ~530 KiB and this effect only
    // reaches it once cookie consent is accepted (the early return above), so
    // `watchAuthState` loads it lazily instead of a static import shipping that
    // weight in every page's initial bundle for a call a fresh, no-consent-yet
    // visit (exactly what Lighthouse measures) never runs.
    const controller = new AbortController();

    async function identifyWithProperties(user: AuthUser): Promise<void> {
      const identKey = `${user.id}:${user.is_anonymous === true}`;
      if (identifiedKey.current === identKey) {
        return;
      }
      identifiedKey.current = identKey;

      // Fail-soft (§10 Errors) — `getPlanTierForAnalyticsLazy` never throws: a
      // profile-read blip must never break identity linkage, `plan` just
      // stays at its 'free' default.
      let plan: PlanUsuario = 'free';
      if (user.is_anonymous !== true) {
        plan = await getPlanTierForAnalyticsLazy(user.id);
      }

      identifyUser(user.id, derivePersonProperties(user, plan));
    }

    const stopWatching = watchAuthState({
      signal: controller.signal,
      onChange: (event, session) => {
        const user = session?.user;
        if (user?.id) {
          void identifyWithProperties(user);
        }
        if (event === 'SIGNED_OUT') {
          identifiedKey.current = null;
        }
        // FRESCO-240: `/login`'s own SESSION_STARTED capture only fires on an
        // explicit credential submission, missing a returning user whose
        // persisted session is still valid and who never hits /login again.
        // `INITIAL_SESSION` fires exactly once, on mount, and only ever
        // carries a session when one was already persisted — a real
        // credential submission fires `SIGNED_IN` instead, so this can't
        // double-count against /login's own capture.
        if (event === 'INITIAL_SESSION' && session?.user?.id) {
          captureEvent(POSTHOG_EVENTS.SESSION_STARTED);
        }
      },
    });

    return () => {
      controller.abort();
      void stopWatching.then(stop => stop());
    };
  }, [decision]);

  return <>{children}</>;
}
