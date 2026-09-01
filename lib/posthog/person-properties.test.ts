import type { User } from '@supabase/supabase-js';
import { describe, expect, test } from 'bun:test';
import { derivePersonProperties } from './person-properties';

/**
 * FRESCO-366 / A4-B4: pure derivation — the network read of `plan` happens
 * in the caller. What matters here: a guest is always `is_guest: true` +
 * `plan: 'free'` regardless of the passed plan, `signup_method` prefers
 * `user_metadata` and is omitted (not nulled) when unknown for a registered
 * user.
 */
function user(partial: Partial<Pick<User, 'is_anonymous' | 'user_metadata'>>): Pick<User, 'is_anonymous' | 'user_metadata'> {
  return { is_anonymous: partial.is_anonymous, user_metadata: partial.user_metadata ?? {} };
}

describe('derivePersonProperties', () => {
  test('anonymous session → guest, free, signup_method "guest"', () => {
    expect(derivePersonProperties(user({ is_anonymous: true }), 'pro')).toEqual({
      is_guest: true,
      plan: 'free',
      signup_method: 'guest',
    });
  });

  test('registered user → is_guest false, plan from the caller', () => {
    expect(derivePersonProperties(user({ is_anonymous: false }), 'pro')).toEqual({
      is_guest: false,
      plan: 'pro',
    });
  });

  test('signup_method comes from user_metadata when present', () => {
    const result = derivePersonProperties(
      user({ is_anonymous: false, user_metadata: { signup_method: 'progressive_signup_otp' } }),
      'free',
    );
    expect(result).toEqual({ is_guest: false, plan: 'free', signup_method: 'progressive_signup_otp' });
  });

  test('user_metadata.signup_method overrides the guest default', () => {
    const result = derivePersonProperties(
      user({ is_anonymous: true, user_metadata: { signup_method: 'account' } }),
      'free',
    );
    expect(result.signup_method).toBe('account');
  });

  test('missing is_anonymous is treated as registered', () => {
    expect(derivePersonProperties(user({}), 'free')).toEqual({ is_guest: false, plan: 'free' });
  });
});
