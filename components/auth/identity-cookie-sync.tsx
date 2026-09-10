'use client';

import { useEffect, useRef } from 'react';
import { clearNombreCookie, readNombreCookie, writeNombreCookie } from '@/lib/auth/identity-cookie';
import { createClient } from '@/lib/supabase/client';

/**
 * Keeps the `fresco_nombre` cookie (`lib/auth/identity-cookie.ts`) in sync
 * with the Supabase session so the landing nav
 * (`components/landing/site-nav.tsx`) can greet a returning logged-in
 * visitor without a name query on the render path (FRESCO-486).
 *
 * Its own `onAuthStateChange` subscription — deliberately NOT the one in
 * `posthog-provider.tsx`, which is gated behind cookie consent (ADR-0025).
 * This cookie is functional, not analytics: it must be written even for a
 * visitor who rejected analytics cookies.
 *
 * - real user (`is_anonymous !== true`) → one lightweight `user_profiles`
 *   read for `nombre` → write (or clear) the cookie. De-duped per
 *   `auth.uid()` for this component's lifetime.
 * - anonymous guest → no `user_profiles` row, no query, no cookie. The
 *   guest still gets the "Ir a mi menú" nav from `getSession()`, just no
 *   greeting.
 * - `SIGNED_OUT` / no session → clear the cookie.
 *
 * Renders nothing. Mounted once in `app/layout.tsx`.
 */
export function IdentityCookieSync() {
  const syncedUid = useRef<string | null>(null);

  useEffect(() => {
    const client = createClient();

    async function syncNombre(userId: string): Promise<void> {
      if (syncedUid.current === userId && readNombreCookie()) { return; }
      syncedUid.current = userId;
      try {
        const { data } = await client
          .from('user_profiles')
          .select('nombre')
          .eq('id', userId)
          .maybeSingle();
        const nombre = data?.nombre?.trim();
        if (nombre) { writeNombreCookie(nombre); }
        else { clearNombreCookie(); }
      }
      catch {
        // Fail-soft (§10 Errors): a profile-read blip just leaves the nav
        // without a greeting — it still shows "Ir a mi menú" via getSession().
      }
    }

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      const user = session?.user;

      if (event === 'SIGNED_OUT' || !user) {
        syncedUid.current = null;
        if (readNombreCookie()) { clearNombreCookie(); }
        return;
      }

      if (user.is_anonymous === true) {
        if (readNombreCookie()) { clearNombreCookie(); }
        return;
      }

      void syncNombre(user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
