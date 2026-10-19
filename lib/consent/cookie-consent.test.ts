import { afterEach, describe, expect, test } from 'bun:test';
import { LEGAL_TEXTS_VERSION } from '@/lib/legal/consent';
import { clearAllCookies } from '@/tests/component-render';
import {
  clearPostHogStorage,
  COOKIE_CONSENT_COOKIE,
  isCookieConsentDecision,
  parseCookieConsent,
  parseCookieConsentRecord,
  readCookieConsentClient,
  serializeCookieConsent,
  writeCookieConsent,
} from './cookie-consent';

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

  test('parseCookieConsent reads a decision taken under the current texts', () => {
    expect(parseCookieConsent(serializeCookieConsent('accepted'))).toBe('accepted');
    expect(parseCookieConsent(serializeCookieConsent('rejected'))).toBe('rejected');
    expect(parseCookieConsent(undefined)).toBeNull();
    expect(parseCookieConsent('nope')).toBeNull();
  });
});

// FRESCO-1007 (audit 7b A7-PRIV-01): the decision carries the text version and the date.
describe('versioned cookie decision (FRESCO-1007)', () => {
  const NOW = Date.UTC(2026, 9, 19, 12, 0, 0);

  test('serializes the decision, the current version and the epoch seconds', () => {
    expect(serializeCookieConsent('accepted', NOW)).toBe(`accepted~${LEGAL_TEXTS_VERSION}~${NOW / 1000}`);
  });

  test('the record keeps the decision, the version and when it was taken', () => {
    expect(parseCookieConsentRecord(serializeCookieConsent('rejected', NOW))).toEqual({ decision: 'rejected', version: LEGAL_TEXTS_VERSION, decidedAt: NOW / 1000 });
  });

  test('a decision of an older version is no decision for the current texts: the banner shows again', () => {
    const old = 'accepted~provisional-2026-01-01~1767225600';

    expect(parseCookieConsentRecord(old)?.decision).toBe('accepted');
    expect(parseCookieConsent(old)).toBeNull();
    expect(parseCookieConsent(old, 'provisional-2026-01-01')).toBe('accepted');
  });

  test('the plain value the cookie held before this change reads as no decision', () => {
    expect(parseCookieConsent('accepted')).toBeNull();
    expect(parseCookieConsent('rejected')).toBeNull();
    expect(parseCookieConsentRecord('accepted')).toBeNull();
  });

  test.each([
    'accepted~',
    'accepted~v1',
    'accepted~v1~abc',
    'accepted~v1~0',
    'accepted~v1~-5',
    'accepted~v1~1.5',
    'maybe~v1~1767225600',
    '~v1~1767225600',
    'accepted~v1~1767225600~extra',
  ])('a malformed value (%s) is no record', (value) => {
    expect(parseCookieConsentRecord(value)).toBeNull();
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
    expect(document.cookie).toContain(`${COOKIE_CONSENT_COOKIE}=accepted~${LEGAL_TEXTS_VERSION}~`);
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
