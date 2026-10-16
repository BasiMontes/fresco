import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { Tag } from './tag';

/**
 * FRESCO-978 — `Tag` rendered at 16px instead of the token it declared:
 * `cn()` (a plain `twMerge`) dropped `text-caption` because a colour class
 * followed it. The size is now the `body-sm` token (13px) as arbitrary values,
 * which survive the merge, and every variant must keep both its size and colour.
 */

const VARIANTS = ['neutral', 'accent', 'allergen', 'selected', 'outline'] as const;

describe('Tag', () => {
  for (const variant of VARIANTS) {
    test(`${variant} keeps the 13px body-sm size next to its colour classes`, () => {
      renderWithProviders(<Tag variant={variant} data-testid="tag">Vegetariano</Tag>);

      const tag = screen.getByTestId('tag');

      expect(tag).toHaveClass('text-[length:var(--text-body-sm)]');
      expect(tag).toHaveClass('leading-[var(--text-body-sm--line-height)]');
      // The variant's own `text-*` colour must still be there beside the size.
      expect(tag.className).toMatch(/\btext-(tertiary|accent-2-800|on-brand|primary)\b/);
    });
  }

  test('does not fall back to the caption token that cn() used to drop', () => {
    renderWithProviders(<Tag data-testid="tag">Vegano</Tag>);

    expect(screen.getByTestId('tag')).not.toHaveClass('text-caption');
  });

  test('a caller class is merged in without losing the size', () => {
    renderWithProviders(<Tag data-testid="tag" className="mt-1">Vegano</Tag>);

    const tag = screen.getByTestId('tag');

    expect(tag).toHaveClass('mt-1');
    expect(tag).toHaveClass('text-[length:var(--text-body-sm)]');
  });
});
