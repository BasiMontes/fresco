import { afterEach, describe, expect, test } from 'bun:test';
import { clearAllCookies } from '@/tests/component-render';
import {
  clearNombreCookie,
  IDENTITY_COOKIE_EVENT,
  IDENTITY_NOMBRE_COOKIE,
  readNombreCookie,
  writeNombreCookie,
} from './identity-cookie';

describe('identity-cookie (FRESCO-486)', () => {
  afterEach(() => {
    clearAllCookies();
  });

  test('reads null when nothing is set', () => {
    expect(readNombreCookie()).toBeNull();
  });

  test('round-trips a written name', () => {
    writeNombreCookie('Basi');
    expect(readNombreCookie()).toBe('Basi');
    expect(document.cookie).toContain(`${IDENTITY_NOMBRE_COOKIE}=`);
  });

  test('trims surrounding whitespace on write', () => {
    writeNombreCookie('  María  ');
    expect(readNombreCookie()).toBe('María');
  });

  test('percent-encodes names with special characters', () => {
    writeNombreCookie('José; DROP');
    expect(document.cookie).toContain('Jos%C3%A9%3B%20DROP');
    expect(readNombreCookie()).toBe('José; DROP');
  });

  test('caps an over-long name to keep the cookie well under the size limit', () => {
    writeNombreCookie('x'.repeat(500));
    expect(readNombreCookie()).toBe('x'.repeat(80));
  });

  test('writing an empty / whitespace-only name clears the cookie', () => {
    writeNombreCookie('Basi');
    writeNombreCookie('   ');
    expect(readNombreCookie()).toBeNull();
  });

  test('clearNombreCookie removes a previously written name', () => {
    writeNombreCookie('Basi');
    clearNombreCookie();
    expect(readNombreCookie()).toBeNull();
  });

  test('reads null for a malformed percent-encoding rather than throwing', () => {
    document.cookie = `${IDENTITY_NOMBRE_COOKIE}=%E0%A4%A; path=/`;
    expect(readNombreCookie()).toBeNull();
  });

  test('emits the change event on write and on clear', () => {
    let fired = 0;
    const bump = () => { fired += 1; };
    window.addEventListener(IDENTITY_COOKIE_EVENT, bump);

    writeNombreCookie('Basi');
    clearNombreCookie();

    window.removeEventListener(IDENTITY_COOKIE_EVENT, bump);
    expect(fired).toBe(2);
  });
});
