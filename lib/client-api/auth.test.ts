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

const getUserMock = mock(async (): Promise<{ data: { user: { id: string, is_anonymous: boolean } | null } }> => ({ data: { user: { id: 'user-1', is_anonymous: true } } }));
const updateUserMock = mock(async (_attributes: unknown) => ({ data: { user: null }, error: null }));
const verifyOtpMock = mock(async (_params: unknown) => ({ data: { session: null }, error: null }));
const setSessionMock = mock(async (_tokens: unknown) => ({ data: { user: null }, error: null }));
const anonymousMock = mock(async (_options: unknown) => ({ data: { session: null }, error: null }));
const signUpMock = mock(async (_args: unknown) => ({ data: { user: null, session: null }, error: null }));

void mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: signOutMock,
      getSession: getSessionMock,
      signInWithPassword: signInMock,
      resetPasswordForEmail: resetMock,
      signInAnonymously: anonymousMock,
      getUser: getUserMock,
      updateUser: updateUserMock,
      verifyOtp: verifyOtpMock,
      setSession: setSessionMock,
      signUp: signUpMock,
    },
  }),
}));

const { adoptSession, getAccessToken, getCurrentUser, getSession, requestEmailChange, sendPasswordReset, signInAnonymously, signInWithPassword, signOut, signUp, updatePassword, verifyEmailChangeOtp } = await import('@/lib/client-api/auth');

beforeEach(() => {
  signOutMock.mockClear();
  getSessionMock.mockClear();
  signInMock.mockClear();
  resetMock.mockClear();
  anonymousMock.mockClear();
  getUserMock.mockClear();
  updateUserMock.mockClear();
  verifyOtpMock.mockClear();
  setSessionMock.mockClear();
  signUpMock.mockClear();
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

describe('signInAnonymously', () => {
  test('starts a guest session with the captcha token as options.captchaToken', async () => {
    await signInAnonymously({ captchaToken: 'cap-3' });

    expect(anonymousMock).toHaveBeenCalledWith({ options: { captchaToken: 'cap-3' } });
  });
});

describe('signUp', () => {
  test('creates the account with the confirmation redirect, the captcha token and the metadata', async () => {
    await signUp({
      email: 'a@b.es',
      password: 'secret-pass',
      captchaToken: 'cap-4',
      emailRedirectTo: 'https://fresco.test/auth/confirm?next=/onboarding',
      metadata: { consents_pending: ['terms'] },
    });

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'a@b.es',
      password: 'secret-pass',
      options: {
        captchaToken: 'cap-4',
        emailRedirectTo: 'https://fresco.test/auth/confirm?next=/onboarding',
        data: { consents_pending: ['terms'] },
      },
    });
  });
});

describe('guest-to-account conversion (FRESCO-89)', () => {
  test('getCurrentUser returns the signed-in user, a guest included', async () => {
    expect(await getCurrentUser()).toEqual({ id: 'user-1', is_anonymous: true });
  });

  test('getCurrentUser returns null when there is no session', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });

    expect(await getCurrentUser()).toBeNull();
  });

  test('requestEmailChange links only the email (the password waits for the verified code)', async () => {
    await requestEmailChange('a@b.es');

    expect(updateUserMock).toHaveBeenCalledWith({ email: 'a@b.es' });
  });

  test('verifyEmailChangeOtp verifies the code as an email_change', async () => {
    await verifyEmailChangeOtp({ email: 'a@b.es', token: '123456' });

    expect(verifyOtpMock).toHaveBeenCalledWith({ email: 'a@b.es', token: '123456', type: 'email_change' });
  });

  test('updatePassword sets only the password', async () => {
    await updatePassword('secret-pass');

    expect(updateUserMock).toHaveBeenCalledWith({ password: 'secret-pass' });
  });
});

describe('adoptSession', () => {
  test('switches the main client to the given tokens instead of signing in again', async () => {
    await adoptSession({ accessToken: 'acc', refreshToken: 'ref' });

    expect(setSessionMock).toHaveBeenCalledWith({ access_token: 'acc', refresh_token: 'ref' });
  });
});
