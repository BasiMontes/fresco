import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { getDistinctId } from './distinct-id';

/**
 * FRESCO-895: `getDistinctId` used to `import posthog from 'posthog-js'`, which put the
 * whole SDK (about 311 KB) in the initial JS of `/signup` only. It now reads the id
 * posthog-js itself persists under `ph_<key>_posthog`, synchronously and without the SDK.
 */

const KEY = 'phc_test_key';
const STORAGE_KEY = `ph_${KEY}_posthog`;
const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

function clearStores() {
  localStorage.clear();
  document.cookie = `${STORAGE_KEY}=; path=/; max-age=0`;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_POSTHOG_KEY = KEY;
  clearStores();
});

afterEach(() => {
  clearStores();
  if (originalKey === undefined) {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  }
  else {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey;
  }
});

describe('getDistinctId', () => {
  test('reads the distinct_id posthog-js persisted in localStorage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ distinct_id: 'anon-123', $sesid: [1, 'x', 2] }));

    expect(getDistinctId()).toBe('anon-123');
  });

  test('falls back to the cookie when localStorage has nothing', () => {
    document.cookie = `${STORAGE_KEY}=${encodeURIComponent(JSON.stringify({ distinct_id: 'cookie-456' }))}; path=/`;

    expect(getDistinctId()).toBe('cookie-456');
  });

  test('returns null before consent, when posthog-js never persisted anything', () => {
    expect(getDistinctId()).toBeNull();
  });

  test('returns null when the key is not configured', () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ distinct_id: 'anon-123' }));

    expect(getDistinctId()).toBeNull();
  });

  test('returns null, without throwing, when the stored value is not valid JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');

    expect(getDistinctId()).toBeNull();
  });

  test('returns null when the stored object has no usable distinct_id', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ distinct_id: 42 }));

    expect(getDistinctId()).toBeNull();
  });
});
