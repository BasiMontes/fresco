import { describe, expect, test } from 'bun:test';
import { needsCurrentPassword, passwordChangeErrorMessage } from './password-change';

/**
 * FRESCO-1015 (audit 7b A7-AUTHZ-04) — which sessions must prove the current password before
 * choosing a new one, and the Spanish copy for the errors Auth returns.
 */

describe('needsCurrentPassword', () => {
  test.each([
    [['password']],
    [['password', 'token_refresh']],
    [['token_refresh']],
    [[]],
  ])('a session built from %j asks for it', (methods) => {
    expect(needsCurrentPassword(methods)).toBe(true);
  });

  test('a session whose origin cannot be read asks for it (fail closed)', () => {
    expect(needsCurrentPassword(null)).toBe(true);
  });

  test.each([
    [['recovery']],
    [['recovery', 'token_refresh']],
    [['otp']],
    [['magiclink']],
    [['email_change', 'token_refresh']],
    [['anonymous']],
    [['invite']],
  ])('a session built from %j does not', (methods) => {
    expect(needsCurrentPassword(methods)).toBe(false);
  });
});

describe('passwordChangeErrorMessage', () => {
  test('maps a wrong current password and a stale login to Spanish copy', () => {
    expect(passwordChangeErrorMessage({ code: 'current_password_mismatch' })).toBe('La contraseña actual no es correcta.');
    expect(passwordChangeErrorMessage({ message: 'Incorrect current password' })).toBe('La contraseña actual no es correcta.');
    expect(passwordChangeErrorMessage({ code: 'reauthentication_needed' })).toContain('vuelve a iniciar sesión');
    expect(passwordChangeErrorMessage({ code: 'reauthentication_not_valid' })).toContain('vuelve a iniciar sesión');
  });

  test('leaves any other error to the caller', () => {
    expect(passwordChangeErrorMessage({ code: 'weak_password', message: 'Password is too weak' })).toBeNull();
  });
});
