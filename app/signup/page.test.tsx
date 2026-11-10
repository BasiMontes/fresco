import type { Captcha } from '@/components/auth/use-captcha';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as captchaModule from '@/components/auth/use-captcha';
import * as guestMenuModule from '@/components/signup/use-guest-menu';
import * as otpModule from '@/components/signup/use-signup-otp';
import * as reassignModule from '@/components/signup/use-signup-reassign';
import * as submitModule from '@/components/signup/use-signup-submit';
import { act, fireEvent, renderWithProviders, screen } from '@/tests/component-render';
import SignupPage from './page';
import '@/tests/mocks/next-navigation';

// FRESCO-1079 — /signup owns only the state machine: which step shows (form, one-time code, email
// confirmation pending, email already registered) and the overlay while it navigates. Each step's
// logic lives in its own hook, tested on its own, so the hooks are replaced by plain objects here and
// the page's own setters are captured to move through the steps.

const captcha = { enabled: false, token: null, ready: true, status: 'passed', resetKey: 0, setToken: () => {}, setStatus: () => {}, reset: () => {} } as Captcha;

type SubmitArgs = Parameters<typeof submitModule.useSignupSubmit>[0];
let submitArgs: SubmitArgs;

const reassign = { conflictPassword: '', setConflictPassword: mock(() => {}), isReassigning: false, reassignError: null, handleReassign: mock(async () => {}) };
const otp = { otpCode: '', setOtpCode: mock(() => {}), otpError: null, isVerifyingOtp: false, isResendingOtp: false, resendMessage: null, handleVerifyOtp: mock(async () => {}), handleResendOtp: mock(async () => {}) };
const submit = { isSubmitting: false, signupError: null, ageConfirmed: false, setAgeConfirmed: mock(() => {}), ageError: null, acceptedTerms: false, setAcceptedTerms: mock(() => {}), termsError: null, handleSubmit: mock(async () => {}) };

let captchaSpy: ReturnType<typeof spyOn<typeof captchaModule, 'useCaptcha'>>;
let reassignSpy: ReturnType<typeof spyOn<typeof reassignModule, 'useSignupReassign'>>;
let otpSpy: ReturnType<typeof spyOn<typeof otpModule, 'useSignupOtp'>>;
let submitSpy: ReturnType<typeof spyOn<typeof submitModule, 'useSignupSubmit'>>;
let guestMenuSpy: ReturnType<typeof spyOn<typeof guestMenuModule, 'useGuestMenu'>>;

beforeEach(() => {
  captchaSpy = spyOn(captchaModule, 'useCaptcha').mockReturnValue(captcha);
  reassignSpy = spyOn(reassignModule, 'useSignupReassign').mockReturnValue(reassign);
  otpSpy = spyOn(otpModule, 'useSignupOtp').mockReturnValue(otp);
  guestMenuSpy = spyOn(guestMenuModule, 'useGuestMenu').mockReturnValue(false);
  submitSpy = spyOn(submitModule, 'useSignupSubmit').mockImplementation((args) => { submitArgs = args; return submit; });
});

afterEach(() => {
  for (const spy of [captchaSpy, reassignSpy, otpSpy, submitSpy, guestMenuSpy]) { spy.mockRestore(); }
});

describe('SignupPage', () => {
  test('starts on the form, with the brand marks and the legal links', () => {
    renderWithProviders(<SignupPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Crea tu cuenta');
    expect(screen.getAllByAltText('Fresco')).toHaveLength(2);
    expect(screen.queryByRole('status')).toBeNull();
  });

  // FRESCO-1173: the page passes the guest-with-menu check down to the form.
  test('a guest with a menu sees the keep-your-menu heading', () => {
    guestMenuSpy.mockReturnValue(true);
    renderWithProviders(<SignupPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Guarda tu menú');
  });

  test('typing into the form keeps the email and the password in the page state', () => {
    renderWithProviders(<SignupPage />);
    fireEvent.change(screen.getByTestId('email_input'), { target: { value: 'nuevo@correo.es' } });
    fireEvent.change(screen.getByTestId('password_input'), { target: { value: 'una-clave-larga-1' } });
    expect(screen.getByTestId('email_input')).toHaveValue('nuevo@correo.es');
    expect(screen.getByTestId('password_input')).toHaveValue('una-clave-larga-1');
  });

  test('when the form moves to the second step it asks for the one-time code', () => {
    renderWithProviders(<SignupPage />);
    act(() => submitArgs.setStep('otp'));
    expect(screen.getByTestId('otp_code_input')).toBeInTheDocument();
    expect(screen.queryByTestId('email_input')).toBeNull();
  });

  test('when the account needs email confirmation it says to check the inbox', () => {
    renderWithProviders(<SignupPage />);
    act(() => submitArgs.setSignupPendingConfirmation(true));
    expect(screen.getByTestId('signup_confirmation_pending_message')).toBeInTheDocument();
    expect(screen.queryByTestId('email_input')).toBeNull();
  });

  test('when the email already has an account it asks for that account’s password', () => {
    renderWithProviders(<SignupPage />);
    act(() => submitArgs.setEmailConflict(true));
    expect(screen.getByTestId('signup_email_conflict_message')).toBeInTheDocument();
    expect(screen.queryByTestId('email_input')).toBeNull();
  });

  test('the email conflict wins over the other steps', () => {
    renderWithProviders(<SignupPage />);
    act(() => {
      submitArgs.setStep('otp');
      submitArgs.setSignupPendingConfirmation(true);
      submitArgs.setEmailConflict(true);
    });
    expect(screen.getByTestId('signup_email_conflict_message')).toBeInTheDocument();
  });

  test('while it navigates after signing up it covers the screen with a working overlay', () => {
    renderWithProviders(<SignupPage />);
    expect(screen.queryByText('Preparando tu cuenta…')).toBeNull();
    act(() => submitArgs.setNavigating(true));
    expect(screen.getByText('Preparando tu cuenta…')).toBeInTheDocument();
  });
});
