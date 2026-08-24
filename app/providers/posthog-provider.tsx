'use client';

import type { ReactNode } from 'react';
import posthog from 'posthog-js';
import { useEffect } from 'react';
import { captureEvent, identifyUser, POSTHOG_EVENTS } from '@/lib/posthog/events';
import { createClient } from '@/lib/supabase/client';

// Module-level, not component state: React StrictMode double-invokes effects
// in dev, and posthog.init() is not itself idempotent-safe to call twice.
let initialized = false;

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
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (key && !initialized) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        // FRESCO-240: PostHog's default DOM-click autocapture would scrape
        // allergen/diet/health-adjacent UI text (e.g. "Vegano", "Sin
        // gluten", "Halal" tags in app/onboarding/page.tsx) outside the
        // reviewed event catalog in lib/posthog/events.ts — every event this
        // app emits goes through that catalog deliberately, so autocapture
        // is off. Pageview capture stays on default (URLs only, no DOM
        // content) — no deliberate pageview event exists elsewhere to make
        // it redundant.
        autocapture: false,
      });
      initialized = true;
    }

    if (!key) {
      return;
    }

    const client = createClient();
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (session?.user?.id) {
        identifyUser(session.user.id);
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
    });

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
