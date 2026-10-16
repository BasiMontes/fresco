import { describe, expect, test } from 'bun:test';
import { cn, formatCantidad, formatImporte, formatPrecio, THEME_FONT_SIZES } from './utils';

describe('formatImporte / formatPrecio (FRESCO-819)', () => {
  test('two decimals with a comma, symbol glued after the figure', () => {
    expect(formatImporte(3.5)).toBe('3,50');
    expect(formatPrecio(3.5)).toBe('3,50€');
    expect(formatPrecio(4.99)).toBe('4,99€');
    expect(formatPrecio(0)).toBe('0,00€');
  });

  test('groups thousands from five digits, like es-ES', () => {
    expect(formatPrecio(12345.5)).toBe('12.345,50€');
  });
});

describe('formatCantidad (FRESCO-819)', () => {
  test('decimal comma, no trailing zeros, at most two decimals', () => {
    expect(formatCantidad(1.6)).toBe('1,6');
    expect(formatCantidad(2)).toBe('2');
    expect(formatCantidad(0.25)).toBe('0,25');
    expect(formatCantidad(0.333333)).toBe('0,33');
  });
});

describe('cn keeps the theme font sizes (FRESCO-982)', () => {
  // The sizes declared as --text-* in app/globals.css. tailwind-merge does not
  // know them, so without config it reads them as text colours and drops one.
  const sizes = THEME_FONT_SIZES;

  test.each(sizes)('text-%s survives next to a text colour', (size) => {
    expect(cn(`text-${size}`, 'text-tertiary')).toBe(`text-${size} text-tertiary`);
  });

  test('a colour that comes before the size is kept too', () => {
    expect(cn('text-tertiary', 'text-caption')).toBe('text-tertiary text-caption');
  });

  test('a later size still overrides an earlier one', () => {
    expect(cn('text-body-sm', 'text-label')).toBe('text-label');
    expect(cn('text-label', 'text-base')).toBe('text-base');
  });

  test('the theme sizes in globals.css are all declared here', async () => {
    const css = await Bun.file(`${import.meta.dir}/../app/globals.css`).text();
    // A font size is a --text-<name> that also declares --text-<name>--line-height.
    const declared = [...new Set([...css.matchAll(/^\s*--text-([a-z0-9-]+)--line-height:/gm)].map(m => m[1]))];
    expect(declared.sort()).toEqual([...sizes].sort());
  });
});
