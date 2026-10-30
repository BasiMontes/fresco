import type { ReactNode } from 'react';
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
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

  // FRESCO-758: below 360px the row only fits with tighter padding; it must
  // land on both buttons so their visual weight stays equal.
  test('tightens the padding of both buttons on very narrow screens', () => {
    renderWithProviders(<Wrapper><CookieConsentBanner /></Wrapper>);
    ['reject', 'accept'].forEach((action) => {
      expect(screen.getByTestId(`cookie_consent_${action}_button`).className).toContain('max-[360px]:px-2');
    });
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

  // FRESCO-428 / FRESCO-1073: refusing must weigh exactly as much as accepting. Same classes means
  // same variant, size and width; there is no highlighted choice and no third button to dilute it.
  test('Aceptar and Rechazar carry the same visual weight (same classes) and are the only buttons', () => {
    renderWithProviders(<Wrapper><CookieConsentBanner /></Wrapper>);
    const accept = screen.getByTestId('cookie_consent_accept_button');
    const reject = screen.getByTestId('cookie_consent_reject_button');
    expect(accept.className).toBe(reject.className);
    expect(screen.queryByTestId('cookie_consent_configure_button')).toBeNull();
  });

  // FRESCO-969: compact mobile layout (one row of equal-width buttons, tight
  // padding, fixed 126px height = 14.8% of 852px, AC <= 15%) without weakening
  // consent: same classes on both, analytics copy and the link still on screen.
  test('mobile layout is compact, buttons share equal width, and the legal copy stays visible', () => {
    renderWithProviders(<Wrapper><CookieConsentBanner /></Wrapper>);
    const banner = screen.getByTestId('cookie_consent_banner');
    expect(banner.className).toContain('h-[126px]');
    expect(banner.className).toContain('py-1');
    ['reject', 'accept'].forEach((action) => {
      const { className } = screen.getByTestId(`cookie_consent_${action}_button`);
      expect(className).toContain('flex-1');
      expect(className).toContain('min-h-[44px]');
    });
    expect(banner.textContent).toContain('cookies de analítica');
    expect(screen.getByTestId('cookie_consent_configure_link').textContent).toBe('Configurar');
  });

  // FRESCO-1073: from `sm` up it is a card in the bottom RIGHT corner (the bottom left is the sidebar's
  // account menu), not a bar across the page.
  test('from sm up it is a compact card at the bottom right, not a full-width bar', () => {
    renderWithProviders(<Wrapper><CookieConsentBanner /></Wrapper>);
    const { className } = screen.getByTestId('cookie_consent_banner');
    for (const rule of ['sm:inset-x-auto', 'sm:right-4', 'sm:bottom-4', 'sm:w-96', 'sm:rounded-card', 'sm:border', 'sm:h-auto']) {
      expect(className).toContain(rule);
    }
    expect(className).not.toContain('sm:left-');
  });

  // FRESCO-1073: the card floats `bottom` px above the edge; that gap is room the spacer and the tab bar must keep.
  test('the published height includes the gap between the floating card and the screen edge', () => {
    clearAllCookies();
    const rect = spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ height: 150 } as DOMRect);
    const computed = spyOn(window, 'getComputedStyle').mockReturnValue({ bottom: '16px' } as CSSStyleDeclaration);
    try {
      renderWithProviders(<Wrapper><CookieConsentBanner /></Wrapper>);

      expect(document.documentElement.style.getPropertyValue('--cookie-banner-h')).toBe('166px');
    }
    finally {
      rect.mockRestore();
      computed.mockRestore();
    }
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
    await user.click(screen.getByTestId('cookie_consent_configure_link'));
    expect(screen.getByTestId('cookie_settings_dialog')).toBeInTheDocument();
    expect(document.cookie).not.toContain(COOKIE_CONSENT_COOKIE);
  });
});
