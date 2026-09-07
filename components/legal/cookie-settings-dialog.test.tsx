import type { ReactNode } from 'react';
import { describe, expect, test } from 'bun:test';
import { CookieConsentProvider } from '@/components/legal/cookie-consent-context';
import { CookieSettingsDialog } from '@/components/legal/cookie-settings-dialog';
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

describe('CookieSettingsDialog', () => {
  test('starts with the toggle reflecting the current decision', () => {
    renderWithProviders(
      <Wrapper initialDecision="accepted">
        <CookieSettingsDialog open onOpenChange={() => {}} />
      </Wrapper>,
    );
    expect(screen.getByTestId('cookie_settings_analytics_toggle')).toHaveAttribute('aria-checked', 'true');
  });

  test('turning the toggle off and saving writes a rejected decision', async () => {
    clearAllCookies();
    const user = setupUser();
    renderWithProviders(
      <Wrapper initialDecision="accepted">
        <CookieSettingsDialog open onOpenChange={() => {}} />
      </Wrapper>,
    );

    await user.click(screen.getByTestId('cookie_settings_analytics_toggle'));
    await user.click(screen.getByTestId('cookie_settings_save_button'));

    expect(document.cookie).toContain(`${COOKIE_CONSENT_COOKIE}=rejected`);
  });

  test('turning the toggle on and saving writes an accepted decision', async () => {
    clearAllCookies();
    const user = setupUser();
    renderWithProviders(
      <Wrapper initialDecision="rejected">
        <CookieSettingsDialog open onOpenChange={() => {}} />
      </Wrapper>,
    );

    await user.click(screen.getByTestId('cookie_settings_analytics_toggle'));
    await user.click(screen.getByTestId('cookie_settings_save_button'));

    expect(document.cookie).toContain(`${COOKIE_CONSENT_COOKIE}=accepted`);
  });
});
