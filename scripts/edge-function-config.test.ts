import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { deployArgs, evaluateFunctionSettings, readDeclaredVerifyJwt } from './lib/edge-function-config';

/**
 * FRESCO-1169 (integral review F2): `verify_jwt` of every Edge Function is declared in `supabase/config.toml`
 * and read from there. These tests pin the pieces: the parse, the deploy flag, the comparison with the live
 * project, and, against the repo itself, that every function dir has a declaration that agrees with the auth
 * helper its own code calls.
 */

const FUNCTIONS_DIR = 'supabase/functions';
const configToml = readFileSync('supabase/config.toml', 'utf8');
const declared = readDeclaredVerifyJwt(configToml);
const functionDirs = readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && entry.name !== '_shared' && readdirSync(`${FUNCTIONS_DIR}/${entry.name}`).includes('index.ts'))
  .map(entry => entry.name)
  .sort();

describe('readDeclaredVerifyJwt', () => {
  test('reads every [functions.<slug>] block, hyphens included', () => {
    expect(readDeclaredVerifyJwt('[functions.a-b]\nverify_jwt = true\n\n[functions.c]\nverify_jwt = false\n')).toEqual({ 'a-b': true, 'c': false });
  });

  test('a config with no functions blocks declares nothing', () => {
    expect(readDeclaredVerifyJwt('[api]\nport = 54321\n')).toEqual({});
  });

  test.each([
    ['a missing verify_jwt', '[functions.a]\nentrypoint = "x"\n'],
    ['a string', '[functions.a]\nverify_jwt = "false"\n'],
    ['a number', '[functions.a]\nverify_jwt = 0\n'],
  ])('%s is an error, never a silent default', (_name, toml) => {
    expect(() => readDeclaredVerifyJwt(toml)).toThrow('verify_jwt');
  });
});

describe('deployArgs', () => {
  const base = { slug: 'delete-account', projectRef: 'ref', importMap: 'supabase/functions/deno.json' };

  test('a function that requires a session gets no extra flag', () => {
    expect(deployArgs({ ...base, verifyJwt: true })).toEqual(['functions', 'deploy', 'delete-account', '--project-ref', 'ref', '--use-api', '--import-map', 'supabase/functions/deno.json']);
  });

  test('a function declared verify_jwt = false gets --no-verify-jwt, and only that one', () => {
    const args = deployArgs({ ...base, slug: 'retry-posthog-erasures', verifyJwt: false });

    expect(args.at(-1)).toBe('--no-verify-jwt');
    expect(args.filter(arg => arg === '--no-verify-jwt')).toHaveLength(1);
  });
});

describe('evaluateFunctionSettings', () => {
  const declaredHere = { a: true, b: false };
  const liveClean = [{ slug: 'a', verify_jwt: true }, { slug: 'b', verify_jwt: false }];

  test('a project that matches the declarations is clean', () => {
    expect(evaluateFunctionSettings(liveClean, declaredHere)).toEqual([]);
  });

  test('a live function that stopped requiring a session is a finding that names it and both values', () => {
    const findings = evaluateFunctionSettings([{ slug: 'a', verify_jwt: false }, liveClean[1]], declaredHere);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('function a');
    expect(findings[0]).toContain('is false');
    expect(findings[0]).toContain('declared true');
  });

  test('a cron function that started requiring a JWT is a finding too (the platform gate would reject its caller)', () => {
    const findings = evaluateFunctionSettings([liveClean[0], { slug: 'b', verify_jwt: true }], declaredHere);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('function b');
  });

  test('a declared function that is not deployed is a finding', () => {
    const findings = evaluateFunctionSettings([liveClean[0]], declaredHere);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('not deployed');
  });

  test('a deployed function with no declaration is a finding', () => {
    const findings = evaluateFunctionSettings([...liveClean, { slug: 'c', verify_jwt: true }], declaredHere);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('no [functions.c] block');
  });

  test.each([undefined, null, 'true'])('a live verify_jwt returned as %p fails closed', (value) => {
    const findings = evaluateFunctionSettings([{ slug: 'a', verify_jwt: value }, liveClean[1]], declaredHere);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('cannot be verified');
  });

  test.each([null, undefined, {}, 'x'])('a response that is not a list (%p) fails closed', (response) => {
    expect(evaluateFunctionSettings(response, declaredHere)).toHaveLength(1);
  });

  test('several drifts are all reported', () => {
    expect(evaluateFunctionSettings([{ slug: 'a', verify_jwt: false }, { slug: 'c', verify_jwt: true }], declaredHere)).toHaveLength(3);
  });
});

describe('supabase/config.toml against the repo (FRESCO-1169)', () => {
  test('there are function directories to check (the read did not silently match nothing)', () => {
    expect(functionDirs.length).toBeGreaterThanOrEqual(9);
  });

  test('every function directory declares verify_jwt, and nothing declared lacks a directory', () => {
    expect(Object.keys(declared).sort()).toEqual(functionDirs);
  });

  test.each(functionDirs)('%s: the declaration agrees with the auth helper its code calls', (slug) => {
    const source = readFileSync(`${FUNCTIONS_DIR}/${slug}/index.ts`, 'utf8');
    const callsUserAuth = source.includes('requireAuthenticatedUser(');
    const callsServiceAuth = source.includes('requireServiceRoleCaller(');

    // Exactly one of the two: a function that checks neither would be open whatever verify_jwt says.
    expect(callsUserAuth !== callsServiceAuth).toBe(true);
    // A user-facing function behind the platform gate; a cron one cannot be (its caller sends a non-JWT key).
    expect(declared[slug]).toBe(callsUserAuth);
  });
});
