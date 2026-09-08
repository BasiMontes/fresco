import { describe, expect, it } from 'bun:test';
import { isPasswordTooShort, MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT_MESSAGE } from './password-policy';

describe('password-policy (FRESCO-363 / A4-H8)', () => {
  it('enforces a minimum length of 10', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10);
  });

  it('flags a password below the minimum', () => {
    expect(isPasswordTooShort('')).toBe(true);
    expect(isPasswordTooShort('short')).toBe(true);
    expect(isPasswordTooShort('123456789')).toBe(true); // 9
  });

  it('accepts a password at or above the minimum', () => {
    expect(isPasswordTooShort('1234567890')).toBe(false); // exactly 10
    expect(isPasswordTooShort('a-long-enough-password')).toBe(false);
  });

  it('names the minimum in the user-facing message', () => {
    expect(PASSWORD_TOO_SHORT_MESSAGE).toContain('10');
  });

  // FRESCO-465 — explicit boundary-value batch on the length frontier.
  describe('length boundary (FRESCO-465)', () => {
    it.each([
      [0, true],
      [9, true],
      [10, false],
      [11, false],
    ] as const)('length %i -> tooShort=%p', (length, expected) => {
      const password = 'a'.repeat(length);
      expect(password).toHaveLength(length);
      expect(isPasswordTooShort(password)).toBe(expected);
    });
  });
});
