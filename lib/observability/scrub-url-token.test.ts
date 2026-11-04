import { describe, expect, test } from 'bun:test';
import { scrubUrlToken, scrubUrlTokenInProperties } from './scrub-url-token';

const TOKEN = 'abcDEF0123456789abcDEF0123456789abcDEF01234';

describe('scrubUrlToken', () => {
  test('blanks the token of a waitlist link', () => {
    expect(scrubUrlToken(`https://fresco-pro.vercel.app/lista-de-espera?token=${TOKEN}`)).toBe('https://fresco-pro.vercel.app/lista-de-espera?token=redacted');
  });

  test('keeps the other parameters and the hash', () => {
    expect(scrubUrlToken(`/lista-de-espera?accion=borrar&token=${TOKEN}&x=1#top`)).toBe('/lista-de-espera?accion=borrar&token=redacted&x=1#top');
  });

  test('leaves a URL without a token, and non-strings, alone', () => {
    expect(scrubUrlToken('https://fresco-pro.vercel.app/recetas?q=token')).toBe('https://fresco-pro.vercel.app/recetas?q=token');
    expect(scrubUrlToken(42)).toBe(42);
    expect(scrubUrlToken(undefined)).toBeUndefined();
  });
});

describe('scrubUrlTokenInProperties', () => {
  test('scrubs every URL property of an event and keeps the rest', () => {
    const out = scrubUrlTokenInProperties({
      $current_url: `https://x.app/lista-de-espera?token=${TOKEN}`,
      $referrer: `https://x.app/lista-de-espera?token=${TOKEN}`,
      $pathname: '/lista-de-espera',
      count: 3,
    });

    expect(out).toEqual({
      $current_url: 'https://x.app/lista-de-espera?token=redacted',
      $referrer: 'https://x.app/lista-de-espera?token=redacted',
      $pathname: '/lista-de-espera',
      count: 3,
    });
  });
});
