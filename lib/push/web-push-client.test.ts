import { describe, expect, test } from 'bun:test';
import { urlBase64ToUint8Array } from './web-push-client';

describe('urlBase64ToUint8Array', () => {
  test('decodes a base64url VAPID-shaped key into raw bytes', () => {
    // "hello" base64url-encoded, no padding — matches how VAPID public keys
    // arrive (base64url, RFC 4648 §5, padding stripped).
    const result = urlBase64ToUint8Array('aGVsbG8');

    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]);
  });

  test('handles the URL-safe -/_ characters that base64url substitutes for +//', () => {
    // Encodes bytes that map to `+`/`/` in standard base64 (`>?` -> `Pj8=`),
    // which base64url spells `Pj8` with `-`/`_` swapped in where relevant —
    // this input exercises the `.replace(/-/g, '+').replace(/_/g, '/')` step.
    const result = urlBase64ToUint8Array('Pj8-Pw');

    expect(result.length).toBeGreaterThan(0);
  });
});
