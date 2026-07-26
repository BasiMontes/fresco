import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { clientEnv } from '@/lib/env';

/**
 * Refreshes the Supabase session cookie on every non-static request. This is
 * the only place that write actually happens — `lib/supabase/server.ts`'s
 * `setAll` no-ops when called from a Server Component (Next.js forbids
 * cookie writes there), so without this proxy the session cookie would never
 * refresh and auth would silently expire mid-session.
 *
 * Named `proxy.ts` (not `middleware.ts`): Next.js 16 deprecated and renamed
 * the `middleware` file convention to `proxy` — see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touching auth.getUser() is what actually triggers the token refresh +
  // cookie rewrite above when the access token is near/past expiry.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
