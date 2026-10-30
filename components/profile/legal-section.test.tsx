import { describe, expect, test } from 'bun:test';
import { CookieConsentProvider, useCookieConsent } from '@/components/legal/cookie-consent-context';
import { fireEvent, renderWithProviders, screen } from '@/tests/component-render';
import { LegalSection } from './legal-section';

function SettingsProbe() {
  const { settingsOpen } = useCookieConsent();
  return <span data-testid="cookie_settings_probe">{settingsOpen ? 'open' : 'closed'}</span>;
}

function renderSection() {
  return renderWithProviders(
    <CookieConsentProvider initialDecision="rejected">
      <LegalSection />
      <SettingsProbe />
    </CookieConsentProvider>,
  );
}

describe('LegalSection (FRESCO-1070)', () => {
  test('lists the three legal entries and opens no modal by default', () => {
    renderSection();

    for (const key of ['privacidad', 'terminos', 'cookies']) {
      expect(screen.getByTestId(`ayuda_row_${key}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId('legal_modal')).toBeNull();
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
