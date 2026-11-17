import { describe, expect, test } from 'bun:test';

/**
 * FRESCO-1219 — the preload (`bun-test-setup.ts`) removes a Turnstile script a test left in the shared `document.head`,
 * so no test depends on which files ran before it. The two tests below must run in this order: the first leaves the
 * script behind on purpose, the second checks the preload's `afterEach` removed it.
 */
const SELECTOR = 'script[src*="challenges.cloudflare.com"]';

describe('test preload isolation', () => {
  test('a test can leave the Turnstile script in the head', () => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    document.head.appendChild(script);

    expect(document.querySelector(SELECTOR)).not.toBeNull();
  });

  test('the next test starts without it', () => {
    expect(document.querySelector(SELECTOR)).toBeNull();
  });
});
