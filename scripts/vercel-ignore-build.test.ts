import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

/**
 * FRESCO-804 — the Vercel ignored-build-step script. Exit 0 = skip, 1 = build.
 * Runs the real shell script against a throwaway git repo so the pathspec
 * semantics (the delicate part) are exercised, not mocked.
 */

const SCRIPT = resolve(import.meta.dir, 'vercel-ignore-build.sh');

let repo: string;

function git(...args: string[]): string {
  const result = Bun.spawnSync(['git', ...args], { cwd: repo });
  return new TextDecoder().decode(result.stdout).trim();
}

function commit(files: Record<string, string>): string {
  for (const [path, content] of Object.entries(files)) {
    const full = join(repo, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  git('add', '-A');
  git('commit', '-q', '-m', 'c');
  return git('rev-parse', 'HEAD');
}

function run(env: Record<string, string>): number {
  const result = Bun.spawnSync(['sh', SCRIPT], { cwd: repo, env: { PATH: process.env.PATH ?? '', ...env } });
  return result.exitCode;
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'ignore-build-'));
  git('init', '-q');
  git('config', 'user.email', 't@t.t');
  git('config', 'user.name', 't');
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('vercel-ignore-build.sh (FRESCO-804)', () => {
  test('skips (exit 0) when only docs, tests, CI and context changed', () => {
    const base = commit({ 'app/page.tsx': 'a' });
    commit({
      '.context/bitacora.md': 'x',
      'docs/guide.md': 'x',
      'tests/e2e.ts': 'x',
      '.github/workflows/ci.yml': 'x',
      'lib/thing.test.ts': 'x',
      'README.md': 'x',
    });

    expect(run({ VERCEL_GIT_PREVIOUS_SHA: base })).toBe(0);
  });

  test('builds (exit 1) when app code changed', () => {
    const base = commit({ 'app/page.tsx': 'a' });
    commit({ 'app/page.tsx': 'b' });

    expect(run({ VERCEL_GIT_PREVIOUS_SHA: base })).toBe(1);
  });

  test('builds when a code commit is followed by a docs-only commit (diff is against the last deploy, not HEAD^)', () => {
    const base = commit({ 'app/page.tsx': 'a' });
    commit({ 'lib/price.ts': 'code' });
    commit({ '.context/bitacora.md': 'docs' });

    expect(run({ VERCEL_GIT_PREVIOUS_SHA: base })).toBe(1);
  });

  test('builds when a file in a brand-new top-level directory changed (ignore-list, not allow-list)', () => {
    const base = commit({ 'app/page.tsx': 'a' });
    commit({ 'newdir/thing.ts': 'x' });

    expect(run({ VERCEL_GIT_PREVIOUS_SHA: base })).toBe(1);
  });

  test('builds when the previous SHA is missing (first deploy of a branch)', () => {
    commit({ 'app/page.tsx': 'a' });

    expect(run({})).toBe(1);
  });

  test('builds when the previous SHA is not in the clone (shallow clone)', () => {
    commit({ 'app/page.tsx': 'a' });

    expect(run({ VERCEL_GIT_PREVIOUS_SHA: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' })).toBe(1);
  });

  test('only root-level markdown is ignorable: a .md nested in app/ could be imported into the bundle, so it builds', () => {
    const base = commit({ 'app/page.tsx': 'a' });
    commit({ 'README.md': 'x' });
    expect(run({ VERCEL_GIT_PREVIOUS_SHA: base })).toBe(0);

    commit({ 'app/notes.md': 'x' });
    expect(run({ VERCEL_GIT_PREVIOUS_SHA: base })).toBe(1);
  });
});
