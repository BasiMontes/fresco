import type { ReactNode } from 'react';
import { describe, expect, test } from 'bun:test';
import { CookieConsentBanner } from '@/components/legal/cookie-consent-banner';
import { CookieConsentProvider, useCookieConsent } from '@/components/legal/cookie-consent-context';
import { COOKIE_CONSENT_COOKIE } from '@/lib/consent/cookie-consent';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';

function Wrapper({ children, initialDecision = null }: { children: ReactNode, initialDecision?: 'accepted' | 'rejected' | null }) {
  return <CookieConsentProvider initialDecision={initialDecision}>{children}</CookieConsentProvider>;
}

function clearAllCookies() {
  document.cookie.split(';').forEach((entry) => {
    const name = entry.split('=')[0]?.trim();
    if (name) { document.cookie = `${name}=; path=/; max-age=0`; }
  });
}

describe('CookieConsentBanner', () => {
  test('shows when there is no consent decision yet', () => {
    renderWithProviders(<Wrapper><CookieConsentBanner /></Wrapper>);
    expect(screen.getByTestId('cookie_consent_banner')).toBeInTheDocument();
  });

  test('does not render when a decision already exists', () => {
    renderWithProviders(<Wrapper initialDecision="accepted"><CookieConsentBanner /></Wrapper>);
    expect(screen.queryByTestId('cookie_consent_banner')).not.toBeInTheDocument();
  });

  test('Aceptar/Rechazar/Configurar all carry the same visual weight (same variant class)', () => {
    renderWithProviders(<Wrapper><CookieConsentBanner /></Wrapper>);
    const accept = screen.getByTestId('cookie_consent_accept_button');
    const reject = screen.getByTestId('cookie_consent_reject_button');
    const configure = screen.getByTestId('cookie_consent_configure_button');
    expect(accept.className).toBe(reject.className);
    expect(accept.className).toBe(configure.className);
  });

  test('accepting writes the cookie and hides the banner, without re-showing it', async () => {
    clearAllCookies();
    const user = setupUser();
    renderWithProviders(<Wrapper><CookieConsentBanner /></Wrapper>);

    await user.click(screen.getByTestId('cookie_consent_accept_button'));

    expect(document.cookie).toContain(`${COOKIE_CONSENT_COOKIE}=accepted`);
    expect(screen.queryByTestId('cookie_consent_banner')).not.toBeInTheDocument();
  });

  test('rejecting writes the cookie and hides the banner', async () => {
    clearAllCookies();
    const user = setupUser();
    renderWithProviders(<Wrapper><CookieConsentBanner /></Wrapper>);

    await user.click(screen.getByTestId('cookie_consent_reject_button'));

    expect(document.cookie).toContain(`${COOKIE_CONSENT_COOKIE}=rejected`);
    expect(screen.queryByTestId('cookie_consent_banner')).not.toBeInTheDocument();
  });

  test('"Configurar" opens the settings context state without writing a decision', async () => {
    function Probe() {
      const { settingsOpen } = useCookieConsent();
      return <span data-testid="settings_open_probe">{String(settingsOpen)}</span>;
    }

    clearAllCookies();
    const user = setupUser();
    renderWithProviders(
      <Wrapper>
        <CookieConsentBanner />
        <Probe />
      </Wrapper>,
    );

    expect(screen.getByTestId('settings_open_probe')).toHaveTextContent('false');
    await user.click(screen.getByTestId('cookie_consent_configure_button'));
    expect(screen.getByTestId('settings_open_probe')).toHaveTextContent('true');
    expect(document.cookie).not.toContain(COOKIE_CONSENT_COOKIE);
  });
});
