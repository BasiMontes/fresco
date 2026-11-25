import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

/**
 * regression.feature, "La página /qa no se autocontradice sobre la arquitectura de generación".
 * The page renders an async Shiki `CodeBlock`, so this reads the source copy (same style as
 * `components/landing/landing-claims.test.ts`): the header and the "Arquitectura" paragraph must
 * describe the same mechanism, and neither may claim an AI-assisted generation.
 */

const source = readFileSync('app/qa/page.tsx', 'utf8').replace(/\s+/g, ' ');

function between(start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe('/qa page generation copy', () => {
  const header = between('<header>', '</header>');
  const architecture = between('id="qa-architecture-heading"', '<CodeBlock');

  test('the header and the Arquitectura paragraph both say the menu generation is 100% deterministic', () => {
    expect(header).toMatch(/100% determinista/);
    expect(architecture).toMatch(/100% deterministas/);
  });

  test('neither the header nor the Arquitectura paragraph claims an AI-assisted generation', () => {
    for (const copy of [header, architecture]) {
      expect(copy).not.toMatch(/asistid[ao] por IA|con IA|generaci[oó]n .*\bIA\b/i);
    }
    expect(architecture).toContain('sin llamadas a modelos de IA');
    expect(source).not.toMatch(/asistid[ao] por IA|con IA/i);
  });
});
