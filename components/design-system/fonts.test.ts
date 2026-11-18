import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { FONT_FAMILIES } from './fonts';

const DESIGN_MD = readFileSync(join(process.cwd(), 'DESIGN.md'), 'utf8');

describe('FONT_FAMILIES (FRESCO-1234)', () => {
  test('names the typefaces DESIGN.md declares, Young Serif for headlines and Figtree for the rest', () => {
    expect(FONT_FAMILIES.map(font => font.name)).toEqual(['Young Serif', 'Figtree']);
    for (const font of FONT_FAMILIES) {
      expect(DESIGN_MD).toContain(`fontFamily: ${font.name}`);
    }
  });

  test('never carries a CSS stack', () => {
    const text = JSON.stringify(FONT_FAMILIES);

    for (const forbidden of ['var(--', 'Georgia', 'Times New Roman', '-apple-system']) {
      expect(text).not.toContain(forbidden);
    }
  });
});
