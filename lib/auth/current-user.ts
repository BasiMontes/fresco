import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/**
 * FRESCO-483 — the single server-side session verification for one render.
 *
 * `@supabase/ssr`'s `auth.getUser()` never caches: every call is a full
 * network round trip to GoTrue to verify the JWT (~100-250 ms). An
 * authenticated page used to chain three of them — `proxy.ts`, `(app)/`
 * layout, and the page itself — plus the `lib/api/*` helpers' own fallback
 * calls.
 *
 * `React.cache()` memoizes for the duration of ONE server render and is
 * cleared before the next request, so there is no cross-user leak. Every
 * caller in the same render — layout, page, and any `lib/api/*` helper
 * invoked without an explicit `userId` — shares one verified call.
 *
 * Use this for access-control and identity reads in Server Components. The
 * proxy deliberately does NOT use it: it only needs to trigger a token
 * refresh, which `auth.getSession()` does locally (no network) unless the
 * token is within its expiry margin.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  return supabase.auth.getUser();
});
