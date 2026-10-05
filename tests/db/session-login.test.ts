/**
 * FRESCO-799 — `tests/session-login.ts` mints a usable session from the admin
 * API, proven against the real local Supabase stack.
 *
 * This is the path the post-deploy smoke and the staging Stripe suite take once
 * the hosted captcha is on and a password grant would need a Turnstile token.
 * The captcha itself is not on locally; what is pinned here is the other half:
 * the minted session is real (the REST API accepts its token, as the right
 * user), it comes with the cookies a browser needs, and an unknown email fails
 * without creating an account.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { SessionLoginConfig } from '../session-login';
import { createServerClient } from '@supabase/ssr';
import { afterAll, describe, expect, test } from 'bun:test';
import { mintSession } from '../session-login';
import { anonKey, createDbTestContext, nativeFetch, resolveUrl, rest, serviceRoleKey, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

async function localConfig(): Promise<SessionLoginConfig> {
  return {
    url: resolveUrl(),
    anonKey: await anonKey(),
    serviceRoleKey: await serviceRoleKey(),
    // `bun test` shims the global fetch with happy-dom's, which refuses the plain-HTTP local stack.
    fetch: nativeFetch,
  };
}

describe.skipIf(!(RUN && reachable))('session-login (real DB)', () => {
  const ctx = createDbTestContext();

  afterAll(async () => ctx.cleanupAll());

  test('mints a session whose token the REST API accepts, as that user', async () => {
    const user = await ctx.createUser();
    const session = await mintSession(user.email, await localConfig());

    expect(session.userId).toBe(user.id);
    expect(session.accessToken.length).toBeGreaterThan(20);

    const res = await rest('user_profiles', { token: session.accessToken, query: `id=eq.${user.id}&select=id` });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: user.id }]);
  });

  test('returns the Supabase auth cookies a browser needs, with a lifetime', async () => {
    const user = await ctx.createUser();
    const { cookies } = await mintSession(user.email, await localConfig());

    expect(cookies.length).toBeGreaterThan(0);
    for (const cookie of cookies) {
      expect(cookie.name).toMatch(/^sb-.+-auth-token(\.\d+)?$/);
      expect(cookie.value.length).toBeGreaterThan(0);
      expect(cookie.maxAge).toBeGreaterThan(0);
    }
  });

  test('the cookies are readable by a @supabase/ssr server client as that user', async () => {
    const user = await ctx.createUser();
    const config = await localConfig();
    const { cookies } = await mintSession(user.email, config);

    // The same read path the app's proxy / server components use.
    const reader = createServerClient(config.url, config.anonKey, {
      global: { fetch: nativeFetch },
      cookies: { getAll: () => cookies.map(({ name, value }) => ({ name, value })), setAll: () => {} },
    });
    const { data, error } = await reader.auth.getUser();
    expect(error).toBeNull();
    expect(data.user?.id).toBe(user.id);
  });

  test('an unknown email fails and creates no account', async () => {
    const email = `hola.frescoapp+nobody-${crypto.randomUUID()}@gmail.com`;
    await expect(mintSession(email, await localConfig())).rejects.toThrow('generate_link failed');

    const key = await serviceRoleKey();
    const list = await nativeFetch(`${resolveUrl()}/auth/v1/admin/users?per_page=1000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const { users } = await list.json() as { users: { email?: string }[] };
    expect(users.some(u => u.email === email)).toBe(false);
  });
});
