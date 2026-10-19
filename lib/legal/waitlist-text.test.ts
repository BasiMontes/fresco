import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { WAITLIST_CONSENT_TEXT } from './waitlist-text';

/**
 * The waitlist form is a Client Component. It must take the consent copy from a file that reaches no Node API:
 * `lib/legal/waitlist.ts` imports `node:crypto`, and a client import of it breaks the webpack build.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) { return sourceFiles(path); }
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

describe('waitlist consent text', () => {
  test('is a plain constant in a file with no imports at all', () => {
    const source = readFileSync(new URL('./waitlist-text.ts', import.meta.url), 'utf8');

    expect(source).not.toMatch(/^import /m);
    expect(source).not.toMatch(/from ['"]node:/);
    expect(source).not.toContain('require(');
    expect(WAITLIST_CONSENT_TEXT).toContain('avisarme del lanzamiento');
  });

  test('the form imports it from there, not from the server module', () => {
    const form = readFileSync(new URL('../../components/landing/waitlist-form.tsx', import.meta.url), 'utf8');

    expect(form).toContain('from \'@/lib/legal/waitlist-text\'');
    expect(form).not.toContain('from \'@/lib/legal/waitlist\'');
  });

  test('no Client Component imports the server module that uses node:crypto', () => {
    const files = ['components', 'app'].flatMap(dir => sourceFiles(dir));
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /^['"]use client['"]/m.test(source) && /from '@\/lib\/legal\/waitlist'/.test(source);
    });

    expect(files.length).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
  });
});
