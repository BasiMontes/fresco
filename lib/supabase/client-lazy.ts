import type { createClient } from './client';

/**
 * FRESCO-505: a single, memoized dynamic-import point for `./client`.
 *
 * `@/lib/supabase/client` pulls in the whole `@supabase/supabase-js` client
 * (realtime + storage + postgrest + functions, ~530 KiB uncompressed —
 * `SupabaseClient`'s constructor wires up every sub-client regardless of
 * which one a caller uses). Three root-layout-mounted client components
 * (`IdentityCookieSync`, `SiteNav`, `PostHogProvider`) each need it after
 * mount, not in their critical initial bundle — but three independent
 * `import('@/lib/supabase/client')` call sites each become their own async
 * chunk (bundlers don't dedupe distinct call sites), so the same ~530 KiB
 * would download two or three times on one page load instead of once.
 * Routing every lazy caller through this single memoized call site collapses
 * that back to one chunk, fetched at most once per page load.
 */
let modulePromise: Promise<{ createClient: typeof createClient }> | null = null;

export async function loadSupabaseClient(): Promise<{ createClient: typeof createClient }> {
  modulePromise ??= import('./client');
  return modulePromise;
}
