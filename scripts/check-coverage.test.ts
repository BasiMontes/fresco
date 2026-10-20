import { describe, expect, test } from 'bun:test';
import { figuresOf, FLOOR, floorViolations, HONEST_FLOOR_LINES, parseLcov, summaryMarkdown } from './check-coverage';

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

describe('summaryMarkdown', () => {
  test('shows the honest figure first, with its value and its floor, and the loaded figures after', () => {
    const text = summaryMarkdown({ functions: 90, lines: 91.5, honestLines: 63.35 }, 140);

    expect(text.indexOf('cobertura honesta')).toBeLessThan(text.indexOf('Loaded lines'));
    expect(text).toContain(`63.35 % | ${HONEST_FLOOR_LINES.toFixed(2)} %`);
    expect(text).toContain('140 files no test imports');
  });
});
