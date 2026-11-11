import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';

/**
 * FRESCO-410 — `GET /auth/confirm` verifies a Supabase email-link OTP
 * (`token_hash` + `type`) and redirects. `safeNextPath` (`lib/auth`) keeps
 * its own tests; this pins the handler: verified → redirect to a sanitised
 * `next`, unverified/missing → the invalid-link page, and that an
 * attacker-controlled `next` cannot become an open redirect.
 */

const verifyOtp = mock(async (_p: unknown): Promise<{ error: unknown }> => ({ error: null }));
void mock.module('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { verifyOtp } }) }));

const { GET } = await import('./route');

function req(params: Record<string, string>) {
  const url = new URL('https://test.fresco.local/auth/confirm');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

beforeEach(() => {
  verifyOtp.mockClear();
  verifyOtp.mockResolvedValue({ error: null });
});

describe('GET /auth/confirm', () => {
  test('redirects to next after a successful verification', async () => {
    const res = await GET(req({ token_hash: 'th', type: 'recovery', next: '/update-password' }));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/update-password');
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'th' });
  });

  test('collapses an attacker-controlled next to a same-origin path', async () => {
    const res = await GET(req({ token_hash: 'th', type: 'recovery', next: '//evil.com' }));

    const location = new URL(res.headers.get('location')!);
    expect(location.origin).toBe('https://test.fresco.local');
    expect(location.pathname).toBe('/');
  });

  test('redirects to the invalid-link page when verifyOtp errors', async () => {
    verifyOtp.mockResolvedValue({ error: new Error('expired') });

    const res = await GET(req({ token_hash: 'th', type: 'recovery' }));

    expect(new URL(res.headers.get('location')!).search).toBe('?error=invalid_link');
  });

  test('redirects to the invalid-link page when token_hash or type is missing', async () => {
    const res = await GET(req({ next: '/menu' }));

    expect(new URL(res.headers.get('location')!).pathname).toBe('/forgot-password');
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  /**
   * FRESCO-1187: an expired or already used SIGNUP link used to land on the password-recovery screen. It goes to the
   * login now (which explains it and, with an unconfirmed email, offers to resend); every other type is unchanged.
   */
  describe('an expired or invalid signup link (FRESCO-1187)', () => {
    test('goes to the login with its own flag, not to the password-recovery screen', async () => {
      verifyOtp.mockResolvedValue({ error: new Error('Email link is invalid or has expired') });

      const res = await GET(req({ token_hash: 'th', type: 'signup', next: '/onboarding' }));

      const location = new URL(res.headers.get('location')!);
      expect(location.pathname).toBe('/login');
      expect(location.search).toBe('?error=expired_signup_link');
    });

    test('a valid signup link still goes to next', async () => {
      const res = await GET(req({ token_hash: 'th', type: 'signup', next: '/onboarding' }));

      expect(new URL(res.headers.get('location')!).pathname).toBe('/onboarding');
    });

    test('a recovery link that fails keeps the recovery screen', async () => {
      verifyOtp.mockResolvedValue({ error: new Error('expired') });

      const res = await GET(req({ token_hash: 'th', type: 'recovery' }));

      expect(new URL(res.headers.get('location')!).pathname).toBe('/forgot-password');
    });

    test('a link with no type keeps the recovery screen', async () => {
      const res = await GET(req({ token_hash: 'th' }));

      expect(new URL(res.headers.get('location')!).pathname).toBe('/forgot-password');
    });
  });
});
