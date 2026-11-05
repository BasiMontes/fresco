import type { CookieConsentDecision } from '@/lib/consent/cookie-consent';
import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { CookieConsentProvider } from '@/components/legal/cookie-consent-context';
import * as realIdentity from '@/lib/client-api/identity';
import { COOKIE_CONSENT_COOKIE, serializeCookieConsent } from '@/lib/consent/cookie-consent';
import { LEGAL_TEXTS_VERSION } from '@/lib/legal/consent';
import { renderWithProviders, waitFor } from '@/tests/component-render';
import { AnalyticsConsentSync } from './analytics-consent-sync';

/**
 * FRESCO-919 (ADR-0044) — the banner decision is mirrored into the signed-in
 * user's profile. The decision comes from the real `CookieConsentProvider`, the
 * session from `watchAuthState`, which is stubbed: the component's own gating is
 * what is tested.
 */

let decision: CookieConsentDecision | null = 'rejected';
let hasSession = true;
let authEvent: { event: string, user: { id: string, is_anonymous?: boolean } | null } = { event: 'SIGNED_IN', user: { id: 'user-1' } };
const syncAnalyticsConsent = mock(async (_args: { userId: string, accepted: boolean, version?: string | null, decidedAt?: number | null }) => {});

/** The banner writes this cookie when the person decides; the sync reads the version and moment from it. */
function setConsentCookie(value: 'accepted' | 'rejected') {
  document.cookie = `${COOKIE_CONSENT_COOKIE}=${serializeCookieConsent(value, 1_700_000_000_000)}`;
}
const unsubscribe = mock(() => {});

void mock.module('@/lib/client-api/identity', () => ({
  ...realIdentity,
  hasSupabaseSessionCookie: () => hasSession,
  syncAnalyticsConsent,
  watchAuthState: async ({ onChange }: { onChange: (event: string, session: unknown) => void }) => {
    onChange(authEvent.event, authEvent.user ? { user: authEvent.user } : null);
    return unsubscribe;
  },
}));

// `mock.module` is process-wide in bun: put the real module back so later test files see it.
afterAll(() => {
  void mock.module('@/lib/client-api/identity', () => realIdentity);
});

function render() {
  return renderWithProviders(
    <CookieConsentProvider initialDecision={decision}>
      <AnalyticsConsentSync />
    </CookieConsentProvider>,
  );
}

beforeEach(() => {
  decision = 'rejected';
  hasSession = true;
  authEvent = { event: 'SIGNED_IN', user: { id: 'user-1' } };
  document.cookie = `${COOKIE_CONSENT_COOKIE}=; max-age=0`;
  syncAnalyticsConsent.mockClear();
  unsubscribe.mockClear();
});

describe('AnalyticsConsentSync', () => {
  test('a rejection of a signed-in user is written to the profile as false', async () => {
    setConsentCookie('rejected');
    render();

    await waitFor(() => expect(syncAnalyticsConsent).toHaveBeenCalledTimes(1));
    expect(syncAnalyticsConsent.mock.calls[0][0]).toEqual({ userId: 'user-1', accepted: false, version: LEGAL_TEXTS_VERSION, decidedAt: 1_700_000_000 });
  });

  test('an acceptance is written as true, with the version and the moment of the cookie (FRESCO-1124)', async () => {
    decision = 'accepted';
    setConsentCookie('accepted');
    render();

    await waitFor(() => expect(syncAnalyticsConsent).toHaveBeenCalledTimes(1));
    expect(syncAnalyticsConsent.mock.calls[0][0]).toEqual({ userId: 'user-1', accepted: true, version: LEGAL_TEXTS_VERSION, decidedAt: 1_700_000_000 });
  });

  test('an undecided banner (expired or outdated cookie) overwrites a stale consent with false (FRESCO-1109)', async () => {
    decision = null;
    render();

    await waitFor(() => expect(syncAnalyticsConsent).toHaveBeenCalledTimes(1));
    expect(syncAnalyticsConsent.mock.calls[0][0]).toEqual({ userId: 'user-1', accepted: false, version: null, decidedAt: null });
  });

  test('nothing is written, and no SDK is loaded, without a session cookie', async () => {
    hasSession = false;
    render();
    await Promise.resolve();

    expect(syncAnalyticsConsent).not.toHaveBeenCalled();
  });

  test('a guest (anonymous) is skipped', async () => {
    authEvent = { event: 'SIGNED_IN', user: { id: 'guest-1', is_anonymous: true } };
    render();
    await Promise.resolve();

    expect(syncAnalyticsConsent).not.toHaveBeenCalled();
  });

  test('a sign-out writes nothing', async () => {
    authEvent = { event: 'SIGNED_OUT', user: null };
    render();
    await Promise.resolve();

    expect(syncAnalyticsConsent).not.toHaveBeenCalled();
  });
});
