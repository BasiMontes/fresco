import type { Captcha } from '@/components/auth/use-captcha';
import type { useSignupOtp } from '@/components/signup/use-signup-otp';
import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { SignupOtpStep } from './signup-otp-step';

/**
 * FRESCO-1006 (audit 7b A7-ABUSE-02) — a resend is a new send, so the OTP step needs a Turnstile
 * token like the first one: the resend stays disabled until the widget has issued one.
 */

const otp = {
  otpCode: '',
  setOtpCode: () => {},
  otpError: null,
  isVerifyingOtp: false,
  isResendingOtp: false,
  resendMessage: null,
  handleVerifyOtp: async () => {},
  handleResendOtp: async () => {},
} as unknown as ReturnType<typeof useSignupOtp>;

function captcha(over: Partial<Captcha> = {}): Captcha {
  return { enabled: false, token: null, ready: true, status: 'passed', resetKey: 0, setToken: () => {}, setStatus: () => {}, reset: () => {}, ...over };
}

describe('SignupOtpStep resend (FRESCO-1006)', () => {
  test('is available when the build has no captcha', () => {
    renderWithProviders(<SignupOtpStep email="ana@example.com" otp={otp} captcha={captcha()} />);

    expect(screen.getByTestId<HTMLButtonElement>('signup_resend_otp_button').disabled).toBe(false);
  });

  test('waits for the captcha token when the build has one', () => {
    renderWithProviders(<SignupOtpStep email="ana@example.com" otp={otp} captcha={captcha({ enabled: true, ready: false, status: 'verifying' })} />);

    expect(screen.getByTestId<HTMLButtonElement>('signup_resend_otp_button').disabled).toBe(true);
  });

  test('opens once the token is in hand', () => {
    renderWithProviders(<SignupOtpStep email="ana@example.com" otp={otp} captcha={captcha({ enabled: true, token: 'tok', ready: true })} />);

    expect(screen.getByTestId<HTMLButtonElement>('signup_resend_otp_button').disabled).toBe(false);
  });
});
