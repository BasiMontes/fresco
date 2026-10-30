import { AuthApiError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { CookieConsentProvider } from '@/components/legal/cookie-consent-context';
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

function renderSection(props: Partial<React.ComponentProps<typeof AyudaSection>> = {}) {
  return renderWithProviders(
    <CookieConsentProvider initialDecision="rejected">
      <AyudaSection email={FAKE_EMAIL} planLabel="Plan Free" memberSince="3 de marzo de 2026" {...props} />
    </CookieConsentProvider>,
  );
}

describe('AyudaSection rows', () => {
  test('lists the two help entries and opens no modal by default', () => {
    renderSection();

    for (const key of ['configuracion', 'faq']) {
      expect(screen.getByTestId(`ayuda_row_${key}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId('settings_modal')).toBeNull();
    expect(screen.queryByTestId('faq_modal')).toBeNull();
  });

  // FRESCO-1070: the legal rows live in the "Legal" card now, not in this list.
  test('does not list the legal rows any more', () => {
    renderSection();

    for (const key of ['privacidad', 'terminos', 'cookies']) {
      expect(screen.queryByTestId(`ayuda_row_${key}`)).toBeNull();
    }
  });

  test('FAQ opens the frequently asked questions', () => {
    renderSection();

    fireEvent.click(screen.getByTestId('ayuda_row_faq'));

    expect(screen.getByTestId('faq_modal')).toBeInTheDocument();
    expect(screen.getByText('¿Puedo borrar mis datos?')).toBeInTheDocument();
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
