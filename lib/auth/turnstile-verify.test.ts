import { describe, expect, test } from 'bun:test';
import { verifyTurnstileToken } from './turnstile-verify';

/**
 * FRESCO-1006 (audit 7b A7-ABUSE-02) — a bad token and a broken check are different answers, so the
 * route can refuse the first with a 400 and the second with a 503 instead of passing either.
 */

const answer = (body: unknown, init: ResponseInit = {}) => (async () => new Response(JSON.stringify(body), init)) as unknown as typeof fetch;

describe('verifyTurnstileToken', () => {
  test('ok when Cloudflare says the token is valid, and it is sent as a form with the secret', async () => {
    let seen: { url: string, init?: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ success: true }));
    }) as unknown as typeof fetch;

    expect(await verifyTurnstileToken({ token: 'tok', secret: 'sec', remoteIp: '1.2.3.4', fetchImpl })).toBe('ok');
    expect(seen!.url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(seen!.init?.method).toBe('POST');
    const form = seen!.init?.body as URLSearchParams;
    expect(form.get('secret')).toBe('sec');
    expect(form.get('response')).toBe('tok');
    expect(form.get('remoteip')).toBe('1.2.3.4');
  });

  test('leaves the remote IP out when there is none', async () => {
    let form: URLSearchParams | null = null;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      form = init?.body as URLSearchParams;
      return new Response(JSON.stringify({ success: true }));
    }) as unknown as typeof fetch;

    await verifyTurnstileToken({ token: 'tok', secret: 'sec', fetchImpl });

    expect(form!.has('remoteip')).toBe(false);
  });

  test.each(['invalid-input-response', 'timeout-or-duplicate', 'missing-input-response'])('invalid when Cloudflare rejects the token (%s)', async (code) => {
    expect(await verifyTurnstileToken({ token: 't', secret: 's', fetchImpl: answer({ 'success': false, 'error-codes': [code] }) })).toBe('invalid');
  });

  test.each(['invalid-input-secret', 'missing-input-secret', 'bad-request'])('unavailable, not invalid, when Cloudflare rejects OUR side (%s): a bad secret must not blame every visitor', async (code) => {
    expect(await verifyTurnstileToken({ token: 't', secret: 's', fetchImpl: answer({ 'success': false, 'error-codes': [code] }) })).toBe('unavailable');
  });

  test('trims whitespace and newlines around the secret and the token before sending them', async () => {
    let form: URLSearchParams | null = null;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      form = init?.body as URLSearchParams;
      return new Response(JSON.stringify({ success: true }));
    }) as unknown as typeof fetch;

    await verifyTurnstileToken({ token: ' tok\n', secret: '\n  sec \n', fetchImpl });

    expect(form!.get('secret')).toBe('sec');
    expect(form!.get('response')).toBe('tok');
  });

  test('unavailable on Cloudflare\'s own internal error, a non-200, a network failure or a timeout', async () => {
    expect(await verifyTurnstileToken({ token: 't', secret: 's', fetchImpl: answer({ 'success': false, 'error-codes': ['internal-error'] }) })).toBe('unavailable');
    expect(await verifyTurnstileToken({ token: 't', secret: 's', fetchImpl: answer({}, { status: 503 }) })).toBe('unavailable');
    expect(await verifyTurnstileToken({ token: 't', secret: 's', fetchImpl: (async () => { throw new Error('offline'); }) as unknown as typeof fetch })).toBe('unavailable');

    const hang = (async (_url: string, init?: RequestInit) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as unknown as typeof fetch;
    expect(await verifyTurnstileToken({ token: 't', secret: 's', fetchImpl: hang, timeoutMs: 10 })).toBe('unavailable');
  });

  test('unavailable, not a pass, when the answer is not JSON', async () => {
    expect(await verifyTurnstileToken({ token: 't', secret: 's', fetchImpl: (async () => new Response('<html>')) as unknown as typeof fetch })).toBe('unavailable');
  });
});
