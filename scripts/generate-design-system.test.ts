import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import * as lucide from 'lucide-react';
import { parse } from 'yaml';
import {
  buildSnapshot,
  extractTheme,
  parseColors,
  parseGlyphs,
  parseIconImports,
  parseTypography,
  renderGalleryModule,
  renderSnapshotModule,
} from './generate-design-system.ts';

// FRESCO-1207: the design-system docs read a committed snapshot of the real tokens and icons. These tests pin
// the parsers on small inputs and fail when the committed snapshot drifts from the sources.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string) => readFileSync(`${ROOT}${path}`, 'utf8');

describe('parseColors', () => {
  test('reads light-dark pairs, single values and multi-line values, in file order', () => {
    const css = `:root {
      --raw-color-a: light-dark(#111111, #222222);
      --raw-color-b: #333333;
      --raw-color-c: light-dark(
        color-mix(in srgb, #000 10%, transparent),
        color-mix(in srgb, #fff 20%, transparent)
      );
    }`;

    expect(parseColors(css)).toEqual([
      { name: 'a', light: '#111111', dark: '#222222' },
      { name: 'b', light: '#333333', dark: '#333333' },
      { name: 'c', light: 'color-mix(in srgb, #000 10%, transparent)', dark: 'color-mix(in srgb, #fff 20%, transparent)' },
    ]);
  });

  test('keeps the first declaration of a token (later subtrees redeclare it)', () => {
    const css = '--raw-color-a: light-dark(#111111, #222222);\n[x] { --raw-color-a: #999999; }';

    expect(parseColors(css)).toEqual([{ name: 'a', light: '#111111', dark: '#222222' }]);
  });
});

describe('extractTheme', () => {
  test('returns only the body of the @theme block, nested braces included', () => {
    const css = '@import "x";\n@theme static {\n  --text-h1: 44px;\n  --a: { b };\n}\n:root { --text-swap-dur: 1s; }';

    expect(extractTheme(css)).toContain('--text-h1: 44px;');
    expect(extractTheme(css)).not.toContain('swap');
  });

  test('throws without a @theme block', () => {
    expect(() => extractTheme(':root { --a: 1; }')).toThrow('@theme');
  });
});

describe('parseTypography', () => {
  test('names the missing font stack', () => {
    expect(() => parseTypography('--font-sans: x;')).toThrow('--font-heading');
  });

  test('reads each step with its metrics and the font stacks', () => {
    const css = `--font-heading: var(--x), serif;
      --font-sans: var(--y), sans-serif;
      --text-h1: 44px;
      --text-h1--line-height: 1.04;
      --text-h1--letter-spacing: -0.025em;
      --text-h1--font-weight: 400;
      --text-caption: 12px;
      --text-caption--line-height: 1.3;
      --text-caption--font-weight: 400;`;

    expect(parseTypography(css)).toEqual({
      fonts: { heading: 'var(--x), serif', sans: 'var(--y), sans-serif' },
      steps: [
        { step: 'h1', size: '44px', lineHeight: '1.04', letterSpacing: '-0.025em', fontWeight: '400' },
        { step: 'caption', size: '12px', lineHeight: '1.3', letterSpacing: null, fontWeight: '400' },
      ],
    });
  });
});

describe('parseIconImports', () => {
  test('handles double quotes, default plus named, re-exports and type-only declarations', () => {
    const source = `import Default, { Plus } from "lucide-react";
      import type { Hidden } from 'lucide-react';
      import * as All from 'lucide-react';
      export { Check as Tick, type Skip } from 'lucide-react';
      export type { AlsoHidden } from 'lucide-react';
      export { Elsewhere } from 'other';`;

    expect(parseIconImports(source)).toEqual(['Plus', 'Check']);
  });

  test('collects the original names of lucide imports, ignoring types and aliases', () => {
    const source = `import { Plus, X as Close, type LucideIcon } from 'lucide-react';
      import {
        Check,
        Clock,
      } from 'lucide-react';
      import { Other } from 'somewhere-else';`;

    expect(parseIconImports(source)).toEqual(['Plus', 'X', 'Check', 'Clock']);
  });
});

describe('parseGlyphs', () => {
  test('lists the exported glyph components', () => {
    expect(parseGlyphs('export function PlusMark() {}\nfunction hidden() {}\nexport function MenuMark() {}')).toEqual([
      'PlusMark',
      'MenuMark',
    ]);
  });
});

describe('committed snapshot', () => {
  const snapshot = buildSnapshot(ROOT);

  test('components/design-system/generated.ts is up to date (run `bun run design-system:generate`)', () => {
    expect(read('components/design-system/generated.ts')).toEqual(renderSnapshotModule(snapshot));
  });

  test('components/design-system/icon-gallery.generated.tsx is up to date', () => {
    expect(read('components/design-system/icon-gallery.generated.tsx')).toEqual(renderGalleryModule(snapshot.icons));
  });

  test('has real content', () => {
    const primary = snapshot.colors.find(color => color.name === 'primary');

    expect(snapshot.colors.length).toBeGreaterThan(15);
    expect(primary?.light).not.toEqual(primary?.dark);
    expect(snapshot.icons.length).toBeGreaterThan(20);
    expect(snapshot.glyphs).toEqual(['PlusMark', 'MenuMark', 'ThemeMark']);
    expect(snapshot.typography.steps.map(step => step.step)).toContain('h1');
  });

  test('every icon name is a real lucide-react export', () => {
    for (const name of snapshot.icons) {
      expect(name in lucide).toBe(true);
    }
  });

  test('every DESIGN.md color exists among the parsed tokens', () => {
    const frontmatter = /^---\n([\s\S]*?)\n---/.exec(read('DESIGN.md'))?.[1] ?? '';
    const documented = Object.keys((parse(frontmatter) as { colors: Record<string, string> }).colors);
    const parsed = new Set(snapshot.colors.map(color => color.name));

    expect(documented.filter(name => !parsed.has(name))).toEqual([]);
  });

  test('every color has a --color alias and every type step a --text token inside @theme', () => {
    const theme = extractTheme(read('app/globals.css'));

    expect(snapshot.colors.filter(color => !theme.includes(`--color-${color.name}:`)).map(color => color.name)).toEqual([]);
    expect(snapshot.typography.steps.filter(({ step }) => !theme.includes(`--text-${step}:`)).map(({ step }) => step)).toEqual([]);
    expect(snapshot.typography.steps.filter(({ step }) => step.startsWith('swap-')).length).toBe(0);
  });

  test('every icon is named in a non-test source that imports lucide-react (independent of the parser)', () => {
    const sources = ['app', 'components', 'lib']
      .flatMap(dir => readdirSync(`${ROOT}${dir}`, { recursive: true, encoding: 'utf8' }).map(path => `${dir}/${path}`))
      .filter(path => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !path.endsWith('generated.ts') && !path.endsWith('icon-gallery.generated.tsx'))
      .map(read)
      .filter(source => source.includes('lucide-react'));
    const missing = snapshot.icons.filter(name => !sources.some(source => new RegExp(`\\b${name}\\b`).test(source)));

    expect(missing).toEqual([]);
  });
});
