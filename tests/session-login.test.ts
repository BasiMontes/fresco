import { afterEach, describe, expect, it } from 'bun:test';
import { sessionLoginConfigFromEnv, sessionLoginEnabled, toPlaywrightCookies } from './session-login';

const BASE_URL = 'https://fresco-pre.vercel.app';

describe('toPlaywrightCookies', () => {
  it('scopes every cookie to the app under test and turns maxAge into an absolute expiry', () => {
    const cookies = toPlaywrightCookies(
      [{ name: 'sb-abc-auth-token', value: 'base64-xyz', maxAge: 400 * 24 * 3600, sameSite: 'lax' }],
      BASE_URL,
      1_000,
    );
    expect(cookies).toEqual([
      { name: 'sb-abc-auth-token', value: 'base64-xyz', url: BASE_URL, expires: 1_000 + 400 * 24 * 3600, sameSite: 'Lax' },
    ]);
  });

  it('keeps chunked cookies as separate entries and defaults SameSite to Lax', () => {
    const cookies = toPlaywrightCookies(
      [{ name: 'sb-abc-auth-token.0', value: 'a' }, { name: 'sb-abc-auth-token.1', value: 'b', sameSite: 'strict' }],
      BASE_URL,
      0,
    );
    expect(cookies.map(c => c.name)).toEqual(['sb-abc-auth-token.0', 'sb-abc-auth-token.1']);
    expect(cookies.map(c => c.sameSite)).toEqual(['Lax', 'Strict']);
    expect(cookies[0].expires).toBeUndefined();
  });
});

describe('session login switches', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('is off unless E2E_SESSION_LOGIN is exactly 1, so the default suite still signs in through the form', () => {
    delete process.env.E2E_SESSION_LOGIN;
    expect(sessionLoginEnabled()).toBe(false);
    process.env.E2E_SESSION_LOGIN = 'true';
    expect(sessionLoginEnabled()).toBe(false);
    process.env.E2E_SESSION_LOGIN = '1';
    expect(sessionLoginEnabled()).toBe(true);
  });

  it('refuses to run without the service-role key instead of falling back silently', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => sessionLoginConfigFromEnv()).toThrow('SUPABASE_SERVICE_ROLE_KEY');
  });
});
