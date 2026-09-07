import { describe, expect, spyOn, test } from 'bun:test';
import posthog from 'posthog-js';
import { CookieConsentProvider } from '@/components/legal/cookie-consent-context';
import { renderWithProviders } from '@/tests/component-render';
import { PostHogProvider } from './posthog-provider';

/**
 * FRESCO-428 / ADR-0025 — `posthog.init()` must never fire before the
 * consent decision is `'accepted'`. `posthog-js` is globally stubbed in
 * `bun-test-setup.ts`; `spyOn` wraps that same stub instance so call counts
 * are real assertions, not just "does not throw".
 */
describe('PostHogProvider — consent gate', () => {
  // Matches lib/posthog/server.test.ts's own precedent for this env var.
  process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';

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
});
