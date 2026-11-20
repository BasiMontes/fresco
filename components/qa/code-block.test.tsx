import type { ReactElement } from 'react';
import { describe, expect, test } from 'bun:test';
import { CodeBlock } from './code-block';

/**
 * FRESCO-1215 — the code must carry BOTH theme colours as CSS variables on every token, because the rule in
 * `app/globals.css` picks one with `light-dark(var(--shiki-light), var(--shiki-dark))`. With Shiki's
 * `defaultColor: 'light'` the light colour was an inline `color` and `--shiki-light` was never defined, so the
 * light theme lost its syntax highlighting.
 */
function highlightedHtml(element: ReactElement<{ children: unknown[] }>): string {
  const wrapper = element.props.children[1] as ReactElement<{ html: string }>;
  return wrapper.props.html;
}

describe('CodeBlock', () => {
  test('every token defines both --shiki-light and --shiki-dark', async () => {
    const html = highlightedHtml(await CodeBlock({ code: 'const total = 1;', lang: 'ts' }) as ReactElement<{ children: unknown[] }>);
    const tokens = html.match(/<span style="[^"]*"/g) ?? [];

    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(token).toContain('--shiki-light:');
      expect(token).toContain('--shiki-dark:');
    }
  });

  test('no token carries an inline colour that would bypass the light-dark() rule', async () => {
    const html = highlightedHtml(await CodeBlock({ code: 'const total = 1;', lang: 'ts' }) as ReactElement<{ children: unknown[] }>);

    expect(html).not.toMatch(/<span style="color:/);
  });
});
