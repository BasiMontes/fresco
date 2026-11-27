import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { NextRequest } from 'next/server';

/**
 * FRESCO-782 (audit-6 A6-T10): `proxy()` is where the per-request CSP nonce is
 * minted (FRESCO-386). Nothing asserted that the header actually leaves the
 * proxy, so a refactor could drop it and every page would ship without a CSP
 * with CI green. Only `@supabase/ssr` is mocked (it would hit GoTrue); the CSP
 * builder and `NextResponse` are the real ones.
 */
let getSessionCalls = 0;
let getUserCalls = 0;
let currentUser: { id: string } | null = null;
/** When set, `getSession()` behaves like a token renewal and writes this value to the session cookie. */
let renewedSessionCookie: string | null = null;

interface CookieAdapter {
  setAll: (cookies: { name: string, value: string, options: Record<string, unknown> }[]) => void
}

await mock.module('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, { cookies }: { cookies: CookieAdapter }) => ({
    auth: {
      getSession: async () => {
        getSessionCalls += 1;
        if (renewedSessionCookie) {
          cookies.setAll([{ name: 'sb-token', value: renewedSessionCookie, options: { path: '/' } }]);
        }
        return { data: { session: null }, error: null };
      },
      getUser: async () => {
        getUserCalls += 1;
        return { data: { user: currentUser }, error: null };
      },
    },
  }),
}));

const { proxy, config } = await import('./proxy');

function requestTo(path = '/menu'): NextRequest {
  return new NextRequest(`https://fresco.test${path}`);
}

/**
 * A request that arrives with a session cookie. Set through `cookies` because the happy-dom preload drops a
 * `cookie` header passed to the constructor.
 */
function signedRequestTo(path: string): NextRequest {
  const request = requestTo(path);
  request.cookies.set('sb-token', 'old');
  return request;
}

function nonceOf(csp: string): string | null {
  return /'nonce-([^']+)'/.exec(csp)?.[1] ?? null;
}

beforeEach(() => {
  getSessionCalls = 0;
  getUserCalls = 0;
  currentUser = null;
  renewedSessionCookie = null;
  process.env.ADMIN_USER_ID = 'admin-1';
});

