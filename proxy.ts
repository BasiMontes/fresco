import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth/is-admin';
import { clientEnv } from '@/lib/env';
import { buildContentSecurityPolicy, sentryCspReportUri } from '@/lib/security/csp';

/**
 * Runs on every non-static request. Two jobs:
 *
 * 1. **Session refresh.** This is the only place the Supabase session cookie
 *    actually gets rewritten — `lib/supabase/server.ts`'s `setAll` no-ops in
 *    a Server Component (Next.js forbids cookie writes there), so without
 *    this proxy the token would never refresh and auth would silently expire
 *    mid-session.
 *
 * 2. **CSP nonce (FRESCO-386 / A4-M10).** A fresh per-request nonce is put in
 *    the `Content-Security-Policy` request header (Next reads it and stamps
 *    every framework/page script with it) and the matching response header,
 *    plus `x-nonce` for any Server Component that needs it. This is why the
 *    CSP is enforced from here and not `next.config.mjs` — a static header
 *    has no request to derive a nonce from. Consequence: every page is now
 *    dynamically rendered (documented nonce tradeoff — no CDN caching).
 *
 * Named `proxy.ts` (not `middleware.ts`): Next.js 16 renamed the `middleware`
 * file convention to `proxy` — see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
 */
function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const reportUri = sentryCspReportUri(process.env.NEXT_PUBLIC_SENTRY_DSN);
  const csp = buildContentSecurityPolicy({
    nonce,
    isDev: process.env.NODE_ENV === 'development',
    reportUri,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

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
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // FRESCO-483: `getSession()`, not `getUser()`. Both would refresh the token
  // + rewrite the cookie when it is near expiry, but `getUser()` ALSO makes an
  // unconditional network round trip to GoTrue to verify the JWT on every
  // request — wasted work here, since the proxy does no access control (that
  // lives in `(app)/layout.tsx` via `getAuthUser()`). `getSession()` reads the
  // cookie locally and only hits the network when the access token is within
  // `@supabase/ssr`'s 90 s expiry margin, which is exactly when a refresh is
  // needed. The result is intentionally ignored — this call is fired only for
  // its refresh side effect.
  await supabase.auth.getSession();

  // FRESCO-840: real 404 for a signed-in non-admin on /admin/*. The page's own
  // `notFound()` runs under `(app)/loading.tsx`'s Suspense, after the response
  // started streaming, so its status stays 200; only a decision taken here,
  // before render, can set the status. `getUser()` (verified against GoTrue,
  // unlike the cookie-local `getSession()` above) runs ONLY on /admin paths, so
  // no other route pays the round trip. No session falls through untouched:
  // `(app)/layout.tsx` redirects it to /login. The page keeps its own
  // `isAdminUser()` gate and `delete-catalog-recipe` its `requireAdminUser()`;
  // this is the earliest of three layers, not the only one.
  if (isAdminPath(request.nextUrl.pathname)) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && !isAdminUser(user.id)) {
      const notFound = NextResponse.rewrite(new URL('/__admin-not-found', request.url), {
        request: { headers: requestHeaders },
        status: 404,
      });
      response.cookies.getAll().forEach(cookie => notFound.cookies.set(cookie));
      response = notFound;
    }
  }

  response.headers.set('Content-Security-Policy', csp);
  if (reportUri) {
    response.headers.set('Reporting-Endpoints', `csp-endpoint="${reportUri}"`);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
