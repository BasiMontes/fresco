import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

/**
 * FRESCO-1166 — no Pro amount is written by hand in the landing or the profile upsell. The amount comes from
 * `getProPrices` (Stripe); a typed `4,99€` drifts with the first price change.
 */
const ROOT = join(import.meta.dir, '..', '..');
const SCANNED_DIRS = ['components/landing'];
const SCANNED_FILES = ['components/profile/pro-upsell-card.tsx', 'app/page.tsx'];
const EURO_AMOUNT = /\d+[,.]\d{2}\s?€|€\s?\d+[,.]\d{2}/;

function sources(): string[] {
  const fromDirs = SCANNED_DIRS.flatMap(dir =>
    readdirSync(join(ROOT, dir))
      .filter(f => /\.tsx?$/.test(f) && !/\.test\./.test(f))
      .map(f => `${dir}/${f}`),
  );
  return [...fromDirs, ...SCANNED_FILES];
}

describe('landing and profile upsell source', () => {
  test('scans the files it claims to scan', () => {
    expect(sources()).toContain('components/landing/final-cta.tsx');
    expect(sources()).toContain('components/landing/pricing.tsx');
  });

  test.each(sources())('%s writes no euro amount by hand', (file) => {
    const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');
    const offenders = lines
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*') && EURO_AMOUNT.test(line));

    expect(offenders).toEqual([]);
  });
});
