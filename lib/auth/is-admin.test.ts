import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { isAdminUser } from './is-admin';

describe('isAdminUser', () => {
  const ORIGINAL = process.env.ADMIN_USER_ID;

  beforeEach(() => {
    delete process.env.ADMIN_USER_ID;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) { delete process.env.ADMIN_USER_ID; }
    else { process.env.ADMIN_USER_ID = ORIGINAL; }
  });

  test('returns false when ADMIN_USER_ID is unset', () => {
    expect(isAdminUser('user-a')).toBe(false);
  });

  test('returns false for a user not in the allowlist', () => {
    process.env.ADMIN_USER_ID = 'user-a,user-b';
    expect(isAdminUser('user-c')).toBe(false);
  });

  test('returns true for a user in the allowlist', () => {
    process.env.ADMIN_USER_ID = 'user-a,user-b';
    expect(isAdminUser('user-b')).toBe(true);
  });

  test('tolerates surrounding whitespace in the comma-separated list', () => {
    process.env.ADMIN_USER_ID = ' user-a , user-b ';
    expect(isAdminUser('user-b')).toBe(true);
  });

  test('a blank ADMIN_USER_ID never matches an empty-string userId', () => {
    process.env.ADMIN_USER_ID = '';
    expect(isAdminUser('')).toBe(false);
  });
});
