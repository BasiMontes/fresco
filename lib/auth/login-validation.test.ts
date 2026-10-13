import { describe, expect, test } from 'bun:test';
import { hasLoginFieldErrors, NO_LOGIN_FIELD_ERRORS, validateLoginFields } from '@/lib/auth/login-validation';

/** FRESCO-944 — the named reasons `/login` gives instead of a silently disabled button. */

const OK = { email: 'persona@example.com', password: 'secreto', captchaReady: true };

describe('validateLoginFields', () => {
  test('accepts a filled form with a finished verification', () => {
    const errors = validateLoginFields(OK);

    expect(errors).toEqual(NO_LOGIN_FIELD_ERRORS);
    expect(hasLoginFieldErrors(errors)).toBe(false);
  });

  test('names each missing field on its own', () => {
    const errors = validateLoginFields({ email: '', password: '', captchaReady: true });

    expect(errors.email).toBe('Introduce tu correo electrónico.');
    expect(errors.password).toBe('Introduce tu contraseña.');
    expect(errors.captcha).toBeNull();
    expect(hasLoginFieldErrors(errors)).toBe(true);
  });

  test('treats an address of only spaces as missing', () => {
    expect(validateLoginFields({ ...OK, email: '   ' }).email).toBe('Introduce tu correo electrónico.');
  });

  test.each(['abc', 'a@b', '@b.co', 'a b@c.co'])('rejects the malformed address %p', (email) => {
    expect(validateLoginFields({ ...OK, email }).email).toBe('Introduce un correo válido.');
  });

  test('accepts an address with surrounding spaces', () => {
    expect(validateLoginFields({ ...OK, email: '  persona@example.com ' }).email).toBeNull();
  });

  test('says to wait when the verification has not finished', () => {
    const errors = validateLoginFields({ ...OK, captchaReady: false });

    expect(errors.captcha).toBe('Espera a que termine la verificación de arriba para continuar.');
    expect(errors.email).toBeNull();
    expect(hasLoginFieldErrors(errors)).toBe(true);
  });

  test('does not trim the password: spaces can be part of it', () => {
    expect(validateLoginFields({ ...OK, password: '  ' }).password).toBeNull();
  });
});
