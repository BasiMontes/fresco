import type { CookieConsentDecision } from '@/lib/consent/cookie-consent';
import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { CookieConsentProvider } from '@/components/legal/cookie-consent-context';
import * as realIdentity from '@/lib/client-api/identity';
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
const syncAnalyticsConsent = mock(async (_args: { userId: string, accepted: boolean }) => {});
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
  syncAnalyticsConsent.mockClear();
  unsubscribe.mockClear();
});

describe('AnalyticsConsentSync', () => {
  test('a rejection of a signed-in user is written to the profile as false', async () => {
    render();

    await waitFor(() => expect(syncAnalyticsConsent).toHaveBeenCalledTimes(1));
    expect(syncAnalyticsConsent.mock.calls[0][0]).toEqual({ userId: 'user-1', accepted: false });
  });

  test('an acceptance is written as true', async () => {
    decision = 'accepted';
    render();

    await waitFor(() => expect(syncAnalyticsConsent).toHaveBeenCalledTimes(1));
    expect(syncAnalyticsConsent.mock.calls[0][0]).toEqual({ userId: 'user-1', accepted: true });
  });

  test('nothing is written while the banner is undecided', async () => {
    decision = null;
    render();
    await Promise.resolve();

    expect(syncAnalyticsConsent).not.toHaveBeenCalled();
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
