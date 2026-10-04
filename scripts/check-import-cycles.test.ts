import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'bun:test';
import { buildGraph, findCycles } from './check-import-cycles';

/**
 * FRESCO-788 — the cycle guard. `findCycles` is the graph algorithm; `buildGraph`
 * is checked against a throwaway project so the `@/` alias, relative imports and
 * `import type` resolve the way `tsc` resolves them.
 */

const graph = (edges: Record<string, string[]>) => new Map(Object.entries(edges));

describe('findCycles', () => {
  test('no cycle in a DAG, a diamond or a chain', () => {
    expect(findCycles(graph({ a: ['b', 'c'], b: ['d'], c: ['d'], d: [] }))).toEqual([]);
    expect(findCycles(graph({ a: ['b'], b: ['c'], c: [] }))).toEqual([]);
  });

  test('a two-file cycle', () => {
    expect(findCycles(graph({ a: ['b'], b: ['a'] }))).toEqual([['a', 'b']]);
  });

  test('a longer cycle, reported once, sorted', () => {
    expect(findCycles(graph({ a: ['b'], b: ['c'], c: ['a'], d: ['a'] }))).toEqual([['a', 'b', 'c']]);
  });

  test('a file importing itself', () => {
    expect(findCycles(graph({ a: ['a'], b: [] }))).toEqual([['a']]);
  });

  test('two disjoint cycles are both reported', () => {
    expect(findCycles(graph({ a: ['b'], b: ['a'], x: ['y'], y: ['x'] }))).toEqual([['a', 'b'], ['x', 'y']]);
  });

  test('a cycle reached from outside it is still found, and the entry file is not part of it', () => {
    expect(findCycles(graph({ entry: ['a'], a: ['b'], b: ['a'] }))).toEqual([['a', 'b']]);
  });
});

describe('buildGraph on a throwaway project', () => {
  const root = mkdtempSync(join(tmpdir(), 'fresco-cycles-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  function write(path: string, content: string) {
    const full = join(root, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }

  write('tsconfig.json', JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'bundler', baseUrl: '.', paths: { '@/*': ['./*'] } } }));
  write('lib/a.ts', 'import { b } from \'@/lib/b\';\nexport const a = () => b;\n');
  write('lib/b.ts', 'import type { A } from \'./c\';\nexport const b = 1 as unknown as A;\n');
  write('lib/c.ts', 'import { a } from \'@/lib/a\';\nexport type A = typeof a;\n');
  write('lib/clean.ts', 'import { b } from \'@/lib/b\';\nexport const clean = b;\n');
  write('lib/clean.test.ts', 'import { a } from \'@/lib/a\';\nexport const t = a;\n');

  test('resolves the @/ alias and relative imports, and counts type-only imports', () => {
    const g = buildGraph({ projectRoot: root, roots: ['lib'] });

    expect(g.get('lib/a.ts')).toEqual(['lib/b.ts']);
    expect(g.get('lib/b.ts')).toEqual(['lib/c.ts']);
    expect(findCycles(g)).toEqual([['lib/a.ts', 'lib/b.ts', 'lib/c.ts']]);
  });

  test('test files are not scanned as sources', () => {
    const g = buildGraph({ projectRoot: root, roots: ['lib'] });

    expect(g.has('lib/clean.test.ts')).toBe(false);
  });
});
