import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { COMPONENT_APIS } from './generated';
import { REGISTRY } from './registry';

// FRESCO-1207: every file in `components/ui` is documented in the design system or exempt with a reason.
// Freshness of the generated snapshot is covered by scripts/generate-design-system.test.ts.
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Files of `components/ui` that are not components, so they have no docs page. */
const EXEMPT: Record<string, string> = {
  'css-duration.ts': 'internal helper, not a component',
  'use-list-enter-animation.ts': 'hook, not a component',
};

// Recursive and any script extension, like the generator's own scan: a component in a folder or a `.jsx` file must not slip through.
const uiFiles = readdirSync(`${ROOT}components/ui`, { recursive: true, encoding: 'utf8' }).filter(file => /\.(?:tsx?|jsx?|mdx)$/.test(file) && !/\.test\./.test(file));
const entries = Object.entries(REGISTRY);
const sources = entries.map(([, entry]) => `${entry.source}.tsx`);

describe('design-system drift', () => {
  test('the scan sees the component folder, so a broken glob cannot pass vacuously', () => {
    expect(uiFiles.length).toBeGreaterThan(15);
  });

  test('every file in components/ui has a docs page or an exemption', () => {
    const missing = uiFiles.filter(file => !sources.includes(file) && !(file in EXEMPT));

    expect(missing).toEqual([]);
  });

  test('an exemption has a reason and is not also documented', () => {
    for (const [file, reason] of Object.entries(EXEMPT)) {
      expect(reason.trim()).not.toBe('');
      expect(sources).not.toContain(file);
    }
  });

  test('every registered source and every exemption exists on disk', () => {
    const gone = [...sources, ...Object.keys(EXEMPT)].filter(file => !existsSync(`${ROOT}components/ui/${file}`));

    expect(gone).toEqual([]);
  });

  test.each(entries)('%s has an example that imports its component and a non-empty API', (slug, entry) => {
    const examplePath = `${ROOT}components/design-system/examples/${slug}.example.tsx`;

    expect(existsSync(examplePath)).toBe(true);
    expect(readFileSync(examplePath, 'utf8')).toMatch(new RegExp(`import[^;]*from '@/components/ui/${entry.source}'`));
    const api = COMPONENT_APIS[slug as keyof typeof COMPONENT_APIS];

    expect(api.extends.length + api.props.length + api.variants.length).toBeGreaterThan(0);
  });
});
