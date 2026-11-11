import { describe, expect, test } from 'bun:test';
import { renderWithProviders } from '@/tests/component-render';
import { MenuMark, PlusMark, ThemeMark } from './css-glyphs';

/**
 * FRESCO-1138 — marks drawn with CSS replace the Lucide icons of the landing. They are decorative: they
 * must stay hidden from assistive tech (the button that holds them carries the name) and must not
 * be SVGs.
 */
describe('css glyphs', () => {
  test('are decorative and are not SVG icons', () => {
    const { container } = renderWithProviders(
      <>
        <PlusMark />
        <MenuMark open={false} />
        <ThemeMark kind="light" />
      </>,
    );

    expect(container.querySelectorAll('svg')).toHaveLength(0);
    for (const mark of container.children) {
      expect(mark.getAttribute('aria-hidden')).toBe('true');
    }
  });

  test('the menu mark spreads its bars when closed and crosses them when open', () => {
    const closed = renderWithProviders(<MenuMark open={false} />).container;
    const open = renderWithProviders(<MenuMark open />).container;

    expect(closed.innerHTML).toContain('-translate-y-[6px]');
    expect(closed.innerHTML).toContain('translate-y-[6px]');
    expect(closed.innerHTML).not.toContain('rotate-45');
    expect(open.innerHTML).toContain('rotate-45');
    expect(open.innerHTML).toContain('-rotate-45');
    expect(open.innerHTML).toContain('opacity-0');
  });

  // FRESCO-1191: the ring and the dot were not read as a sun and a moon, so the marks are now
  // drawn as such: a disc with eight rays, and a crescent.
  test('the theme mark is a sun (disc and eight rays) for light and a crescent for dark', () => {
    const light = renderWithProviders(<ThemeMark kind="light" />).container;
    const dark = renderWithProviders(<ThemeMark kind="dark" />).container;

    expect(light.querySelectorAll('[data-ray]')).toHaveLength(4);
    expect(light.querySelector('[data-sun-disc]')).not.toBeNull();
    expect(light.querySelector('[data-moon]')).toBeNull();
    expect(dark.querySelector('[data-moon]')).not.toBeNull();
    expect(dark.querySelectorAll('[data-ray]')).toHaveLength(0);
    expect(light.querySelectorAll('svg')).toHaveLength(0);
    expect(dark.querySelectorAll('svg')).toHaveLength(0);
  });
});
