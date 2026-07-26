import type { Database } from './types';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { clientEnv } from '@/lib/env';

/**
 * Server-side Supabase client for Server Components, Server Actions, and
 * Route Handlers. `cookies()` is async in this Next.js version, so this
 * factory is async too — call sites must `await createClient()`.
 *
 * `setAll` is wrapped in try/catch because the Next.js docs (cookies.md,
 * "Understanding Cookie Behavior in Server Components") forbid writing
 * cookies during Server Component render — only a Server Action or Route
 * Handler may. Reads (e.g. `supabase.auth.getUser()`) still work fine from a
 * Server Component; the try/catch just no-ops the session-refresh write in
 * that context and relies on middleware to refresh the session cookie
 * instead, per `@supabase/ssr`'s documented Next.js pattern.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
          catch {
            // Called from a Server Component — see doc comment above.
          }
        },
      },
    },
  );
}
