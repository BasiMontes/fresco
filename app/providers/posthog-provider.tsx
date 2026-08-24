'use client';

import type { ReactNode } from 'react';
import posthog from 'posthog-js';
import { useEffect } from 'react';
import { identifyUser } from '@/lib/posthog/events';
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
      });
      initialized = true;
    }

    if (!key) {
      return;
    }

    const client = createClient();
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        identifyUser(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
