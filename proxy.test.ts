import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { NextRequest } from 'next/server';

/**
 * FRESCO-782 (audit-6 A6-T10): `proxy()` is where the per-request CSP nonce is
 * minted (FRESCO-386). Nothing asserted that the header actually leaves the
 * proxy, so a refactor could drop it and every page would ship without a CSP
 * with CI green. Only `@supabase/ssr` is mocked (it would hit GoTrue); the CSP
 * builder and `NextResponse` are the real ones.
 */
let getSessionCalls = 0;

await mock.module('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getSession: async () => {
        getSessionCalls += 1;
        return { data: { session: null }, error: null };
      },
    },
  }),
}));

const { proxy, config } = await import('./proxy');

function requestTo(path = '/menu'): NextRequest {
  return new NextRequest(`https://fresco.test${path}`);
}

function nonceOf(csp: string): string | null {
  return /'nonce-([^']+)'/.exec(csp)?.[1] ?? null;
}

beforeEach(() => {
  getSessionCalls = 0;
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
