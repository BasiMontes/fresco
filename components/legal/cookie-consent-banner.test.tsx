import type { ReactNode } from 'react';
import { afterEach, describe, expect, test } from 'bun:test';
import { CookieConsentBanner } from '@/components/legal/cookie-consent-banner';
import { CookieConsentProvider } from '@/components/legal/cookie-consent-context';
import { CookieSettingsDialog } from '@/components/legal/cookie-settings-dialog';
import { COOKIE_CONSENT_COOKIE } from '@/lib/consent/cookie-consent';
import { clearAllCookies, renderWithProviders, screen, setupUser } from '@/tests/component-render';

function Wrapper({ children, initialDecision = null }: { children: ReactNode, initialDecision?: 'accepted' | 'rejected' | null }) {
  return <CookieConsentProvider initialDecision={initialDecision}>{children}</CookieConsentProvider>;
}

describe('CookieConsentBanner', () => {
  // Same file-order pollution risk as the other cookie-consent test files
  // (see app/providers/posthog-provider.test.tsx) — clean up unconditionally
  // rather than relying on every mutating test remembering to.
  afterEach(() => {
    clearAllCookies();
  });

  test('shows when there is no consent decision yet', () => {
    renderWithProviders(<Wrapper><CookieConsentBanner /></Wrapper>);
    expect(screen.getByTestId('cookie_consent_banner')).toBeInTheDocument();
  });

  test('does not render when a decision already exists', () => {
    renderWithProviders(<Wrapper initialDecision="accepted"><CookieConsentBanner /></Wrapper>);
    expect(screen.queryByTestId('cookie_consent_banner')).not.toBeInTheDocument();
  });

  // FRESCO-756: the banner is `fixed`; the spacer is what keeps the last
  // controls of the page scrollable above it.
  test('reserves in-flow room for the fixed banner while it is visible', () => {
    renderWithProviders(<Wrapper><CookieConsentBanner /></Wrapper>);
    expect(screen.getByTestId('cookie_consent_banner_spacer')).toHaveAttribute('aria-hidden', 'true');
  });

  test('releases the reserved room together with the banner', async () => {
    clearAllCookies();
    const user = setupUser();
    renderWithProviders(<Wrapper><CookieConsentBanner /></Wrapper>);

    await user.click(screen.getByTestId('cookie_consent_reject_button'));

    expect(screen.queryByTestId('cookie_consent_banner_spacer')).not.toBeInTheDocument();
  });

  // FRESCO-757: the banner publishes its real height for the spacer and for the
  // mobile tab bar, and withdraws it when it goes away.
  test('publishes its height as --cookie-banner-h while visible and clears it on decision', async () => {
    clearAllCookies();
    const user = setupUser();
    renderWithProviders(<Wrapper><CookieConsentBanner /></Wrapper>);

    expect(document.documentElement.style.getPropertyValue('--cookie-banner-h')).not.toBe('');

    await user.click(screen.getByTestId('cookie_consent_reject_button'));

    expect(document.documentElement.style.getPropertyValue('--cookie-banner-h')).toBe('');
  });

  test('reserves no room when a decision already exists', () => {
    renderWithProviders(<Wrapper initialDecision="rejected"><CookieConsentBanner /></Wrapper>);
    expect(screen.queryByTestId('cookie_consent_banner_spacer')).not.toBeInTheDocument();
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

  test('"Configurar" opens the actual settings dialog, without writing a decision', async () => {
    clearAllCookies();
    const user = setupUser();
    renderWithProviders(
      <Wrapper>
        <CookieConsentBanner />
        <CookieSettingsDialog />
      </Wrapper>,
    );

    expect(screen.queryByTestId('cookie_settings_dialog')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('cookie_consent_configure_button'));
    expect(screen.getByTestId('cookie_settings_dialog')).toBeInTheDocument();
    expect(document.cookie).not.toContain(COOKIE_CONSENT_COOKIE);
  });
});
