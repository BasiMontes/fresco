import { describe, expect, test } from 'bun:test';

import { daysBetween, evaluate, guardPaths, isManual, MAX_AGE_DAYS, parseScenarios, summarize, verifiedDay } from './manual-scenarios';

/**
 * FRESCO-1289 (audit 11 F5): a `@verificado-manual` date older than 6 weeks is no longer a guarantee, and nothing
 * listed them. These helpers back `bun run qa:manual-stale`, which warns and never fails.
 */

const FEATURE = `# language: es
# Section header comment that belongs to no scenario.

@login @verificado-manual-2026-09-10 @solo-manual
# FRESCO-486: why it is manual.
# Cubierto por: \`lib/a.test.ts\`, lib/b.test.ts
Escenario: Guarded one
Dado que algo

@landing @solo-manual
# no date, no guard
Escenario: Undated one
Dado que algo

@suscripcion @automatizado @verificado-manual-2026-01-01
Escenario: Automated, exempt

@legal @verificado-manual-2026-11-20 @solo-manual
Escenario: Fresh one
Dado que algo

@pendiente
Escenario: A TODO, not manual
`;

const exists = (known: string[]) => (path: string) => known.includes(path);

describe('parseScenarios', () => {
  const scenarios = parseScenarios(FEATURE);

  test('finds every scenario with its line, tags and the comments under its tags', () => {
    expect(scenarios.map(s => s.name)).toEqual(['Guarded one', 'Undated one', 'Automated, exempt', 'Fresh one', 'A TODO, not manual']);
    expect(scenarios[0].tags).toEqual(['login', 'verificado-manual-2026-09-10', 'solo-manual']);
    expect(scenarios[0].comments).toEqual(['FRESCO-486: why it is manual.', 'Cubierto por: `lib/a.test.ts`, lib/b.test.ts']);
    expect(scenarios[0].line).toBe(7);
  });

  test('a section header comment before the tags is not a scenario comment', () => {
    expect(scenarios[0].comments.join(' ')).not.toContain('Section header');
  });
});

describe('verifiedDay and guardPaths', () => {
  test('verifiedDay takes the newest date and ignores other tags', () => {
    expect(verifiedDay(['login', 'verificado-manual-2026-08-19', 'verificado-manual-2026-10-01'])).toBe('2026-10-01');
    expect(verifiedDay(['solo-manual'])).toBeNull();
  });

  test('guardPaths reads `Cubierto por:` lines, strips backticks and trailing notes', () => {
    expect(guardPaths(['x', 'Cubierto por: `lib/a.test.ts`, lib/b.test.ts (el caso 404)'])).toEqual(['lib/a.test.ts', 'lib/b.test.ts']);
    expect(guardPaths(['nothing here'])).toEqual([]);
  });

  test('daysBetween counts whole days', () => {
    expect(daysBetween('2026-09-10', '2026-11-24')).toBe(75);
    expect(daysBetween('2026-11-24', '2026-11-24')).toBe(0);
  });
});

describe('evaluate', () => {
  const [guarded, undated, , fresh] = parseScenarios(FEATURE);
  const today = '2026-11-24';

  test('a guard that names existing files wins over an expired date', () => {
    expect(evaluate(guarded, today, exists(['lib/a.test.ts', 'lib/b.test.ts'])).status).toBe('guarded');
  });

  test('a guard that names a missing file is a broken guard, never a guarantee', () => {
    const result = evaluate(guarded, today, exists(['lib/a.test.ts']));
    expect(result.status).toBe('broken-guard');
    expect(result.missingGuards).toEqual(['lib/b.test.ts']);
  });

  test('without a guard the date decides: older than the limit is expired, recent is current', () => {
    const noGuard = { ...guarded, comments: [] };
    expect(evaluate(noGuard, today, exists([])).status).toBe('expired');
    expect(evaluate(fresh, today, exists([])).status).toBe('current');
  });

  test('exactly the limit is still current, one day more is expired', () => {
    const at = (days: number) => ({ ...fresh, tags: [`verificado-manual-${new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10)}`] });
    expect(evaluate(at(MAX_AGE_DAYS), today, exists([])).status).toBe('current');
    expect(evaluate(at(MAX_AGE_DAYS + 1), today, exists([])).status).toBe('expired');
  });

  test('no date and no guard is undated', () => {
    expect(evaluate(undated, today, exists([])).status).toBe('undated');
  });
});

describe('isManual and summarize', () => {
  const scenarios = parseScenarios(FEATURE);

  test('judges @solo-manual and dated scenarios, never @automatizado or a plain @pendiente', () => {
    expect(scenarios.filter(isManual).map(s => s.name)).toEqual(['Guarded one', 'Undated one', 'Fresh one']);
  });

  test('summarize counts each status', () => {
    const evaluations = scenarios.filter(isManual).map(s => evaluate(s, '2026-11-24', exists(['lib/a.test.ts', 'lib/b.test.ts'])));
    expect(summarize(evaluations)).toEqual({ 'guarded': 1, 'current': 1, 'expired': 0, 'undated': 1, 'broken-guard': 0 });
  });
});
