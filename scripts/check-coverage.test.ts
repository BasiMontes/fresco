import { describe, expect, test } from 'bun:test';
import { figuresOf, FLOOR, floorViolations, HONEST_FLOOR_LINES, isTestSupport, isTypeOnly, parseLcov, ROOT_SOURCE_FILES, summaryMarkdown } from './check-coverage';

/**
 * FRESCO-990 (audit 7b A7-TEST-07): the CI gate fails on the HONEST figure, the one that counts files no test
 * imports as zero, so dropping an import cannot buy coverage. These tests pin that behaviour.
 */

const record = (path: string, found: number, hit: number) => `SF:${path}\nFNF:1\nFNH:1\nLF:${found}\nLH:${hit}\nend_of_record\n`;

describe('dropping a test import', () => {
  const covered = record('lib/a.ts', 100, 100) + record('lib/b.ts', 100, 0);
  const bDropped = record('lib/a.ts', 100, 100);

  test('raises the loaded figure but never the honest one', () => {
    const before = figuresOf(parseLcov(covered), 0);
    // lib/b.ts is no longer imported by any test: lcov forgets it and the script counts its 100 lines as unloaded.
    const after = figuresOf(parseLcov(bDropped), 100);

    expect(after.lines).toBeGreaterThan(before.lines);
    expect(after.honestLines).toBe(before.honestLines);
  });

  test('dropping the import of a well covered file lowers the honest figure', () => {
    const before = figuresOf(parseLcov(record('lib/a.ts', 100, 100) + record('lib/b.ts', 100, 50)), 0);
    const after = figuresOf(parseLcov(record('lib/b.ts', 100, 50)), 100);

    expect(after.honestLines).toBeLessThan(before.honestLines);
  });
});

describe('floorViolations', () => {
  const holding = { functions: FLOOR.functions, lines: FLOOR.lines, honestLines: HONEST_FLOOR_LINES };

  test('passes at exactly the floors', () => {
    expect(floorViolations(holding)).toEqual([]);
  });

  test('fails on the honest figure alone, even with the loaded figures sky high', () => {
    const violations = floorViolations({ functions: 99, lines: 99, honestLines: HONEST_FLOOR_LINES - 0.01 });

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('honest lines');
  });

  test('names every floor that breaks', () => {
    expect(floorViolations({ functions: 0, lines: 0, honestLines: 0 })).toHaveLength(3);
  });
});

describe('parseLcov', () => {
  test('ignores tests/, scripts/ and cli/ files', () => {
    const totals = parseLcov(record('tests/x.ts', 50, 50) + record('scripts/y.ts', 50, 50) + record('cli/z.ts', 50, 50) + record('lib/a.ts', 10, 5));

    expect(totals.lineFound).toBe(10);
    expect([...totals.loaded]).toEqual(['lib/a.ts']);
  });
});

describe('lines no test could ever hit stay out of the denominator (FRESCO-1080)', () => {
  test('isTypeOnly: interfaces, type aliases and type imports only', () => {
    expect(isTypeOnly('import type { A } from \'./a\';\n\n/** Doc. */\nexport interface B { a: A }\nexport type C = B | null;\n// note\n')).toBe(true);
    expect(isTypeOnly('')).toBe(true);
  });

  test('isTypeOnly: any runtime declaration makes the file count, whatever its name', () => {
    expect(isTypeOnly('export interface A { a: 1 }\nexport const LIMIT = 10;\n')).toBe(false);
    expect(isTypeOnly('export function f(): void {}\n')).toBe(false);
    expect(isTypeOnly('export async function f(): Promise<void> {}\n')).toBe(false);
    expect(isTypeOnly('export class A {}\n')).toBe(false);
    expect(isTypeOnly('export enum E { A }\n')).toBe(false);
    expect(isTypeOnly('const x = 1;\nexport type X = typeof x;\n')).toBe(false);
    expect(isTypeOnly('export default 1;\n')).toBe(false);
    expect(isTypeOnly('export { a } from \'./a\';\n')).toBe(false);
    expect(isTypeOnly('export * from \'./a\';\n')).toBe(false);
  });

  test('isTypeOnly: code that only appears in a comment does not count', () => {
    expect(isTypeOnly('/* export const A = 1; */\n// export function f() {}\nexport type T = string;\n')).toBe(true);
  });

  test('isTestSupport: fixture folders and fixture files, nothing else', () => {
    for (const path of ['components/__fixtures__/page-shells.tsx', 'lib/fixtures/mock-supabase-client.ts', 'supabase/functions/_shared/push-endpoint.fixtures.ts', 'supabase/functions/generate-shopping-list/catalog-units.fixture.ts']) {
      expect(isTestSupport(path)).toBe(true);
    }
    for (const path of ['lib/fixtures-loader.ts', 'components/menu/menu-view.tsx', 'lib/api/fixture.ts.bak']) {
      expect(isTestSupport(path)).toBe(false);
    }
  });

  test('parseLcov leaves test support out of the loaded figures too', () => {
    const totals = parseLcov(record('lib/fixtures/mock.ts', 50, 50) + record('components/__fixtures__/x.tsx', 50, 50) + record('lib/a.ts', 10, 5));

    expect(totals.lineFound).toBe(10);
    expect([...totals.loaded]).toEqual(['lib/a.ts']);
  });
});

describe('summaryMarkdown', () => {
  test('shows the honest figure first, with its value and its floor, and the loaded figures after', () => {
    const text = summaryMarkdown({ functions: 90, lines: 91.5, honestLines: 63.35 }, 140);

    expect(text.indexOf('cobertura honesta')).toBeLessThan(text.indexOf('Loaded lines'));
    expect(text).toContain(`63.35 % | ${HONEST_FLOOR_LINES.toFixed(2)} %`);
    expect(text).toContain('140 files no test imports');
  });
});

describe('root-level source files (A8-TEST-05)', () => {
  test('proxy.ts and the instrumentation and sentry entry points are in the honest denominator', () => {
    expect(ROOT_SOURCE_FILES).toEqual(expect.arrayContaining(['proxy.ts', 'instrumentation.ts', 'instrumentation-client.ts']));
  });

  test('every listed root file exists, so a rename cannot silently shrink the denominator', async () => {
    for (const file of ROOT_SOURCE_FILES) {
      expect(await Bun.file(file).exists(), file).toBe(true);
    }
  });
});
