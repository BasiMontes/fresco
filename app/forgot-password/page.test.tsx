import { describe, expect, test } from 'bun:test';
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { renderWithProviders, screen } from '@/tests/component-render';
import ForgotPasswordPage from './page';

/**
 * FRESCO-984 — the email field of `/forgot-password` carried only a placeholder
 * and an `aria-label`, so sighted people lost its name on the first key. It now
 * has a visible `<label>` tied to the input, like `/login` and `/signup`
 * (FRESCO-936).
 */

function renderPage() {
  return renderWithProviders(
    <SearchParamsContext.Provider value={new URLSearchParams()}>
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
