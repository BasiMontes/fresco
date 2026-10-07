import { AuthApiError } from '@supabase/supabase-js';
import { describe, expect, it } from 'bun:test';
import { isEmailNotConfirmed, translateAuthError } from '@/lib/auth-errors';

describe('translateAuthError', () => {
  it('maps a failed captcha to its own Spanish message (FRESCO-799)', () => {
    const error = new AuthApiError('captcha protection: request disallowed', 400, 'captcha_failed');
    expect(translateAuthError(error)).toBe('No pudimos verificar que eres una persona. Espera un momento e inténtalo de nuevo.');
  });

  it('falls back to the generic message for an unmapped code and for non-auth errors', () => {
    const generic = 'Algo salió mal. Inténtalo de nuevo en unos segundos.';
    expect(translateAuthError(new AuthApiError('nope', 500, 'unexpected_failure'))).toBe(generic);
    expect(translateAuthError(null)).toBe(generic);
  });
});

describe('isEmailNotConfirmed', () => {
  it('is true only for an auth error carrying the email_not_confirmed code', () => {
    expect(isEmailNotConfirmed(new AuthApiError('Email not confirmed', 400, 'email_not_confirmed'))).toBe(true);
    expect(isEmailNotConfirmed(new AuthApiError('nope', 400, 'invalid_credentials'))).toBe(false);
    expect(isEmailNotConfirmed(new Error('email_not_confirmed'))).toBe(false);
    expect(isEmailNotConfirmed(null)).toBe(false);
  });
});
