import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import posthog from 'posthog-js';
import { CookieConsentProvider, useCookieConsent } from '@/components/legal/cookie-consent-context';
import { clearAllCookies, renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { PostHogProvider } from './posthog-provider';

/** Exposes accept/reject as clickable buttons so a test can drive a full decision cycle. */
function ConsentControls() {
  const { accept, reject } = useCookieConsent();
  return (
    <>
      <button type="button" data-testid="test_accept" onClick={accept}>accept</button>
      <button type="button" data-testid="test_reject" onClick={reject}>reject</button>
    </>
  );
}

/**
 * FRESCO-428 / ADR-0025 — `posthog.init()` must never fire before the
 * consent decision is `'accepted'`. `posthog-js` is globally stubbed in
 * `bun-test-setup.ts`; `spyOn` wraps that same stub instance so call counts
 * are real assertions, not just "does not throw".
 */
describe('PostHogProvider — consent gate', () => {
  // Matches lib/posthog/server.test.ts's own precedent for this env var.
  process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';

  // The "regression" test below is the only one in this file that actually
  // writes the consent cookie (via accept()/reject() clicks) — clean up so
  // it can't leak into another test FILE's assertions. `bun test` runs all
  // given files in one process sharing the same happy-dom `document`, in
  // file-path order rather than CLI-argument order — found live: this test
  // running before `lib/consent/cookie-consent.test.ts` alphabetically left
  // `fresco_cookie_consent=accepted` on `document.cookie`, failing that
  // file's very first "starts with no decision" assertion.
  afterEach(() => {
    clearAllCookies();
  });

  test('does not call posthog.init while consent is undecided', () => {
    const initSpy = spyOn(posthog, 'init');

    renderWithProviders(
      <CookieConsentProvider initialDecision={null}>
        <PostHogProvider>
          <div>child</div>
        </PostHogProvider>
      </CookieConsentProvider>,
    );

    expect(initSpy).not.toHaveBeenCalled();
    initSpy.mockRestore();
  });

  test('does not call posthog.init while consent is rejected', () => {
    const initSpy = spyOn(posthog, 'init');

    renderWithProviders(
      <CookieConsentProvider initialDecision="rejected">
        <PostHogProvider>
          <div>child</div>
        </PostHogProvider>
      </CookieConsentProvider>,
    );

    expect(initSpy).not.toHaveBeenCalled();
    initSpy.mockRestore();
  });

  test('calls posthog.init once consent is accepted', () => {
    const initSpy = spyOn(posthog, 'init');

    renderWithProviders(
      <CookieConsentProvider initialDecision="accepted">
        <PostHogProvider>
          <div>child</div>
        </PostHogProvider>
      </CookieConsentProvider>,
    );

    expect(initSpy).toHaveBeenCalled();
    initSpy.mockRestore();
  });

  test('re-accepting after a withdrawal calls opt_in_capturing (regression)', async () => {
    // Found in code review (FRESCO-428): once `posthog.init()` has fired
    // once, the module-level `initialized` flag skips it on every later
    // accept — so nothing reversed the `opt_out_capturing()` a withdrawal
    // calls, and capture silently stayed off for a reject-then-accept cycle.
    const optInSpy = spyOn(posthog, 'opt_in_capturing');
    const user = setupUser();

    renderWithProviders(
      <CookieConsentProvider initialDecision={null}>
        <PostHogProvider>
          <div>child</div>
        </PostHogProvider>
        <ConsentControls />
      </CookieConsentProvider>,
    );

    await user.click(screen.getByTestId('test_accept'));
    await user.click(screen.getByTestId('test_reject'));
    await user.click(screen.getByTestId('test_accept'));

    expect(optInSpy).toHaveBeenCalled();
    optInSpy.mockRestore();
  });
});
