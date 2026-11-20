import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

/**
 * FRESCO-1212 — code blocks (`components/qa/code-block.tsx`, `/qa` and `/design-system`) must take their palette
 * from the app's resolved `color-scheme`, not from the OS. The app defaults a first visit to `data-theme="light"`
 * whatever the OS says, so a `prefers-color-scheme` rule on `.shiki` paints near-white code on a cream page.
 */
const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');

/** The rule blocks that style `.shiki`, with the `@media` wrappers they sit in. */
function shikiRules(): string[] {
  const rules: string[] = [];
  for (const match of css.matchAll(/([^{}]*\.shiki[^{}]*)\{([^{}]*)\}/g)) {
    rules.push(`${match[1]}{${match[2]}}`);
  }
  return rules;
}

/** The bodies of every `@media (...<query>...) { ... }`, found by brace depth so nested rules stay inside. */
function mediaBlocks(query: string): string[] {
  const blocks: string[] = [];
  for (const match of css.matchAll(new RegExp(`@media[^{]*${query}[^{]*\\{`, 'g'))) {
    const start = match.index + match[0].length;
    let depth = 1;
    let end = start;
    while (depth > 0 && end < css.length) {
      depth += css[end] === '{' ? 1 : css[end] === '}' ? -1 : 0;
      end++;
    }
    blocks.push(css.slice(start, end));
  }
  return blocks;
}

describe('shiki code block theme', () => {
  test('styles `.shiki` somewhere, so the checks below cannot pass on an empty match', () => {
    expect(shikiRules().length).toBeGreaterThan(0);
  });

  test('no `.shiki` rule sits inside a `prefers-color-scheme` media query', () => {
    expect(mediaBlocks('prefers-color-scheme').filter(block => block.includes('.shiki'))).toEqual([]);
  });

  test('the text colour is picked with light-dark(), driven by the app color-scheme', () => {
    const rule = shikiRules().join('\n');

    expect(rule).toMatch(/color:\s*light-dark\(var\(--shiki-light\),\s*var\(--shiki-dark\)\)/);
  });

  test('no `.shiki` rule paints a background: the block keeps the one of its container (FRESCO-1213)', () => {
    expect(shikiRules().filter(rule => /background(?:-color)?:/.test(rule))).toEqual([]);
  });
});
