import { AuthApiError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { CookieConsentProvider, useCookieConsent } from '@/components/legal/cookie-consent-context';
import * as authApi from '@/lib/client-api/auth';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/tests/component-render';
import { AyudaSection } from './ayuda-section';

const FAKE_EMAIL = 'test-user@example.com';

let resetSpy: ReturnType<typeof spyOn<typeof authApi, 'sendPasswordReset'>>;

beforeEach(() => {
  resetSpy = spyOn(authApi, 'sendPasswordReset').mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  resetSpy.mockRestore();
  window.location.hash = '';
});

function SettingsProbe() {
  const { settingsOpen } = useCookieConsent();
  return <span data-testid="cookie_settings_probe">{settingsOpen ? 'open' : 'closed'}</span>;
}

function renderSection(props: Partial<React.ComponentProps<typeof AyudaSection>> = {}) {
  return renderWithProviders(
    <CookieConsentProvider initialDecision="rejected">
      <AyudaSection email={FAKE_EMAIL} planLabel="Plan Free" memberSince="3 de marzo de 2026" {...props} />
      <SettingsProbe />
    </CookieConsentProvider>,
  );
}

describe('AyudaSection rows', () => {
  test('lists the five help entries and opens no modal by default', () => {
    renderSection();

    for (const key of ['configuracion', 'faq', 'privacidad', 'terminos', 'cookies']) {
      expect(screen.getByTestId(`ayuda_row_${key}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId('settings_modal')).toBeNull();
    expect(screen.queryByTestId('faq_modal')).toBeNull();
    expect(screen.queryByTestId('legal_modal')).toBeNull();
  });

  test('FAQ opens the frequently asked questions', () => {
    renderSection();

    fireEvent.click(screen.getByTestId('ayuda_row_faq'));

    expect(screen.getByTestId('faq_modal')).toBeInTheDocument();
    expect(screen.getByText('¿Puedo borrar mis datos?')).toBeInTheDocument();
  });

  test('Privacidad opens the legal modal', () => {
    renderSection();

    fireEvent.click(screen.getByTestId('ayuda_row_privacidad'));
    expect(screen.getByTestId('legal_modal')).toBeInTheDocument();
  });

  test('Términos de Servicio opens the legal modal too', () => {
    renderSection();

    fireEvent.click(screen.getByTestId('ayuda_row_terminos'));

    expect(screen.getByTestId('legal_modal')).toBeInTheDocument();
  });

  test('Cookies opens the cookie settings through the consent context', () => {
    renderSection();
    expect(screen.getByTestId('cookie_settings_probe')).toHaveTextContent('closed');

    fireEvent.click(screen.getByTestId('ayuda_row_cookies'));

    expect(screen.getByTestId('cookie_settings_probe')).toHaveTextContent('open');
  });
});

describe('AyudaSection settings modal', () => {
  test('shows email, plan and member-since date', () => {
    renderSection();

    fireEvent.click(screen.getByTestId('ayuda_row_configuracion'));

    const modal = screen.getByTestId('settings_modal');
    expect(modal).toHaveTextContent(FAKE_EMAIL);
    expect(modal).toHaveTextContent('Plan Free');
    expect(modal).toHaveTextContent('Miembro desde');
    expect(modal).toHaveTextContent('3 de marzo de 2026');
  });

  test('falls back to Invitada for a guest with an empty email and hides a missing date', () => {
    renderSection({ email: '', memberSince: null });

    fireEvent.click(screen.getByTestId('ayuda_row_configuracion'));

    const modal = screen.getByTestId('settings_modal');
    expect(modal).toHaveTextContent('Invitada');
    expect(modal).not.toHaveTextContent('Miembro desde');
  });

  test('sends the password reset link and confirms it', async () => {
    renderSection();
    fireEvent.click(screen.getByTestId('ayuda_row_configuracion'));

    fireEvent.click(screen.getByTestId('cambiar_contrasena_button'));

    expect(await screen.findByTestId('password_reset_sent_message')).toHaveTextContent(FAKE_EMAIL);
    expect(resetSpy).toHaveBeenCalledWith({ email: FAKE_EMAIL, captchaToken: null });
    expect(screen.queryByTestId('cambiar_contrasena_button')).toBeNull();
  });

  test('tells her when the link could not be sent and lets her retry', async () => {
    resetSpy.mockResolvedValueOnce({ data: null, error: new AuthApiError('rate limited', 429, 'over_email_send_rate_limit') });
    renderSection();
    fireEvent.click(screen.getByTestId('ayuda_row_configuracion'));

    fireEvent.click(screen.getByTestId('cambiar_contrasena_button'));

    expect(await screen.findByTestId('password_reset_error_message')).toBeInTheDocument();
    expect(screen.queryByTestId('password_reset_sent_message')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('cambiar_contrasena_button')).not.toBeDisabled());
  });
});

describe('AyudaSection deep links', () => {
  test('scrolls to the anchor named in the URL hash on mount', () => {
    const scrollSpy = spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    window.location.hash = '#ayuda-configuracion';

    renderSection();

    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    scrollSpy.mockRestore();
  });

  test('does not scroll for an unrelated hash', () => {
    const scrollSpy = spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    window.location.hash = '#other';

    renderSection();

    expect(scrollSpy).not.toHaveBeenCalled();
    scrollSpy.mockRestore();
  });
});
