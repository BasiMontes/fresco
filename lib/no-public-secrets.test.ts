import { readFileSync } from 'node:fs';
import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';

/**
 * FRESCO-907 (definitive audit C-26): Next.js inlines into the browser bundle every
 * `NEXT_PUBLIC_*` variable the code reads. A variable named like a secret that carries that prefix
 * is a trap: Vercel held `NEXT_PUBLIC_TURNSTILE_SECRET_KEY` for a while, harmless only because no code
 * read it. The prefix is a promise that the value is public, so a secret must never wear it.
 *
 * This reads the source, configuration and workflows for any `NEXT_PUBLIC_` name that looks like a
 * secret, so the first read of one fails the build instead of shipping the value to every visitor.
 * Documentation and audit notes may name such a variable (they describe the incident), so they are not
 * scanned.
 */

const SECRET_LOOKING = /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|PRIVATE|SERVICE_ROLE|PASSWORD|TOKEN)[A-Z0-9_]*/g;

const SCANNED = [
  'app/**/*.{ts,tsx,js,mjs}',
  'components/**/*.{ts,tsx}',
  'lib/**/*.{ts,tsx}',
  'scripts/**/*.{ts,js,mjs}',
  'supabase/functions/**/*.ts',
  'next.config.mjs',
  'proxy.ts',
  '.env.example',
  '.github/workflows/*.yml',
];

function scannedFiles(): string[] {
  return SCANNED
    .flatMap(pattern => [...new Glob(pattern).scanSync({ cwd: '.', dot: true })])
    // This file has to spell the pattern it guards.
    .filter(file => file !== 'lib/no-public-secrets.test.ts')
    .sort();
}

function offendersIn(files: string[]): Array<{ file: string, names: string[] }> {
  return files
    .map(file => ({ file, names: [...new Set(readFileSync(file, 'utf8').match(SECRET_LOOKING) ?? [])] }))
    .filter(entry => entry.names.length > 0);
}

describe('no secret wears the NEXT_PUBLIC_ prefix', () => {
  test('no source, config or workflow file names a NEXT_PUBLIC_ variable that looks like a secret', () => {
    expect(offendersIn(scannedFiles())).toEqual([]);
  });

  test('the scan sees the files it is meant to guard', () => {
    const files = scannedFiles();

    expect(files.length).toBeGreaterThan(300);
    expect(files).toContain('lib/auth/captcha.ts');
    expect(files).toContain('.env.example');
  });

  test('the pattern catches the incident variable and the public ones stay fine', () => {
    const matches = (text: string) => text.match(SECRET_LOOKING) ?? [];

    expect(matches('process.env.NEXT_PUBLIC_TURNSTILE_SECRET_KEY')).toEqual(['NEXT_PUBLIC_TURNSTILE_SECRET_KEY']);
    expect(matches('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_API_TOKEN')).toHaveLength(2);
    expect(matches('NEXT_PUBLIC_TURNSTILE_SITE_KEY NEXT_PUBLIC_POSTHOG_KEY NEXT_PUBLIC_SENTRY_DSN')).toEqual([]);
  });
});
