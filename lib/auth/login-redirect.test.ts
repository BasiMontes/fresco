import { describe, expect, test } from 'bun:test';
import { loginUrlFor, postLoginPath } from './login-redirect';

/** FRESCO-1014 (A7-UI-16): the destination survives the login, and only a path of this app can be one. */

describe('loginUrlFor', () => {
  test('keeps the path and the query of a deep link, encoded', () => {
    expect(loginUrlFor('/shopping-list')).toBe('/login?next=%2Fshopping-list');
    expect(loginUrlFor('/calendar?semana=2026-W43')).toBe('/login?next=%2Fcalendar%3Fsemana%3D2026-W43');
  });

  test('needs no memory for the root or /menu', () => {
    expect(loginUrlFor('/')).toBe('/login');
    expect(loginUrlFor('/menu')).toBe('/login');
  });

  test('a missing or hostile path falls back to the bare login', () => {
    for (const hostile of [undefined, null, '', 'shopping-list', '//evil.com', '/\\evil.com', 'https://evil.com/x']) {
      expect(loginUrlFor(hostile)).toBe('/login');
    }
  });
});

describe('postLoginPath', () => {
  test('goes to the remembered destination', () => {
    expect(postLoginPath('/shopping-list')).toBe('/shopping-list');
    expect(postLoginPath('/calendar?semana=2026-W43')).toBe('/calendar?semana=2026-W43');
  });

  test('without a destination, or with a hostile one, goes to /menu', () => {
    for (const none of [undefined, null, '', '//evil.com', '/\\evil.com', 'https://evil.com']) {
      expect(postLoginPath(none)).toBe('/menu');
    }
  });

  test('never loops back to the login', () => {
    expect(postLoginPath('/login')).toBe('/menu');
    expect(postLoginPath('/login?next=%2Fmenu')).toBe('/menu');
  });
});
