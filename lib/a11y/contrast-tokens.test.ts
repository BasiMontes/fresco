import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

/**
 * FRESCO-1013 (A7-UI-11) — a ticked shopping item is `text-tertiary line-through`. The strike carries the state;
 * the text must stay readable (WCAG 1.4.3 has no exemption for "done"), in the light AND the dark theme. Reads
 * the real tokens from `app/globals.css` (`light-dark(<light>, <dark>)`) and checks the contrast against the
 * surfaces the list sits on.
 */
const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');

function token(name: string): { light: string, dark: string } {
  const match = new RegExp(`--raw-color-${name}:\\s*light-dark\\((#[0-9a-fA-F]{6}),\\s*(#[0-9a-fA-F]{6})\\)`).exec(css);
  if (!match) { throw new Error(`token ${name} not found as light-dark(...) in globals.css`); }
  return { light: match[1], dark: match[2] };
}

function luminance(hex: string): number {
  const channel = (index: number) => {
    const value = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('tertiary text contrast (ticked shopping items)', () => {
  const tertiary = token('tertiary');

  test.each(['background', 'surface', 'surface-raised'])('on %s it reaches 4.5:1 in the light theme and in the dark theme', (surface) => {
    const bg = token(surface);

    expect(contrast(tertiary.light, bg.light)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tertiary.dark, bg.dark)).toBeGreaterThanOrEqual(4.5);
  });

  test('the audit\'s measured pair, with the opacity, was under the line (so removing opacity is the fix)', () => {
    // #998c76 on #fbf6ec = the light tertiary at 70 % opacity, as measured by axe: 3.06.
    expect(contrast('#998c76', '#fbf6ec')).toBeLessThan(4.5);
  });
});
