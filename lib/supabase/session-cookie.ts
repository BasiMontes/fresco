/**
 * Cheap synchronous check for whether a Supabase auth session cookie is
 * present, before paying the cost of loading the full client. FRESCO-539:
 * `IdentityCookieSync` and `SiteNav` used to call `loadSupabaseClient()`
 * unconditionally on every page mount (including the guest landing),
 * parsing ~530 KiB of `@supabase/supabase-js` for a guest who has never
 * signed in. `@supabase/ssr`'s browser client always names its cookie
 * `sb-<project-ref>-auth-token` (chunked as `.0`, `.1`, ... when large), so
 * a guest with zero session has no cookie matching this prefix.
 */
export function hasSupabaseSessionCookie(): boolean {
  return /(?:^|;\s*)sb-[^=]+-auth-token/.test(document.cookie);
}
