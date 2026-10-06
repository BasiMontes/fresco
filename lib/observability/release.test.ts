import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { resolveRelease } from './release';

describe('resolveRelease (FRESCO-803)', () => {
  test('prefers the build-time value, then the Vercel commit', () => {
    expect(resolveRelease({ NEXT_PUBLIC_RELEASE: 'abc1234', VERCEL_GIT_COMMIT_SHA: 'zzz9999' })).toBe('abc1234');
    expect(resolveRelease({ VERCEL_GIT_COMMIT_SHA: 'zzz9999' })).toBe('zzz9999');
  });

  test('has no release outside Vercel, and ignores blanks', () => {
    expect(resolveRelease({})).toBeUndefined();
    expect(resolveRelease({ NEXT_PUBLIC_RELEASE: '', VERCEL_GIT_COMMIT_SHA: '   ' })).toBeUndefined();
  });

  test('trims the value', () => {
    expect(resolveRelease({ NEXT_PUBLIC_RELEASE: ' abc1234\n' })).toBe('abc1234');
  });
});

// The three SDK inits must all carry the release, or an error from that runtime
// is attributed to no deploy. Read as text: importing them would start Sentry.
describe('Sentry inits carry the release (FRESCO-803)', () => {
  const root = join(import.meta.dir, '..', '..');
  for (const file of ['sentry.server.config.ts', 'sentry.edge.config.ts', 'instrumentation-client.ts']) {
    test(`${file} passes release: sentryRelease()`, () => {
      expect(readFileSync(join(root, file), 'utf8')).toContain('release: sentryRelease()');
    });
  }

  test('next.config.mjs inlines the commit for the browser bundle', () => {
    expect(readFileSync(join(root, 'next.config.mjs'), 'utf8')).toContain('NEXT_PUBLIC_RELEASE: process.env.VERCEL_GIT_COMMIT_SHA');
  });
});
