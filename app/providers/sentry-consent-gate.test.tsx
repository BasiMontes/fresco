import { afterEach, describe, expect, mock, test } from 'bun:test';
import { CookieConsentProvider, useCookieConsent } from '@/components/legal/cookie-consent-context';
import { clearAllCookies, renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { SentryConsentGate } from './sentry-consent-gate';

function ConsentControls() {
  const { accept, reject } = useCookieConsent();
  return (
    <>
      <button type="button" data-testid="test_accept" onClick={accept}>accept</button>
      <button type="button" data-testid="test_reject" onClick={reject}>reject</button>
    </>
  );
}

function fakeSentry() {
  return {
    start: mock(() => null),
    stop: mock(async () => {}),
  };
}

/** FRESCO-1042 / ADR-0065: the browser Sentry SDK starts only after the visitor accepts cookies. */
describe('SentryConsentGate', () => {
  afterEach(() => {
    clearAllCookies();
  });

  test('never starts Sentry while the decision is undecided', () => {
    const sentry = fakeSentry();
    renderWithProviders(
      <CookieConsentProvider initialDecision={null}>
        <SentryConsentGate sentry={sentry} />
      </CookieConsentProvider>,
    );
    expect(sentry.start).not.toHaveBeenCalled();
  });

  test('never starts Sentry after a rejection', () => {
    const sentry = fakeSentry();
    renderWithProviders(
      <CookieConsentProvider initialDecision="rejected">
        <SentryConsentGate sentry={sentry} />
      </CookieConsentProvider>,
    );
    expect(sentry.start).not.toHaveBeenCalled();
  });

  test('starts Sentry when the decision is accepted', () => {
    const sentry = fakeSentry();
    renderWithProviders(
      <CookieConsentProvider initialDecision="accepted">
        <SentryConsentGate sentry={sentry} />
      </CookieConsentProvider>,
    );
    expect(sentry.start).toHaveBeenCalledTimes(1);
  });

  test('accepting starts Sentry and a later withdrawal stops it', async () => {
    const sentry = fakeSentry();
    const user = setupUser();
    renderWithProviders(
      <CookieConsentProvider initialDecision={null}>
        <SentryConsentGate sentry={sentry} />
        <ConsentControls />
      </CookieConsentProvider>,
    );

    await user.click(screen.getByTestId('test_accept'));
    expect(sentry.start).toHaveBeenCalledTimes(1);

    sentry.stop.mockClear();
    await user.click(screen.getByTestId('test_reject'));
    expect(sentry.stop).toHaveBeenCalledTimes(1);
  });
});
