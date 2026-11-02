import type { Captcha } from '@/components/auth/use-captcha';
import { describe, expect, mock, test } from 'bun:test';
import { fireEvent, renderWithProviders, screen } from '@/tests/component-render';
import { SignupEmailConflict } from './signup-email-conflict';

// FRESCO-1078 — the email already has an account: the user proves it with that account's
// password, and the generated menu is kept. The reassign hook and the captcha are plain
// objects here; Turnstile is disabled so it renders nothing.

const captcha = { enabled: false, token: null, ready: true, status: 'passed', resetKey: 0, setToken: () => {}, setStatus: () => {}, reset: () => {} } as Captcha;

function makeReassign(overrides: Record<string, unknown> = {}) {
  return {
    conflictPassword: 'clave-de-la-cuenta',
    setConflictPassword: mock((_v: string) => {}),
    isReassigning: false,
    reassignError: null,
    handleReassign: mock(async () => {}),
    ...overrides,
  } as unknown as React.ComponentProps<typeof SignupEmailConflict>['reassign'];
}

const render = (reassign = makeReassign(), captchaState: Captcha = captcha) => {
  renderWithProviders(<SignupEmailConflict reassign={reassign} captcha={captchaState} />);
  return reassign;
};

describe('SignupEmailConflict', () => {
  test('explains the conflict and offers the manual login', () => {
    render();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ya existe una cuenta con ese email');
    expect(screen.getByTestId('signup_email_conflict_message')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'inicia sesión manualmente' })).toHaveAttribute('href', '/login');
  });

  test('typing the password reports it to the hook', () => {
    const reassign = render();
    fireEvent.change(screen.getByTestId('conflict_password_input'), { target: { value: 'otra' } });
    expect(reassign.setConflictPassword).toHaveBeenCalledWith('otra');
  });

  test('submitting asks the hook to reassign, without a page reload', () => {
    const reassign = render();
    fireEvent.submit(screen.getByTestId('signup_reassign_button').closest('form')!);
    expect(reassign.handleReassign).toHaveBeenCalledTimes(1);
  });

  test('the button is enabled with a password and a ready captcha', () => {
    render();
    expect(screen.getByTestId('signup_reassign_button')).toBeEnabled();
    expect(screen.getByTestId('signup_reassign_button')).toHaveTextContent('Continuar con esta cuenta');
  });

  test('without a password the button is disabled', () => {
    render(makeReassign({ conflictPassword: '' }));
    expect(screen.getByTestId('signup_reassign_button')).toBeDisabled();
  });

  test('until the captcha is ready the button is disabled', () => {
    render(makeReassign(), { ...captcha, ready: false });
    expect(screen.getByTestId('signup_reassign_button')).toBeDisabled();
  });

  test('while verifying the button is disabled and says so', () => {
    render(makeReassign({ isReassigning: true }));
    expect(screen.getByTestId('signup_reassign_button')).toBeDisabled();
    expect(screen.getByTestId('signup_reassign_button')).toHaveTextContent('Verificando…');
  });

  test('shows the reassign error in an alert, and none when there is no error', () => {
    const { unmount } = renderWithProviders(<SignupEmailConflict reassign={makeReassign({ reassignError: 'Contraseña incorrecta' })} captcha={captcha} />);
    expect(screen.getByTestId('signup_reassign_error_message')).toHaveTextContent('Contraseña incorrecta');
    unmount();
    render();
    expect(screen.queryByTestId('signup_reassign_error_message')).toBeNull();
  });
});
