import type { ReactNode } from 'react';
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import posthog from 'posthog-js';
import { useEffect } from 'react';
import { CookieConsentProvider, useCookieConsent } from '@/components/legal/cookie-consent-context';
import { CookieSettingsDialog } from '@/components/legal/cookie-settings-dialog';
import { COOKIE_CONSENT_COOKIE } from '@/lib/consent/cookie-consent';
import { clearAllCookies, renderWithProviders, screen, setupUser } from '@/tests/component-render';

function Wrapper({ children, initialDecision = null }: { children: ReactNode, initialDecision?: 'accepted' | 'rejected' | null }) {
  return <CookieConsentProvider initialDecision={initialDecision}>{children}</CookieConsentProvider>;
}

/** `CookieSettingsDialog` is context-driven with no `open` prop — this opens it for the test, mirroring how the banner/footer/Ajustes trigger it in real usage. */
function OpenOnMount() {
  const { openSettings } = useCookieConsent();
  useEffect(() => { openSettings(); }, [openSettings]);
  return null;
}

/**
 * Reproduces the exact live bug this test guards against: `CookieSettingsDialog`
 * is a single instance mounted once (never remounted between opens), so
 * accepting the banner and then opening the settings dialog — without a full
 * page reload in between — must still show the toggle in sync with the
 * decision that just changed, not whatever it was frozen at on first mount.
 */
function AcceptThenOpen() {
  const { accept, openSettings } = useCookieConsent();
  useEffect(() => {
    accept();
    openSettings();
  }, [accept, openSettings]);
  return null;
}

describe('CookieSettingsDialog', () => {
  // `bun test` runs all given files in one process sharing the same
  // happy-dom `document`, in file-path order — a decision cookie left
  // behind by this file's last test would leak into whichever test file
  // sorts next alphabetically. See the matching note in
  // app/providers/posthog-provider.test.tsx (found in code review).
  afterEach(() => {
    clearAllCookies();
  });

  test('starts with the toggle reflecting the current decision', () => {
    renderWithProviders(
      <Wrapper initialDecision="accepted">
        <OpenOnMount />
        <CookieSettingsDialog />
      </Wrapper>,
    );
    expect(screen.getByTestId('cookie_settings_analytics_toggle')).toHaveAttribute('aria-checked', 'true');
  });

  test('re-syncs the toggle when the decision changes without a remount (regression)', () => {
    renderWithProviders(
      <Wrapper initialDecision={null}>
        <AcceptThenOpen />
        <CookieSettingsDialog />
      </Wrapper>,
    );
    expect(screen.getByTestId('cookie_settings_analytics_toggle')).toHaveAttribute('aria-checked', 'true');
  });

  test('turning the toggle off and saving writes a rejected decision', async () => {
    clearAllCookies();
    const user = setupUser();
    renderWithProviders(
      <Wrapper initialDecision="accepted">
        <OpenOnMount />
        <CookieSettingsDialog />
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
        <OpenOnMount />
        <CookieSettingsDialog />
      </Wrapper>,
    );

    await user.click(screen.getByTestId('cookie_settings_analytics_toggle'));
    await user.click(screen.getByTestId('cookie_settings_save_button'));

    expect(document.cookie).toContain(`${COOKIE_CONSENT_COOKIE}=accepted`);
  });

  test('withdrawal never calls posthog.reset() (regression, ADR-0025)', async () => {
    // `reset()` was found live to asynchronously re-write PostHog's own
    // storage cookie AFTER our explicit delete, silently resurrecting it —
    // see ADR-0025 and lib/consent/cookie-consent.ts's clearPostHogStorage.
    // opt_out_capturing() must still fire (stops future capture).
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
    const resetSpy = spyOn(posthog, 'reset');
    const optOutSpy = spyOn(posthog, 'opt_out_capturing');
    clearAllCookies();
    const user = setupUser();
    renderWithProviders(
      <Wrapper initialDecision="accepted">
        <OpenOnMount />
        <CookieSettingsDialog />
      </Wrapper>,
    );

    await user.click(screen.getByTestId('cookie_settings_analytics_toggle'));
    await user.click(screen.getByTestId('cookie_settings_save_button'));

    expect(optOutSpy).toHaveBeenCalled();
    expect(resetSpy).not.toHaveBeenCalled();
    resetSpy.mockRestore();
    optOutSpy.mockRestore();
  });
});
