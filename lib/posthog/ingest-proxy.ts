import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * FRESCO-366 / A4-B4: PostHog reverse proxy. `posthog-js` posts to the same-origin `/ingest` path (see
 * app/providers/posthog-provider.tsx), so an ad-blocker filtering `*.posthog.com` can't drop client events.
 *
 * FRESCO-1304: it runs from `proxy.ts`, never as a `next.config` rewrite. A rewrite to another host forwards every
 * request header, and a same-origin request carries the Supabase session cookie, which PostHog must never receive.
 */

const PREFIX = '/ingest/';
const CREDENTIAL_HEADERS = ['cookie', 'authorization'];

/**
 * The rewrite to PostHog for an `/ingest` request, or `null` for any other path or when no host is configured.
 * `static/` lives on PostHog's asset host (`eu.i.posthog.com` → `eu-assets.i.posthog.com`).
 */
export function ingestRewrite(request: NextRequest, posthogHost: string | undefined): NextResponse | null {
  const { pathname, search } = request.nextUrl;
  if (!pathname.startsWith(PREFIX) || !posthogHost || !URL.canParse(posthogHost)) {
    return null;
  }

  // One leading slash: `//host` in the path must stay a path, never become the destination.
  const path = pathname.slice(PREFIX.length - 1).replace(/^\/+/, '/');
  const ingestOrigin = new URL(posthogHost).origin;
  const target = new URL(path.startsWith('/static/') ? ingestOrigin.replace('.i.posthog.com', '-assets.i.posthog.com') : ingestOrigin);
  target.pathname = path;
  target.search = search;

  const headers = new Headers(request.headers);
  CREDENTIAL_HEADERS.forEach(name => headers.delete(name));
  headers.set('host', target.host);

  return NextResponse.rewrite(target, { request: { headers } });
}
