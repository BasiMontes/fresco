import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

/**
 * FRESCO-893 — `/favicon.ico` answered 404 in production. Browsers use the SVG icon, but
 * crawlers and some clients ask for the .ico directly. Next.js serves `app/favicon.ico`
 * by file convention, so the file only has to exist and be a real multi-size icon.
 */
describe('favicon.ico', () => {
  const file = readFileSync(join(import.meta.dir, 'favicon.ico'));

  test('is an ICO container (reserved 0, type 1)', () => {
    expect(file.readUInt16LE(0)).toBe(0);
    expect(file.readUInt16LE(2)).toBe(1);
  });

  test('holds the 16, 32 and 48 px images', () => {
    const count = file.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => file.readUInt8(6 + i * 16));

    expect(sizes).toEqual([16, 32, 48]);
  });
});
