import { afterEach, describe, expect, test } from 'bun:test';
import { isPasswordPwned } from './pwned-password';

/**
 * SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
 * → range prefix "5BAA6", suffix "1E4C9B93F3F0682250B6CF8331B7EE68FD8".
 * `crypto.subtle` is real here (Bun ships WebCrypto); only `fetch` is stubbed.
 */
const SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(impl: () => Promise<Response> | Response) {
  globalThis.fetch = (async () => impl()) as unknown as typeof fetch;
}

function rangeBody(lines: string[]): Response {
  return new Response(lines.join('\r\n'), { status: 200 });
}

describe('isPasswordPwned', () => {
  test('returns true when the hash suffix appears with a non-zero count', async () => {
    stubFetch(() => rangeBody([`${SUFFIX}:42`, 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:3']));

    expect(await isPasswordPwned('password')).toBe(true);
  });

  test('returns false when the hash suffix is not in the range response', async () => {
    stubFetch(() => rangeBody(['AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:9', 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB:1']));

    expect(await isPasswordPwned('password')).toBe(false);
  });

  test('treats a padding entry (count 0) as not breached', async () => {
    stubFetch(() => rangeBody([`${SUFFIX}:0`]));

    expect(await isPasswordPwned('password')).toBe(false);
  });

  test('matches the suffix case-insensitively', async () => {
    stubFetch(() => rangeBody([`${SUFFIX.toLowerCase()}:7`]));

    expect(await isPasswordPwned('password')).toBe(true);
  });

  test('fails open (returns false) when the request throws', async () => {
    stubFetch(() => {
      throw new Error('network down');
    });

    expect(await isPasswordPwned('password')).toBe(false);
  });

  test('fails open (returns false) on a non-OK response', async () => {
    stubFetch(() => new Response('rate limited', { status: 429 }));

    expect(await isPasswordPwned('password')).toBe(false);
  });
});
