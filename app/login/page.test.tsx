import { AuthApiError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as authApi from '@/lib/client-api/auth';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/tests/component-render';
import { navState, routerMock } from '@/tests/mocks/next-navigation';
import LoginPage from './page';

const FAKE_EMAIL = 'test-user@example.com';
const FAKE_PASSWORD = 'fake-password-123';

type SignInResult = Awaited<ReturnType<typeof authApi.signInWithPassword>>;
type ResendResult = Awaited<ReturnType<typeof authApi.resendSignupConfirmation>>;

const okSignIn = { data: { user: null, session: null }, error: null } as unknown as SignInResult;
const failedSignIn = (message: string, code?: string) =>
  ({ data: { user: null, session: null }, error: new AuthApiError(message, 400, code) }) as unknown as SignInResult;

let signInSpy: ReturnType<typeof spyOn<typeof authApi, 'signInWithPassword'>>;
let resendSpy: ReturnType<typeof spyOn<typeof authApi, 'resendSignupConfirmation'>>;

beforeEach(() => {
  navState.searchParams = new URLSearchParams();
  routerMock.push.mockClear();
  routerMock.refresh.mockClear();
  signInSpy = spyOn(authApi, 'signInWithPassword').mockResolvedValue(okSignIn);
  resendSpy = spyOn(authApi, 'resendSignupConfirmation').mockResolvedValue({ data: {}, error: null } as unknown as ResendResult);
});

afterEach(() => {
  signInSpy.mockRestore();
  resendSpy.mockRestore();
  navState.searchParams = new URLSearchParams();
});

function fill(email: string, password: string) {
  fireEvent.change(screen.getByTestId('email_input'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
}

function submit() {
  fireEvent.click(screen.getByTestId('login_submit_button'));
}

async function failLogin(message = 'Invalid login credentials') {
  signInSpy.mockResolvedValueOnce(failedSignIn(message));
  fill(FAKE_EMAIL, FAKE_PASSWORD);
  submit();
  await waitFor(() => expect(signInSpy).toHaveBeenCalled());
}

describe('/login banners from query flags', () => {
  test('shows no banner on a plain visit', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.queryByTestId('session_expired_message')).toBeNull();
    expect(screen.queryByTestId('password_reset_success_message')).toBeNull();
    expect(screen.queryByTestId('account_deleted_message')).toBeNull();
  });

  test('explains an expired session', () => {
    navState.searchParams = new URLSearchParams('session_expired=1');
    renderWithProviders(<LoginPage />);

    expect(screen.getByTestId('session_expired_message')).toBeInTheDocument();
  });

  test('confirms a password reset', () => {
    navState.searchParams = new URLSearchParams('password_reset=1');
    renderWithProviders(<LoginPage />);

    expect(screen.getByTestId('password_reset_success_message')).toBeInTheDocument();
  });

  test('says goodbye after an account deletion', () => {
    navState.searchParams = new URLSearchParams('account_deleted=1');
    renderWithProviders(<LoginPage />);

    expect(screen.getByTestId('account_deleted_message')).toBeInTheDocument();
  });
});

describe('/login validation', () => {
  test('an empty submit names both missing fields and calls nothing', () => {
    renderWithProviders(<LoginPage />);

    submit();

    expect(screen.getByTestId('email_error')).toHaveTextContent('Introduce tu correo electrónico.');
    expect(screen.getByTestId('password_error')).toHaveTextContent('Introduce tu contraseña.');
    expect(signInSpy).not.toHaveBeenCalled();
  });

  test('moves focus to the email field when it is the first thing to fix', () => {
    renderWithProviders(<LoginPage />);

    submit();

    expect(document.activeElement?.id).toBe('login-email');
  });

  test('moves focus to the password when only the password is missing', () => {
    renderWithProviders(<LoginPage />);
    fireEvent.change(screen.getByTestId('email_input'), { target: { value: FAKE_EMAIL } });

    submit();

    expect(screen.queryByTestId('email_error')).toBeNull();
    expect(document.activeElement?.id).toBe('login-password');
  });

  test('rejects a malformed email', () => {
    renderWithProviders(<LoginPage />);
    fill('not-an-email', FAKE_PASSWORD);

    submit();

    expect(screen.getByTestId('email_error')).toHaveTextContent('Introduce un correo válido.');
    expect(signInSpy).not.toHaveBeenCalled();
  });

  test('typing in a field clears its error', () => {
    renderWithProviders(<LoginPage />);
    submit();

    fireEvent.change(screen.getByTestId('email_input'), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'b' } });

    expect(screen.queryByTestId('email_error')).toBeNull();
    expect(screen.queryByTestId('password_error')).toBeNull();
  });
});

