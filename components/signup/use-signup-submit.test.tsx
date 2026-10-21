import type { FormEvent } from 'react';
import type { Captcha } from '@/components/auth/use-captcha';
import { AuthApiError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as authApi from '@/lib/client-api/auth';
import * as consentClient from '@/lib/legal/consent-client';
import { PASSWORD_TOO_SHORT_MESSAGE } from '@/lib/validation/password-policy';
import * as pwned from '@/lib/validation/pwned-password';
import { act, renderHook } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';
import { useSignupSubmit } from './use-signup-submit';

const FAKE_EMAIL = 'test-user@example.com';
const FAKE_PASSWORD = 'fake-password-123';

const setEmailConflict = mock((_value: boolean) => {});
const setStep = mock((_step: 'form' | 'otp') => {});
const setSignupPendingConfirmation = mock((_value: boolean) => {});
const setNavigating = mock((_value: boolean) => {});
const captchaReset = mock(() => {});
const captcha = { token: 'fake-captcha-token', reset: captchaReset } as unknown as Captcha;

type UserResult = Awaited<ReturnType<typeof authApi.getCurrentUser>>;
type SignUpResult = Awaited<ReturnType<typeof authApi.signUp>>;

const guest = { is_anonymous: true } as unknown as UserResult;
const signedUp = (overrides: { identities?: unknown[], session?: unknown } = {}) =>
  ({
    data: { user: { identities: overrides.identities ?? [{}] }, session: 'session' in overrides ? overrides.session : null },
    error: null,
  }) as unknown as SignUpResult;

let getUserSpy: ReturnType<typeof spyOn<typeof authApi, 'getCurrentUser'>>;
let signUpSpy: ReturnType<typeof spyOn<typeof authApi, 'signUp'>>;
let emailChangeSpy: ReturnType<typeof spyOn<typeof authApi, 'requestEmailChange'>>;
let consentsSpy: ReturnType<typeof spyOn<typeof consentClient, 'postConsents'>>;
let pwnedSpy: ReturnType<typeof spyOn<typeof pwned, 'isPasswordPwned'>>;
let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;

beforeEach(() => {
  for (const fn of [setEmailConflict, setStep, setSignupPendingConfirmation, setNavigating, captchaReset, routerMock.push]) {
    fn.mockClear();
  }
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
  getUserSpy = spyOn(authApi, 'getCurrentUser').mockResolvedValue(null);
  signUpSpy = spyOn(authApi, 'signUp').mockResolvedValue(signedUp());
  emailChangeSpy = spyOn(authApi, 'requestEmailChange').mockResolvedValue({ error: null });
  consentsSpy = spyOn(consentClient, 'postConsents').mockResolvedValue(true);
  pwnedSpy = spyOn(pwned, 'isPasswordPwned').mockResolvedValue(false);
});

afterEach(() => {
  for (const spy of [getUserSpy, signUpSpy, emailChangeSpy, consentsSpy, pwnedSpy, errorSpy]) {
    spy.mockRestore();
  }
});

function setup(password = FAKE_PASSWORD) {
  return renderHook(() => useSignupSubmit({ email: FAKE_EMAIL, password, captcha, setEmailConflict, setStep, setSignupPendingConfirmation, setNavigating }));
}

type Hook = ReturnType<typeof setup>;

async function submit(hook: Hook, { consent = true }: { consent?: boolean } = {}) {
  if (consent) {
    act(() => {
      hook.result.current.setAgeConfirmed(true);
      hook.result.current.setAcceptedTerms(true);
    });
  }
  await act(async () => {
    await hook.result.current.handleSubmit({ preventDefault: () => {} } as FormEvent<HTMLFormElement>);
  });
}

describe('useSignupSubmit consent and password gates', () => {
  test('without age or terms it names both and calls nothing', async () => {
    const hook = setup();

    await submit(hook, { consent: false });

    expect(hook.result.current.ageError).toBe('Confirma que tienes 14 años o más para continuar.');
    expect(hook.result.current.termsError).toContain('Términos de Servicio');
    expect(getUserSpy).not.toHaveBeenCalled();
    expect(signUpSpy).not.toHaveBeenCalled();
  });

  test('only the missing consent is reported', async () => {
    const hook = setup();
    act(() => hook.result.current.setAgeConfirmed(true));

    await submit(hook, { consent: false });

    expect(hook.result.current.ageError).toBeNull();
    expect(hook.result.current.termsError).not.toBeNull();
  });

  test('a password that is too short is rejected before any request', async () => {
    const hook = setup('short');

    await submit(hook);

    expect(hook.result.current.signupError).toBe(PASSWORD_TOO_SHORT_MESSAGE);
    expect(pwnedSpy).not.toHaveBeenCalled();
    expect(signUpSpy).not.toHaveBeenCalled();
  });

  test('a known-breached password is rejected and the form is released', async () => {
    pwnedSpy.mockResolvedValueOnce(true);
    const hook = setup();

    await submit(hook);

    expect(hook.result.current.signupError).toBe(pwned.PWNED_PASSWORD_MESSAGE);
    expect(hook.result.current.isSubmitting).toBe(false);
    expect(signUpSpy).not.toHaveBeenCalled();
  });
});

describe('useSignupSubmit new account', () => {
  test('signs up with the consents in the metadata and waits for email confirmation when there is no session', async () => {
    const hook = setup();

    await submit(hook);

    expect(signUpSpy).toHaveBeenCalledTimes(1);
    const args = signUpSpy.mock.calls[0][0];
    expect(args.email).toBe(FAKE_EMAIL);
    expect(args.captchaToken).toBe('fake-captcha-token');
    expect(args.emailRedirectTo).toBe(`${window.location.origin}/auth/confirm?next=/onboarding`);
    expect(args.metadata).toEqual({ [consentClient.CONSENT_PENDING_KEY]: consentClient.REGISTRATION_CONSENTS });
    expect(setEmailConflict).toHaveBeenCalledWith(false);
    expect(setSignupPendingConfirmation).toHaveBeenCalledWith(true);
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(captchaReset).toHaveBeenCalled();
    expect(hook.result.current.isSubmitting).toBe(false);
  });

  test('goes straight to onboarding when Auth already returned a session', async () => {
    signUpSpy.mockResolvedValueOnce(signedUp({ session: { access_token: 'fake' } }));
    const hook = setup();

    await submit(hook);

    expect(setNavigating).toHaveBeenCalledWith(true);
    expect(routerMock.push).toHaveBeenCalledWith('/onboarding');
    expect(setSignupPendingConfirmation).not.toHaveBeenCalled();
  });

  test('an email that already has an account points her to log in', async () => {
    signUpSpy.mockResolvedValueOnce(signedUp({ identities: [] }));
    const hook = setup();

    await submit(hook);

    expect(hook.result.current.signupError).toBe('Ya existe una cuenta con ese email. Inicia sesión en su lugar.');
    expect(setSignupPendingConfirmation).not.toHaveBeenCalled();
  });

  test('shows the translated error when sign-up fails', async () => {
    signUpSpy.mockResolvedValueOnce({ data: { user: null, session: null }, error: new AuthApiError('weak', 422, 'weak_password') });
    const hook = setup();

    await submit(hook);

    expect(hook.result.current.signupError).not.toBeNull();
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(hook.result.current.isSubmitting).toBe(false);
  });
});

describe('useSignupSubmit guest conversion', () => {
  beforeEach(() => {
    getUserSpy.mockResolvedValue(guest);
  });

  test('records the consents, requests the email change and moves to the code step', async () => {
    const hook = setup();

    await submit(hook);

    expect(consentsSpy).toHaveBeenCalledWith(consentClient.REGISTRATION_CONSENTS);
    expect(emailChangeSpy).toHaveBeenCalledWith({ email: FAKE_EMAIL, captchaToken: 'fake-captcha-token' });
    expect(setStep).toHaveBeenCalledWith('otp');
    expect(signUpSpy).not.toHaveBeenCalled();
    expect(captchaReset).toHaveBeenCalled();
  });

  test('stops with a retryable message when the consents cannot be recorded', async () => {
    consentsSpy.mockResolvedValueOnce(false);
    const hook = setup();

    await submit(hook);

    expect(hook.result.current.signupError).toBe('No pudimos registrar tu aceptación. Inténtalo de nuevo.');
    expect(emailChangeSpy).not.toHaveBeenCalled();
    expect(setStep).not.toHaveBeenCalled();
  });

  test('flags an email that belongs to another account', async () => {
    emailChangeSpy.mockResolvedValueOnce({ error: new AuthApiError('exists', 422, 'email_exists') });
    const hook = setup();

    await submit(hook);

    expect(setEmailConflict).toHaveBeenLastCalledWith(true);
    expect(hook.result.current.signupError).toBeNull();
    expect(setStep).not.toHaveBeenCalled();
  });

  test('shows the translated error for any other email-change failure', async () => {
    emailChangeSpy.mockResolvedValueOnce({ error: new AuthApiError('rate', 429, 'over_email_send_rate_limit') });
    const hook = setup();

    await submit(hook);

    expect(hook.result.current.signupError).not.toBeNull();
    expect(setStep).not.toHaveBeenCalled();
  });
});

describe('useSignupSubmit double submit', () => {
  test('a second submit while the first is running is ignored', async () => {
    let release: (value: UserResult) => void = () => {};
    getUserSpy.mockReturnValueOnce(new Promise<UserResult>((resolve) => { release = resolve; }));
    const hook = setup();
    act(() => {
      hook.result.current.setAgeConfirmed(true);
      hook.result.current.setAcceptedTerms(true);
    });

    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      first = hook.result.current.handleSubmit({ preventDefault: () => {} } as FormEvent<HTMLFormElement>);
      await Promise.resolve();
    });
    await act(async () => {
      await hook.result.current.handleSubmit({ preventDefault: () => {} } as FormEvent<HTMLFormElement>);
    });
    await act(async () => {
      release(null);
      await first;
    });

    expect(signUpSpy).toHaveBeenCalledTimes(1);
  });
});
