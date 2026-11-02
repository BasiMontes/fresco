import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import * as authApi from '@/lib/client-api/auth';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/tests/component-render';
import { navState } from '@/tests/mocks/next-navigation';
import ForgotPasswordPage from './page';

/**
 * FRESCO-984 — the email field of `/forgot-password` carried only a placeholder
 * and an `aria-label`, so sighted people lost its name on the first key. It now
 * has a visible `<label>` tied to the input, like `/login` and `/signup`
 * (FRESCO-936).
 */

function renderPage(search = '') {
  // `bun test` shares one process: the shared `next/navigation` stub (tests/mocks) reads this, not the context.
  navState.searchParams = new URLSearchParams(search);
  return renderWithProviders(
    <SearchParamsContext.Provider value={new URLSearchParams(search)}>
      <ForgotPasswordPage />
    </SearchParamsContext.Provider>,
  );
}

describe('/forgot-password email field', () => {
  test('has a visible label associated with the input', () => {
    renderPage();
    const input = screen.getByTestId('forgot_password_email_input');
    const label = screen.getByText('Correo electrónico', { selector: 'label' });

    expect(input.id).not.toBe('');
    expect(label).toHaveAttribute('for', input.id);
    expect((input as HTMLInputElement).labels?.[0]).toBe(label);
  });

  test('keeps the label on screen, not visually hidden', () => {
    renderPage();
    const label = screen.getByText('Correo electrónico', { selector: 'label' });

    expect(label.className).not.toContain('sr-only');
    expect(screen.getByLabelText('Correo electrónico')).toBe(screen.getByTestId('forgot_password_email_input'));
  });
});

// FRESCO-52 — requesting the recovery link. The answer is the same whether or not the email has an
// account (anti-enumeration), and a second click while the first request is in flight sends nothing.
describe('/forgot-password request flow', () => {
  let resetSpy: ReturnType<typeof spyOn<typeof authApi, 'sendPasswordReset'>>;

  beforeEach(() => {
    resetSpy = spyOn(authApi, 'sendPasswordReset').mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    resetSpy.mockRestore();
  });

  function fillEmail(email: string) {
    fireEvent.change(screen.getByTestId('forgot_password_email_input'), { target: { value: email } });
  }

  test('sends the email, then replaces the form with the neutral confirmation', async () => {
    renderPage();
    fillEmail('ana@correo.com');
    fireEvent.click(screen.getByTestId('forgot_password_submit_button'));

    await waitFor(() => expect(screen.getByTestId('forgot_password_confirmation_message')).toBeInTheDocument());
    expect(resetSpy).toHaveBeenCalledWith({ email: 'ana@correo.com', captchaToken: null });
    expect(screen.queryByTestId('forgot_password_email_input')).toBeNull();
    expect(screen.queryByText('Te enviaremos un enlace para elegir una nueva contraseña.')).toBeNull();
  });

  test('a second submit while the first is in flight sends nothing more (FRESCO-114)', async () => {
    let finish: () => void = () => {};
    resetSpy.mockReturnValue(new Promise((resolve) => { finish = () => resolve({ data: {}, error: null }); }));
    renderPage();
    fillEmail('ana@correo.com');
    const form = screen.getByTestId('forgot_password_email_input').closest('form') as HTMLFormElement;

    fireEvent.submit(form);
    fireEvent.submit(form);
    finish();

    await waitFor(() => expect(screen.getByTestId('forgot_password_confirmation_message')).toBeInTheDocument());
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  test('an invalid or expired recovery link says so and still offers the form', () => {
    renderPage('error=invalid_link');

    expect(screen.getByTestId('invalid_link_message')).toBeInTheDocument();
    expect(screen.getByTestId('forgot_password_email_input')).toBeInTheDocument();
  });

  test('no error message on a plain visit', () => {
    renderPage();

    expect(screen.queryByTestId('invalid_link_message')).toBeNull();
  });
});
