import { afterEach, describe, expect, test } from 'bun:test';
import { joinWaitlist } from './waitlist';

/**
 * FRESCO-1103 — the waitlist call carries the Turnstile token the server now asks for, and keeps
 * answering `false` for any failure instead of throwing into the form.
 */

const realFetch = globalThis.fetch;
let sentBody: unknown;

afterEach(() => {
  globalThis.fetch = realFetch;
  sentBody = undefined;
});

function stubFetch(respond: () => Response) {
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    sentBody = JSON.parse(String(init?.body));
    return respond();
  }) as unknown as typeof fetch;
}

describe('joinWaitlist', () => {
  test('sends the email, the consent and the captcha token', async () => {
    stubFetch(() => new Response('{}', { status: 200 }));

    expect(await joinWaitlist('ana@example.com', 'tok')).toBe(true);
    expect(sentBody).toEqual({ email: 'ana@example.com', consent: true, captchaToken: 'tok' });
  });

  test('sends null when the build shows no captcha', async () => {
    stubFetch(() => new Response('{}', { status: 200 }));

    await joinWaitlist('ana@example.com');

    expect(sentBody).toEqual({ email: 'ana@example.com', consent: true, captchaToken: null });
  });

  test.each([400, 429, 502, 503])('is false for a %s answer', async (status) => {
    stubFetch(() => new Response('{}', { status }));

    expect(await joinWaitlist('ana@example.com', 'tok')).toBe(false);
  });

  test('is false, not a throw, when the network fails', async () => {
    globalThis.fetch = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;

    expect(await joinWaitlist('ana@example.com', 'tok')).toBe(false);
  });
});
