import type { Captcha } from '@/components/auth/use-captcha';
import { describe, expect, mock, test } from 'bun:test';
import { fireEvent, renderWithProviders, screen } from '@/tests/component-render';
import { SignupFormStep } from './signup-form-step';

// FRESCO-1078 — the signup form is a controlled view: what the user types goes up,
// what the submit hook says (busy, error, consent errors) comes down. The submit
// hook and the captcha are plain objects here; Turnstile is disabled so it renders nothing.

const captcha = { enabled: false, token: null, ready: true, status: 'passed', resetKey: 0, setToken: () => {}, setStatus: () => {}, reset: () => {} } as Captcha;

function makeSubmit(overrides: Record<string, unknown> = {}) {
  return {
    isSubmitting: false,
    signupError: null,
    ageConfirmed: false,
    setAgeConfirmed: mock((_v: boolean) => {}),
    ageError: null,
    acceptedTerms: false,
    setAcceptedTerms: mock((_v: boolean) => {}),
    termsError: null,
    handleSubmit: mock(async (event: { preventDefault: () => void }) => { event.preventDefault(); }),
    ...overrides,
  } as unknown as React.ComponentProps<typeof SignupFormStep>['submit'];
}

function renderForm(submit = makeSubmit(), captchaState: Captcha = captcha, values = { email: '', password: '' }, guestHasMenu = false) {
  const onEmailChange = mock((_v: string) => {});
  const onPasswordChange = mock((_v: string) => {});
  renderWithProviders(
    <SignupFormStep {...values} onEmailChange={onEmailChange} onPasswordChange={onPasswordChange} submit={submit} captcha={captchaState} guestHasMenu={guestHasMenu} />,
  );
  return { submit, onEmailChange, onPasswordChange };
}

describe('SignupFormStep', () => {
  test('shows the heading and the link to log in', () => {
    renderForm();
    expect(screen.getByRole('link', { name: 'Inicia sesión' })).toHaveAttribute('href', '/login');
  });

  // FRESCO-1173 — "the menu we just generated" is only true for a guest that has one.
  test('a guest with a menu is told to keep it', () => {
    renderForm(makeSubmit(), captcha, { email: '', password: '' }, true);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Guarda tu menú');
    expect(screen.getByText('Crea una cuenta para no perder el menú que acabamos de generar.')).toBeInTheDocument();
  });

  test('anyone else gets the generic heading and no claim about a menu', () => {
    renderForm();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Crea tu cuenta');
    expect(screen.queryByText(/menú que acabamos de generar/)).toBeNull();
  });

  test('shows the values it is given', () => {
    renderForm(makeSubmit(), captcha, { email: 'a@b.es', password: 'secreto1234' });
    expect(screen.getByTestId('email_input')).toHaveValue('a@b.es');
  });

  test('typing the email reports it upward', () => {
    const { onEmailChange } = renderForm();
    fireEvent.change(screen.getByTestId('email_input'), { target: { value: 'nuevo@correo.es' } });
    expect(onEmailChange).toHaveBeenCalledWith('nuevo@correo.es');
  });

  test('typing the password reports it upward', () => {
    const { onPasswordChange } = renderForm();
    fireEvent.change(screen.getByTestId('password_input'), { target: { value: 'otraclave123' } });
    expect(onPasswordChange).toHaveBeenCalledWith('otraclave123');
  });

  test('ticking the age and terms boxes calls the submit hook setters', () => {
    const { submit } = renderForm();
    fireEvent.click(screen.getByTestId('confirm_age_checkbox'));
    expect(submit.setAgeConfirmed).toHaveBeenCalledWith(true);
  });

  test('submitting the form calls handleSubmit', () => {
    const { submit } = renderForm();
    fireEvent.submit(screen.getByTestId('signup_submit_button').closest('form')!);
    expect(submit.handleSubmit).toHaveBeenCalledTimes(1);
  });

  test('the button says Crear cuenta and is enabled when idle and the captcha is ready', () => {
    renderForm();
    expect(screen.getByTestId('signup_submit_button')).toHaveTextContent('Crear cuenta');
    expect(screen.getByTestId('signup_submit_button')).toBeEnabled();
  });

  test('while submitting the button is disabled and says so', () => {
    renderForm(makeSubmit({ isSubmitting: true }));
    expect(screen.getByTestId('signup_submit_button')).toBeDisabled();
    expect(screen.getByTestId('signup_submit_button')).toHaveTextContent('Creando cuenta…');
  });

  test('until the captcha is ready the button is disabled', () => {
    renderForm(makeSubmit(), { ...captcha, ready: false });
    expect(screen.getByTestId('signup_submit_button')).toBeDisabled();
  });

  test('a signup error shows in an alert, and no error shows when there is none', () => {
    renderForm(makeSubmit({ signupError: 'Ese correo ya existe' }));
    expect(screen.getByTestId('signup_error_message')).toHaveTextContent('Ese correo ya existe');
  });

  test('without a signup error there is no alert', () => {
    renderForm();
    expect(screen.queryByTestId('signup_error_message')).toBeNull();
  });

  test('consent errors from the hook reach the checkboxes', () => {
    renderForm(makeSubmit({ ageError: 'Debes confirmar tu edad' }));
    expect(screen.getByTestId('confirm_age_error_message')).toHaveTextContent('Debes confirmar tu edad');
  });
});