describe('/login successful sign-in', () => {
  test('signs in, refreshes the router and goes to the menu', async () => {
    renderWithProviders(<LoginPage />);
    fill(FAKE_EMAIL, FAKE_PASSWORD);

    submit();

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/menu'));
    expect(signInSpy).toHaveBeenCalledWith({ email: FAKE_EMAIL, password: FAKE_PASSWORD, captchaToken: null });
    expect(routerMock.refresh).toHaveBeenCalled();
    expect(screen.getByTestId('login_submit_button')).toBeDisabled();
  });

  test('returns to the page that sent her to log in', async () => {
    navState.searchParams = new URLSearchParams('next=/recipes');
    renderWithProviders(<LoginPage />);
    fill(FAKE_EMAIL, FAKE_PASSWORD);

    submit();

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/recipes'));
  });

  test('ignores a next that points outside the app', async () => {
    navState.searchParams = new URLSearchParams('next=https://evil.example.com');
    renderWithProviders(<LoginPage />);
    fill(FAKE_EMAIL, FAKE_PASSWORD);

    submit();

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/menu'));
  });
});

describe('/login failed sign-in', () => {
  test('shows the translated error and keeps her on the page', async () => {
    renderWithProviders(<LoginPage />);

    await failLogin();

    expect(await screen.findByTestId('login_error_message')).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(screen.getByTestId('login_submit_button')).not.toBeDisabled();
    expect(screen.queryByTestId('resend_confirmation_button')).toBeNull();
  });

  test('warns after three failed attempts in a row', async () => {
    renderWithProviders(<LoginPage />);

    await failLogin();
    await screen.findByTestId('login_error_message');
    expect(screen.queryByTestId('login_repeated_failures_message')).toBeNull();
    await failLogin();
    await waitFor(() => expect(signInSpy).toHaveBeenCalledTimes(2));
    await failLogin();

    expect(await screen.findByTestId('login_repeated_failures_message')).toBeInTheDocument();
  });

  test('shows a generic error when the request throws', async () => {
    signInSpy.mockRejectedValueOnce(new Error('network down'));
    renderWithProviders(<LoginPage />);
    fill(FAKE_EMAIL, FAKE_PASSWORD);

    submit();

    expect(await screen.findByTestId('login_error_message')).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(screen.getByTestId('login_submit_button')).not.toBeDisabled();
  });
});

describe('/login unconfirmed email', () => {
  async function renderUnconfirmed() {
    renderWithProviders(<LoginPage />);
    signInSpy.mockResolvedValueOnce(failedSignIn('Email not confirmed', 'email_not_confirmed'));
    fill(FAKE_EMAIL, FAKE_PASSWORD);
    submit();
    return screen.findByTestId('resend_confirmation_button');
  }

  test('offers to resend the confirmation and confirms once sent', async () => {
    const button = await renderUnconfirmed();

    fireEvent.click(button);

    expect(await screen.findByTestId('resend_confirmation_message')).toHaveTextContent('Te enviamos un nuevo enlace de confirmación.');
    expect(resendSpy).toHaveBeenCalledWith({ email: FAKE_EMAIL, captchaToken: null });
  });

  test('shows the error when the resend fails', async () => {
    resendSpy.mockResolvedValueOnce({ data: {}, error: new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit') } as unknown as ResendResult);
    const button = await renderUnconfirmed();

    fireEvent.click(button);

    await waitFor(() => expect(resendSpy).toHaveBeenCalled());
    expect(screen.queryByTestId('resend_confirmation_message')).toBeNull();
    expect(screen.getByTestId('login_error_message')).toBeInTheDocument();
  });
});