describe('proxy — Content-Security-Policy', () => {
  it('sets a Content-Security-Policy response header carrying a nonce', async () => {
    const res = await proxy(requestTo());
    const csp = res.headers.get('Content-Security-Policy');

    expect(csp).toBeTruthy();
    const script = csp!.split('; ').find(d => d.startsWith('script-src ')) ?? '';
    expect(nonceOf(script)).toBeTruthy();
    expect(script).toContain('\'strict-dynamic\'');
    expect(script).not.toContain('\'unsafe-inline\'');
  });

  it('forwards the same nonce to the request via x-nonce and the request CSP header', async () => {
    const res = await proxy(requestTo());
    const csp = res.headers.get('Content-Security-Policy')!;
    const nonce = nonceOf(csp);

    // NextResponse.next({ request: { headers } }) exposes the overridden
    // request headers on the response as `x-middleware-request-<name>`.
    expect(res.headers.get('x-middleware-request-x-nonce')).toBe(nonce);
    expect(res.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
  });

  it('mints a fresh nonce on every request', async () => {
    const first = nonceOf((await proxy(requestTo())).headers.get('Content-Security-Policy')!);
    const second = nonceOf((await proxy(requestTo())).headers.get('Content-Security-Policy')!);

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
  });
});

describe('proxy — session refresh', () => {
  it('still refreshes the Supabase session on every request', async () => {
    await proxy(requestTo());
    await proxy(requestTo('/calendar'));

    expect(getSessionCalls).toBe(2);
  });

  // FRESCO-1306: the page of the very request that renews the session must read the new cookie, not the one
  // the browser sent.
  it('forwards the renewed session cookie to the page, keeping the proxy headers', async () => {
    renewedSessionCookie = 'new';

    const res = await proxy(signedRequestTo('/menu?semana=1'));
    const csp = res.headers.get('Content-Security-Policy')!;

    expect(res.headers.get('x-middleware-request-cookie')).toBe('sb-token=new');
    expect(res.headers.get('x-middleware-request-x-nonce')).toBe(nonceOf(csp));
    expect(res.headers.get('x-middleware-request-x-pathname')).toBe('/menu?semana=1');
    expect(res.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
    expect(res.cookies.get('sb-token')?.value).toBe('new');
  });

  it('forwards the renewed cookie on the admin 404 rewrite too', async () => {
    renewedSessionCookie = 'new';
    currentUser = { id: 'user-2' };

    const res = await proxy(signedRequestTo('/admin/recipes'));

    expect(res.status).toBe(404);
    expect(res.headers.get('x-middleware-request-cookie')).toBe('sb-token=new');
  });
});

/**
 * FRESCO-840: a `notFound()` thrown inside `app/(app)/admin/recipes/page.tsx`
 * runs under the route group's `loading.tsx` Suspense, after the response has
 * started streaming, so the status stays 200. The decision has to be taken here,
 * before render. Only a signed-in non-admin is rewritten; no session falls
 * through so `(app)/layout.tsx` keeps redirecting to /login.
 */
describe('proxy — admin routes answer a real 404 to non-admins', () => {
  it('returns 404 for a signed-in non-admin on /admin/recipes', async () => {
    currentUser = { id: 'user-2' };
    const res = await proxy(requestTo('/admin/recipes'));

    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy();
    expect(getUserCalls).toBe(1);
  });

  // FRESCO-1267: the body the person sees ("no encontrada") comes from rewriting to a path no route serves, so Next renders
  // `app/not-found.tsx`. The status test above would also pass with another mechanism that leaves the body of the admin page.
  it('rewrites the non-admin to a path no route serves, so the not-found page is what they see', async () => {
    currentUser = { id: 'user-2' };
    const res = await proxy(requestTo('/admin/recipes'));

    const target = new URL(res.headers.get('x-middleware-rewrite') ?? '');
    expect(target.pathname).toBe('/__admin-not-found');
    expect(existsSync(join(process.cwd(), 'app', '__admin-not-found'))).toBe(false);
  });

  it('lets the admin through untouched', async () => {
    currentUser = { id: 'admin-1' };
    const res = await proxy(requestTo('/admin/recipes'));

    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('falls through when there is no session, so the layout can redirect to /login', async () => {
    const res = await proxy(requestTo('/admin/recipes'));

    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('adds no GoTrue round trip outside /admin', async () => {
    currentUser = { id: 'user-2' };
    await proxy(requestTo('/menu'));
    await proxy(requestTo('/administrador'));

    expect(getUserCalls).toBe(0);
  });
});

/** A signed-in visitor on `/` keeps the public landing: the proxy never sends her to /menu. */
describe('proxy — the landing is not redirected for a signed-in visitor', () => {
  it('lets a signed-in request to / through, with no redirect and no rewrite', async () => {
    currentUser = { id: 'user-2' };
    const res = await proxy(requestTo('/'));

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });
});

describe('proxy — matcher', () => {
  it('skips static assets but covers app routes', () => {
    const pattern = new RegExp(`^${config.matcher[0]}$`);

    expect(pattern.test('/menu')).toBe(true);
    expect(pattern.test('/')).toBe(true);
    expect(pattern.test('/_next/static/chunk.js')).toBe(false);
    expect(pattern.test('/_next/image')).toBe(false);
    expect(pattern.test('/favicon.ico')).toBe(false);
  });
});

/**
 * FRESCO-1304: `/ingest` goes to PostHog, a third party. A `next.config` rewrite to another host forwards every
 * request header, the Supabase session cookie included, so the proxy does the rewrite and strips the credentials.
 */
describe('proxy — analytics never receives the session (FRESCO-1304)', () => {
  const originalHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://eu.i.posthog.com';
  });

  afterEach(() => {
    if (originalHost === undefined) {
      delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    }
    else {
      process.env.NEXT_PUBLIC_POSTHOG_HOST = originalHost;
    }
  });

  function signedInRequest(path: string): NextRequest {
    const request = requestTo(path);
    request.headers.set('cookie', 'sb-ref-auth-token=secret; theme=dark');
    request.headers.set('authorization', 'Bearer secret');
    request.headers.set('content-type', 'text/plain');
    // Guards the test itself: a DOM `Headers` refuses `cookie`, and the assertions below would pass for nothing.
    expect(request.headers.get('cookie')).toContain('sb-ref-auth-token');
    return request;
  }

  it.each([
    ['/ingest/e/?compression=gzip-js', 'https://eu.i.posthog.com/e/?compression=gzip-js'],
    ['/ingest/flags/', 'https://eu.i.posthog.com/flags/'],
    ['/ingest/array/phc_x/config.js', 'https://eu.i.posthog.com/array/phc_x/config.js'],
    ['/ingest/static/array.js', 'https://eu-assets.i.posthog.com/static/array.js'],
  ])('forwards %s without cookie or authorization', async (path, target) => {
    const res = await proxy(signedInRequest(path));
    const forwarded = (res.headers.get('x-middleware-override-headers') ?? '').split(',');

    expect(res.headers.get('x-middleware-rewrite')).toBe(target);
    expect(forwarded).toContain('content-type');
    expect(forwarded).not.toContain('cookie');
    expect(forwarded).not.toContain('authorization');
    expect(res.headers.get('x-middleware-request-cookie')).toBeNull();
    expect(res.headers.get('x-middleware-request-authorization')).toBeNull();
    expect(res.headers.get('x-middleware-request-host')).toBe(new URL(target).host);
  });

  it('does not touch the Supabase session for an analytics request', async () => {
    await proxy(signedInRequest('/ingest/e/'));

    expect(getSessionCalls).toBe(0);
  });

  it('cannot be pointed at another host through the path', async () => {
    const res = await proxy(signedInRequest('/ingest//evil.test/e'));

    expect(new URL(res.headers.get('x-middleware-rewrite') ?? '').host).toBe('eu.i.posthog.com');
  });

  it('rewrites nothing when no PostHog host is configured', async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    const res = await proxy(signedInRequest('/ingest/e/'));

    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('leaves no next.config rewrite that would forward the headers on its own', async () => {
    const { default: nextConfig } = await import('./next.config.mjs');

    expect((nextConfig as { rewrites?: unknown }).rewrites).toBeUndefined();
  });
});
