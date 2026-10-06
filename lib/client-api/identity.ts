import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { loadSupabaseClient } from '@/lib/supabase/client-lazy';

// Re-exported here so a component that must stay light (the landing nav, the
// root-layout identity sync) imports ONE module for both halves of its check.
export { hasSupabaseSessionCookie } from '@/lib/supabase/session-cookie';

/**
 * ADR-0041, with FRESCO-505 / FRESCO-539 kept intact: this module is safe to
 * import statically from a root-layout component because it never imports the
 * Supabase client itself. `@/lib/supabase/client` is ~530 KiB of
 * `@supabase/supabase-js`; it is reached only through `loadSupabaseClient()`,
 * the single memoized dynamic import, and only AFTER the caller has seen a
 * session cookie. Do not import `@/lib/client-api/auth` (or any other
 * client-api module) from those components: they import the client statically.
 */

/** The current browser session, loading the client lazily. `null` when there is none. */
export async function getSessionLazy(): Promise<Session | null> {
  const { createClient } = await loadSupabaseClient();
  const { data: { session } } = await createClient().auth.getSession();
  return session;
}

interface WatchAuthStateArgs {
  onChange: (event: AuthChangeEvent, session: Session | null) => void
  /** Aborted when the caller unmounts; a subscription is not opened after that. */
  signal: AbortSignal
}

/**
 * Subscribes to auth state changes and returns the unsubscribe function.
 * The client loads asynchronously, so the caller may have unmounted by then:
 * if `signal` is already aborted nothing is subscribed (no callback can fire
 * after unmount) and the returned function is a no-op.
 */
export async function watchAuthState({ onChange, signal }: WatchAuthStateArgs): Promise<() => void> {
  const { createClient } = await loadSupabaseClient();
  if (signal.aborted) {
    return () => {};
  }
  const { data: { subscription } } = createClient().auth.onAuthStateChange(onChange);
  return () => subscription.unsubscribe();
}

/**
 * The user's display name, or `null` when there is none or the read failed
 * (a failed read must not break the nav: it just shows no greeting). Throws
 * only if the request itself rejects, like the query it replaces.
 */
export async function readProfileNombre(userId: string): Promise<string | null> {
  const { createClient } = await loadSupabaseClient();
  const { data } = await createClient()
    .from('user_profiles')
    .select('nombre')
    .eq('id', userId)
    .maybeSingle();
  return data?.nombre ?? null;
}
