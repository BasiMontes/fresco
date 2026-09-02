import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
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

  // Touching auth.getUser() is what actually triggers the token refresh +
  // cookie rewrite above when the access token is near/past expiry.
  await supabase.auth.getUser();

  response.headers.set('Content-Security-Policy', csp);
  if (reportUri) {
    response.headers.set('Reporting-Endpoints', `csp-endpoint="${reportUri}"`);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
