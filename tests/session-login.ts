import type { Page } from '@playwright/test';
import { createServerClient } from '@supabase/ssr';

/**
 * FRESCO-799 — sessions for the e2e suite that never go through a password
 * sign-in.
 *
 * Once the Supabase captcha is on (hosted), every `/auth/v1/token?grant_type=
 * password` call needs a Turnstile token, from the API as much as from the
 * `/login` form. A CI job has no human to solve a challenge, so against a
 * hosted backend the suite obtains its sessions from the admin API instead:
 *
 *   1. `POST /auth/v1/admin/generate_link` (service-role) returns a one-time
 *      `hashed_token` for the user. It sends no email.
 *   2. `verifyOtp({ token_hash, type: 'recovery' })` redeems it for a real
 *      session. The verify endpoint is not captcha-protected.
 *
 * The redeem runs on a `@supabase/ssr` server client whose cookie jar we hold,
 * so the cookies a browser needs are produced by the library itself (name,
 * base64url encoding, chunking) rather than re-implemented here.
 *
 * Opt-in: `E2E_SESSION_LOGIN=1`. Unset, the suite keeps signing in through the
 * real form and the password grant, which is what the local-stack e2e job
 * wants (no captcha there, and it exercises the real login UI).
 *
 * This is test infrastructure for CI against our own test accounts. It holds
 * the service-role key the suite already needs for `testUserFactory`; it must
 * never be pointed at an account that is not a test account.
 */

export interface SessionLoginConfig {
  url: string
  anonKey: string
  serviceRoleKey: string
  /** Override for runtimes whose global `fetch` is shimmed (happy-dom in `bun test`). */
  fetch?: typeof fetch
}

export interface SessionCookie {
  name: string
  value: string
  /** Seconds, as `@supabase/ssr` sets it. */
  maxAge?: number
  sameSite?: 'lax' | 'strict' | 'none' | boolean
}

export interface MintedSession {
  accessToken: string
  refreshToken: string
  userId: string
  cookies: SessionCookie[]
}

export function sessionLoginEnabled(): boolean {
  return process.env.E2E_SESSION_LOGIN === '1';
}

export function sessionLoginConfigFromEnv(): SessionLoginConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      '[session-login] NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be set.',
    );
  }
  return { url, anonKey, serviceRoleKey };
}

/**
 * Mints a session for `email` through the admin API. Error messages carry the
 * status or the Auth error code only: a response body here can hold a token.
 */
export async function mintSession(
  email: string,
  config: SessionLoginConfig = sessionLoginConfigFromEnv(),
): Promise<MintedSession> {
  const doFetch = config.fetch ?? fetch;

  const linkRes = await doFetch(`${config.url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'apikey': config.serviceRoleKey,
      'Authorization': `Bearer ${config.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    // 'recovery', not 'magiclink': a magic link CREATES the user when the email
    // is unknown, so a typo would leave a stray account on the real project.
    body: JSON.stringify({ type: 'recovery', email }),
  });
  if (!linkRes.ok) {
    throw new Error(`[session-login] generate_link failed for the test account: HTTP ${linkRes.status}`);
  }
  const { hashed_token: tokenHash } = await linkRes.json() as { hashed_token?: string };
  if (!tokenHash) {
    throw new Error('[session-login] generate_link returned no hashed_token');
  }

  const jar = new Map<string, SessionCookie>();
  const client = createServerClient(config.url, config.anonKey, {
    global: { fetch: doFetch },
    cookies: {
      getAll: () => [...jar.values()].map(({ name, value }) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) {
          if (value) {
            jar.set(name, { name, value, maxAge: options?.maxAge, sameSite: options?.sameSite });
          }
          else {
            jar.delete(name);
          }
        }
      },
    },
  });

  const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
  if (error || !data.session || !data.user) {
    throw new Error(`[session-login] verifyOtp failed: ${error?.code ?? 'no session returned'}`);
  }
  if (jar.size === 0) {
    throw new Error('[session-login] the session was minted but no cookies were produced');
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    userId: data.user.id,
    cookies: [...jar.values()],
  };
}

type PlaywrightCookie = Parameters<ReturnType<Page['context']>['addCookies']>[0][number];

function toSameSite(value: SessionCookie['sameSite']): PlaywrightCookie['sameSite'] {
  if (value === 'strict') { return 'Strict'; }
  if (value === 'none') { return 'None'; }
  return 'Lax';
}

/** Cookies in the shape `context.addCookies` takes, scoped to the app under test. */
export function toPlaywrightCookies(
  cookies: SessionCookie[],
  baseUrl: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): PlaywrightCookie[] {
  return cookies.map(cookie => ({
    name: cookie.name,
    value: cookie.value,
    url: baseUrl,
    expires: cookie.maxAge ? nowSeconds + cookie.maxAge : undefined,
    sameSite: toSameSite(cookie.sameSite),
  }));
}

/**
 * Signs the browser in as `email` without touching `/login`. The caller
 * navigates afterwards (the cookie is read on the next request).
 */
export async function signInBrowserViaSession(page: Page, email: string): Promise<void> {
  const { cookies } = await mintSession(email);
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
  await page.context().addCookies(toPlaywrightCookies(cookies, baseUrl));
}
