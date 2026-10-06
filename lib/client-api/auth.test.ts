import { beforeEach, describe, expect, mock, test } from 'bun:test';

/**
 * FRESCO-810 (ADR-0041): `lib/client-api/auth` is the only place a browser
 * component's auth call reaches the Supabase client. These pin that each
 * wrapper calls the right method with the right arguments, including the
 * Turnstile token as `options.captchaToken` (FRESCO-799).
 */

const signOutMock = mock(async () => ({ error: null }));
const getSessionMock = mock(async (): Promise<{ data: { session: { access_token: string } | null } }> => ({ data: { session: { access_token: 'tok-1' } } }));
const signInMock = mock(async (_credentials: unknown) => ({ data: { session: null }, error: null }));
const resetMock = mock(async (_email: string, _options: unknown) => ({ error: null }));

void mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: signOutMock,
      getSession: getSessionMock,
      signInWithPassword: signInMock,
      resetPasswordForEmail: resetMock,
    },
  }),
}));

const { getAccessToken, getSession, sendPasswordReset, signInWithPassword, signOut } = await import('@/lib/client-api/auth');

beforeEach(() => {
  signOutMock.mockClear();
  getSessionMock.mockClear();
  signInMock.mockClear();
  resetMock.mockClear();
});

describe('signOut', () => {
  test('ends the browser session', async () => {
    await signOut();

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});

describe('getSession', () => {
  test('returns the current browser session', async () => {
    expect(await getSession()).toEqual({ access_token: 'tok-1' });
  });

  test('returns null when there is none', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null } });

    expect(await getSession()).toBeNull();
  });
});

describe('getAccessToken', () => {
  test('returns the access token of the current session', async () => {
    expect(await getAccessToken()).toBe('tok-1');
  });

  test('returns null when there is no session', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null } });

    expect(await getAccessToken()).toBeNull();
  });
});

describe('signInWithPassword', () => {
  test('passes the credentials and the captcha token as options.captchaToken', async () => {
    await signInWithPassword({ email: 'a@b.es', password: 'secret-pass', captchaToken: 'cap-1' });

    expect(signInMock).toHaveBeenCalledWith({ email: 'a@b.es', password: 'secret-pass', options: { captchaToken: 'cap-1' } });
  });

  test('sends no captcha option when the captcha is off', async () => {
    await signInWithPassword({ email: 'a@b.es', password: 'secret-pass', captchaToken: null });

    expect(signInMock).toHaveBeenCalledWith({ email: 'a@b.es', password: 'secret-pass', options: { captchaToken: undefined } });
  });
});

describe('sendPasswordReset', () => {
  test('asks Supabase to email a reset link to that address, with the captcha token', async () => {
    await sendPasswordReset({ email: 'a@b.es', captchaToken: 'cap-2' });

    expect(resetMock).toHaveBeenCalledWith('a@b.es', { captchaToken: 'cap-2' });
  });
});
