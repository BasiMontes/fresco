import type { FormEvent } from 'react';
import type { Captcha } from '@/components/auth/use-captcha';
import { AuthApiError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as authApi from '@/lib/client-api/auth';
import { POSTHOG_EVENTS } from '@/lib/posthog/event-names';
import * as events from '@/lib/posthog/events';
import { act, renderHook } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';
import { useSignupOtp } from './use-signup-otp';

const FAKE_EMAIL = 'test-user@example.com';
const FAKE_PASSWORD = 'fake-password-123';

const setEmailConflict = mock((_value: boolean) => {});
const setNavigating = mock((_value: boolean) => {});
const captchaReset = mock(() => {});
const captcha = { token: 'fake-captcha-token', reset: captchaReset } as unknown as Captcha;

type VerifyResult = Awaited<ReturnType<typeof authApi.verifyEmailChangeOtp>>;
type PasswordResult = Awaited<ReturnType<typeof authApi.updatePassword>>;

const verifyOk = { data: { user: null, session: null }, error: null } as unknown as VerifyResult;
const verifyFailed = (code: string) => ({ data: { user: null, session: null }, error: new AuthApiError('failed', 400, code) }) as unknown as VerifyResult;
const passwordOk = { data: { user: {} }, error: null } as unknown as PasswordResult;
const passwordFailed = (code: string) => ({ data: { user: null }, error: new AuthApiError('failed', 422, code) }) as unknown as PasswordResult;

let verifySpy: ReturnType<typeof spyOn<typeof authApi, 'verifyEmailChangeOtp'>>;
let passwordSpy: ReturnType<typeof spyOn<typeof authApi, 'updatePassword'>>;
let resendSpy: ReturnType<typeof spyOn<typeof authApi, 'requestEmailChange'>>;
let captureSpy: ReturnType<typeof spyOn<typeof events, 'captureEvent'>>;

beforeEach(() => {
  for (const fn of [setEmailConflict, setNavigating, captchaReset, routerMock.push, routerMock.refresh]) {
    fn.mockClear();
  }
  verifySpy = spyOn(authApi, 'verifyEmailChangeOtp').mockResolvedValue(verifyOk);
  passwordSpy = spyOn(authApi, 'updatePassword').mockResolvedValue(passwordOk);
  resendSpy = spyOn(authApi, 'requestEmailChange').mockResolvedValue({ error: null });
  captureSpy = spyOn(events, 'captureEvent').mockImplementation(() => {});
});

afterEach(() => {
  for (const spy of [verifySpy, passwordSpy, resendSpy, captureSpy]) {
    spy.mockRestore();
  }
});

function setup() {
  return renderHook(() => useSignupOtp({ email: FAKE_EMAIL, password: FAKE_PASSWORD, captcha, setEmailConflict, setNavigating }));
}

type Hook = ReturnType<typeof setup>;

async function verify(hook: Hook, code = '123456') {
  act(() => hook.result.current.setOtpCode(code));
  await act(async () => {
    await hook.result.current.handleVerifyOtp({ preventDefault: () => {} } as FormEvent<HTMLFormElement>);
  });
}

async function resend(hook: Hook) {
  await act(async () => {
    await hook.result.current.handleResendOtp();
  });
}

const eventNames = () => captureSpy.mock.calls.map(call => call[0]);

describe('useSignupOtp verification', () => {
  test('a valid code links the email, sets the password and returns her to the menu', async () => {
    const hook = setup();

    await verify(hook, '654321');

    expect(verifySpy).toHaveBeenCalledWith({ email: FAKE_EMAIL, token: '654321' });
    expect(passwordSpy).toHaveBeenCalledWith(FAKE_PASSWORD);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    expect(setNavigating).toHaveBeenCalledWith(true);
    expect(routerMock.push).toHaveBeenCalledWith('/menu');
    expect(hook.result.current.otpError).toBeNull();
    expect(hook.result.current.isVerifyingOtp).toBe(false);
  });

  test('a valid code reports the verified and signed-up funnel steps with the signup method', async () => {
    const hook = setup();

    await verify(hook);

    expect(eventNames()).toEqual([POSTHOG_EVENTS.OTP_VERIFIED, POSTHOG_EVENTS.USER_SIGNED_UP]);
    expect(captureSpy.mock.calls[1][1]).toEqual({ method: 'progressive_signup_otp', $set_once: { signup_method: 'progressive_signup_otp' } });
  });

  test('a wrong or expired code shows the translated error and reports the failure reason', async () => {
    verifySpy.mockResolvedValueOnce(verifyFailed('otp_expired'));
    const hook = setup();

    await verify(hook);

    expect(hook.result.current.otpError).not.toBeNull();
    expect(captureSpy).toHaveBeenCalledWith(POSTHOG_EVENTS.OTP_FAILED, { reason: 'otp_expired' });
    expect(passwordSpy).not.toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(hook.result.current.isVerifyingOtp).toBe(false);
  });

  test('an email that belongs to another account is a conflict, not a code error', async () => {
    verifySpy.mockResolvedValueOnce(verifyFailed('email_exists'));
    const hook = setup();

    await verify(hook);

    expect(setEmailConflict).toHaveBeenCalledWith(true);
    expect(hook.result.current.otpError).toBeNull();
    expect(captureSpy).not.toHaveBeenCalled();
    expect(passwordSpy).not.toHaveBeenCalled();
    expect(hook.result.current.isVerifyingOtp).toBe(false);
  });

  test('a password failure after a valid code shows the error and does not navigate', async () => {
    passwordSpy.mockResolvedValueOnce(passwordFailed('weak_password'));
    const hook = setup();

    await verify(hook);

    expect(hook.result.current.otpError).not.toBeNull();
    expect(eventNames()).not.toContain(POSTHOG_EVENTS.OTP_VERIFIED);
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(setNavigating).not.toHaveBeenCalled();
  });

  test('an email conflict surfacing when the password is set is also flagged as a conflict', async () => {
    passwordSpy.mockResolvedValueOnce(passwordFailed('email_exists'));
    const hook = setup();

    await verify(hook);

    expect(setEmailConflict).toHaveBeenCalledWith(true);
    expect(hook.result.current.otpError).toBeNull();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  test('a previous error is cleared when she tries again', async () => {
    verifySpy.mockResolvedValueOnce(verifyFailed('otp_expired'));
    const hook = setup();
    await verify(hook);
    expect(hook.result.current.otpError).not.toBeNull();

    await verify(hook);

    expect(hook.result.current.otpError).toBeNull();
    expect(routerMock.push).toHaveBeenCalledWith('/menu');
  });
});

describe('useSignupOtp resend', () => {
  test('a resend carries the fresh captcha token, confirms it and resets the widget', async () => {
    const hook = setup();

    await resend(hook);

    expect(resendSpy).toHaveBeenCalledWith({ email: FAKE_EMAIL, captchaToken: 'fake-captcha-token' });
    expect(hook.result.current.resendMessage).toBe('Te enviamos un nuevo código.');
    expect(captureSpy).toHaveBeenCalledWith(POSTHOG_EVENTS.OTP_SENT, { context: 'resend' });
    expect(captchaReset).toHaveBeenCalledTimes(1);
    expect(hook.result.current.isResendingOtp).toBe(false);
  });

  test('a resend refused by the email rate limit shows the error and reports it as a resend failure', async () => {
    resendSpy.mockResolvedValueOnce({ error: new AuthApiError('rate', 429, 'over_email_send_rate_limit') });
    const hook = setup();

    await resend(hook);

    expect(hook.result.current.otpError).not.toBeNull();
    expect(hook.result.current.resendMessage).toBeNull();
    expect(captureSpy).toHaveBeenCalledWith(POSTHOG_EVENTS.OTP_FAILED, { reason: 'over_email_send_rate_limit', stage: 'resend' });
    expect(eventNames()).not.toContain(POSTHOG_EVENTS.OTP_SENT);
  });

  test('any other resend failure shows the error without the rate-limit report, and still resets the widget', async () => {
    resendSpy.mockResolvedValueOnce({ error: new AuthApiError('boom', 500, 'unexpected_failure') });
    const hook = setup();

    await resend(hook);

    expect(hook.result.current.otpError).not.toBeNull();
    expect(captureSpy).not.toHaveBeenCalled();
    expect(captchaReset).toHaveBeenCalledTimes(1);
    expect(hook.result.current.isResendingOtp).toBe(false);
  });

  test('the resend confirmation goes away when a new resend fails', async () => {
    const hook = setup();
    await resend(hook);
    expect(hook.result.current.resendMessage).not.toBeNull();
    resendSpy.mockResolvedValueOnce({ error: new AuthApiError('rate', 429, 'over_email_send_rate_limit') });

    await resend(hook);

    expect(hook.result.current.resendMessage).toBeNull();
  });
});
