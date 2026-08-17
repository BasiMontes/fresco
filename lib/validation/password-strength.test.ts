import { describe, expect, test } from 'bun:test';
import { getPasswordStrength } from './password-strength';

describe('getPasswordStrength', () => {
  test('empty password is weak', () => {
    expect(getPasswordStrength('')).toBe('weak');
  });

  test('short, single-character-class password is weak', () => {
    expect(getPasswordStrength('abc')).toBe('weak');
    expect(getPasswordStrength('abcdefg')).toBe('weak');
  });

  test('8+ chars with some variety is medium', () => {
    expect(getPasswordStrength('abcdefg1')).toBe('medium');
    expect(getPasswordStrength('Abcdefgh')).toBe('medium');
  });

  test('long password with full character-class variety is strong', () => {
    expect(getPasswordStrength('Abcdefgh1!')).toBe('strong');
    expect(getPasswordStrength('MiContraseña123!')).toBe('strong');
  });

  test('long but single-class password does not reach strong', () => {
    expect(getPasswordStrength('aaaaaaaaaaaaaaaa')).toBe('medium');
  });
});
