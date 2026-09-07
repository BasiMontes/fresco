import { afterEach, describe, expect, test } from 'bun:test';
import {
  clearPostHogStorage,
  COOKIE_CONSENT_COOKIE,
  isCookieConsentDecision,
  parseCookieConsent,
  readCookieConsentClient,
  writeCookieConsent,
} from './cookie-consent';

function clearAllCookies() {
  document.cookie.split(';').forEach((entry) => {
    const name = entry.split('=')[0]?.trim();
    if (name) {
      document.cookie = `${name}=; path=/; max-age=0`;
    }
  });
}

describe('isCookieConsentDecision / parseCookieConsent', () => {
  test('accepts the two valid decisions', () => {
    expect(isCookieConsentDecision('accepted')).toBe(true);
    expect(isCookieConsentDecision('rejected')).toBe(true);
  });

  test('rejects anything else, including undefined and garbage strings', () => {
    expect(isCookieConsentDecision(undefined)).toBe(false);
    expect(isCookieConsentDecision('yes')).toBe(false);
    expect(isCookieConsentDecision('')).toBe(false);
  });

  test('parseCookieConsent mirrors the type guard', () => {
    expect(parseCookieConsent('accepted')).toBe('accepted');
    expect(parseCookieConsent('rejected')).toBe('rejected');
    expect(parseCookieConsent(undefined)).toBeNull();
    expect(parseCookieConsent('nope')).toBeNull();
  });
});

describe('writeCookieConsent / readCookieConsentClient', () => {
  afterEach(() => {
    clearAllCookies();
  });

  test('round-trips a written decision', () => {
    expect(readCookieConsentClient()).toBeNull();

    writeCookieConsent('accepted');
    expect(readCookieConsentClient()).toBe('accepted');

    writeCookieConsent('rejected');
    expect(readCookieConsentClient()).toBe('rejected');
  });

  test('the written cookie carries a 1-year max-age and path=/', () => {
    writeCookieConsent('accepted');
    expect(document.cookie).toContain(`${COOKIE_CONSENT_COOKIE}=accepted`);
  });
});

describe('clearPostHogStorage', () => {
  afterEach(() => {
    clearAllCookies();
    localStorage.clear();
  });

  test('deletes the ph_<key>_posthog cookie and localStorage entry', () => {
    const posthogKey = 'phc_test123';
    const storageKey = `ph_${posthogKey}_posthog`;

    document.cookie = `${storageKey}=some-value; path=/; max-age=3600`;
    localStorage.setItem(storageKey, JSON.stringify({ distinct_id: 'abc' }));

    clearPostHogStorage(posthogKey);

    expect(document.cookie).not.toContain('some-value');
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  test('is a no-op for unrelated cookies/storage keys', () => {
    document.cookie = 'unrelated=keep-me; path=/; max-age=3600';
    localStorage.setItem('unrelated', 'keep-me');

    clearPostHogStorage('phc_other');

    expect(document.cookie).toContain('unrelated=keep-me');
    expect(localStorage.getItem('unrelated')).toBe('keep-me');
  });
});
