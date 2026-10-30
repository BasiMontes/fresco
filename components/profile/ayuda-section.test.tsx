import { AuthApiError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { CookieConsentProvider } from '@/components/legal/cookie-consent-context';
import * as authApi from '@/lib/client-api/auth';
import { useAccountModalStore } from '@/lib/store/account-modal-store';
import { act, fireEvent, renderWithProviders, screen, waitFor } from '@/tests/component-render';
import { AyudaSection } from './ayuda-section';

const FAKE_EMAIL = 'test-user@example.com';

let resetSpy: ReturnType<typeof spyOn<typeof authApi, 'sendPasswordReset'>>;

beforeEach(() => {
  resetSpy = spyOn(authApi, 'sendPasswordReset').mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  resetSpy.mockRestore();
  useAccountModalStore.getState().clear();
});

function renderSection(props: Partial<React.ComponentProps<typeof AyudaSection>> = {}) {
  return renderWithProviders(
    <CookieConsentProvider initialDecision="rejected">
      <AyudaSection email={FAKE_EMAIL} planLabel="Plan Free" memberSince="3 de marzo de 2026" preferencesSummary="Vegano · 2 alérgenos" {...props} />
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

  // FRESCO-1070: the diet and allergen form moved to its own page; this row is the way in.
  test('the Preferencias row links to the preferences page and shows what is saved', () => {
    renderSection({ preferencesSummary: 'Vegetariano · 3 alérgenos' });

    const row = screen.getByTestId('profile_row_preferencias');

    expect(row.tagName).toBe('A');
    expect(row).toHaveAttribute('href', '/profile/preferences');
    expect(row).toHaveTextContent('Preferencias');
    expect(row).toHaveTextContent('Vegetariano · 3 alérgenos');
  });

  test('the Preferencias row comes first, above Configuración and FAQ', () => {
    renderSection();

    const rows = ['profile_row_preferencias', 'ayuda_row_configuracion', 'ayuda_row_faq'].map(id => screen.getByTestId(id));

    expect(rows[0].compareDocumentPosition(rows[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rows[1].compareDocumentPosition(rows[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

// FRESCO-1074: the account menu's "Configuración" and "FAQ" open their modal straight away.
describe('AyudaSection account menu requests', () => {
  test('opens the settings modal when it was requested before the page mounted', () => {
    useAccountModalStore.getState().request('configuracion');

    renderSection();

    expect(screen.getByTestId('settings_modal')).toBeInTheDocument();
    expect(screen.queryByTestId('faq_modal')).toBeNull();
  });

  test('opens the FAQ modal when it was requested before the page mounted', () => {
    useAccountModalStore.getState().request('faq');

    renderSection();

    expect(screen.getByTestId('faq_modal')).toBeInTheDocument();
    expect(screen.queryByTestId('settings_modal')).toBeNull();
  });

  // Already on /profile nothing remounts: the request arrives while the section is on screen.
  test('opens the modal when it is requested while the page is already open', () => {
    renderSection();
    expect(screen.queryByTestId('faq_modal')).toBeNull();

    act(() => useAccountModalStore.getState().request('faq'));

    expect(screen.getByTestId('faq_modal')).toBeInTheDocument();
  });

  test('opens nothing when nothing was requested', () => {
    renderSection();

    expect(screen.queryByTestId('settings_modal')).toBeNull();
    expect(screen.queryByTestId('faq_modal')).toBeNull();
  });

  // A request is used up: closing the modal must not bring it back, and asking again must work.
  test('consumes the request, so the same entry works again after the modal is closed', () => {
    useAccountModalStore.getState().request('configuracion');
    renderSection();
    expect(useAccountModalStore.getState().requested).toBeNull();

    fireEvent.click(screen.getByTestId('settings_modal_close_button'));
    expect(screen.getByTestId('settings_modal')).toHaveClass('is-closing');

    act(() => useAccountModalStore.getState().request('configuracion'));

    expect(screen.getByTestId('settings_modal')).not.toHaveClass('is-closing');
  });
});
