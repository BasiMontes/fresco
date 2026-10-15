import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'bun:test';

/**
 * FRESCO-966 (audit UX-13, WCAG 2.4.2): every signed-in page used to fall
 * back to the root layout title, so all 12 browser tabs read the same. These
 * tests keep each `app/(app)` route on its own title: a route with no static
 * `metadata.title` (or a `generateMetadata` title) fails, and so do two
 * routes sharing one.
 */

const APP_GROUP_DIR = join(import.meta.dir, '..', 'app', '(app)');

function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { return pageFiles(path); }
    return entry.name === 'page.tsx' ? [path] : [];
  });
}

function titleOf(path: string): string | null {
  // Comments may mention a title; only code counts.
  const code = readFileSync(path, 'utf8')
    .split('\n')
    .filter(line => !/^\s*(?:\/\/|\*|\/\*)/.test(line))
    .join('\n');
  return /\btitle:\s*(['"`])(.+?)\1/.exec(code)?.[2] ?? null;
}

const routes = pageFiles(APP_GROUP_DIR).map(path => ({
  route: relative(APP_GROUP_DIR, path),
  title: titleOf(path),
}));

describe('app/(app) route titles', () => {
  test('finds the signed-in routes', () => {
    expect(routes.length).toBeGreaterThanOrEqual(10);
  });

  test('every route declares its own title', () => {
    const missing = routes.filter(r => !r.title).map(r => r.route);
    expect(missing).toEqual([]);
  });

  test('no two routes share a title', () => {
    const byTitle = new Map<string, string[]>();
    for (const { route, title } of routes) {
      if (title) { byTitle.set(title, [...(byTitle.get(title) ?? []), route]); }
    }
    const duplicates = [...byTitle].filter(([, rs]) => rs.length > 1);
    expect(duplicates).toEqual([]);
  });
});
