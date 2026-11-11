import { readFileSync } from 'node:fs';
import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';

/**
 * FRESCO-1189 (integral review): the interface is written in Spanish from Spain, tú, never Latin American or
 * voseo (the owner's standing rule; FRESCO-372 fixed the first rioplatense strings). "Ingrésalo" and "Ingresa su
 * contraseña" survived in the sign-up screens because nothing watched for them: "ingresar" in the sense of
 * "enter" is Latin American ("Introdúcelo" in Spain).
 *
 * This reads the shipped source (never the tests, which may quote a banned word on purpose) and fails on the
 * unambiguous cases. It is deliberately short: add a word only when it is wrong in every context of this app.
 */

const SOURCE_GLOBS = ['components/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'supabase/functions/**/*.ts', 'supabase/templates/*.html'];

/** word -> what to write instead. Whole words, any case. */
const BANNED: ReadonlyArray<[RegExp, string]> = [
  [/\b(ingresa|ingrésalo|ingresar|ingresá|ingrese|ingresen)\b/i, '"introduce" / "introdúcelo" (Spain), or "entra" for signing in'],
  [/\b(tenés|podés|querés|sabés|hacé|elegí|mirá|andá|fijate)\b/i, 'the tú form ("tienes", "puedes", "quieres", "sabes", "haz", "elige", "mira")'],
];

function sourceFiles(): string[] {
  return SOURCE_GLOBS.flatMap(pattern => [...new Glob(pattern).scanSync('.')])
    .filter(file => !/\.test\.|\.spec\.|__snapshots__|node_modules/.test(file));
}

describe('the interface copy is Spanish from Spain (FRESCO-1189)', () => {
  const files = sourceFiles();

  test('there are source files to read (the glob did not silently match nothing)', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  test.each(BANNED)('no source file contains %s', (pattern, instead) => {
    const hits = files.flatMap(file => readFileSync(file, 'utf8').split('\n').map((line, index) => ({ file, line: index + 1, text: line.trim() })).filter(({ text }) => pattern.test(text)));

    expect(hits.map(({ file, line, text }) => `${file}:${line}: ${text.slice(0, 100)} (use ${instead})`)).toEqual([]);
  });

  test('the two strings the review found now read as Spain Spanish', () => {
    expect(readFileSync('components/signup/signup-otp-step.tsx', 'utf8')).toContain('Introdúcelo para confirmar tu cuenta.');
    expect(readFileSync('components/signup/signup-email-conflict.tsx', 'utf8')).toContain('Introduce la contraseña de esa cuenta');
  });
});
