import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

/**
 * FRESCO-828 — the pre-commit identity check. Runs the real shell script in a
 * throwaway git repo with an isolated HOME, so neither the developer's global
 * config nor the repo's own `.git/config` leaks into the result.
 */

const SCRIPT = resolve(import.meta.dir, 'check-git-identity.sh');

let repo: string;

function run(env: Record<string, string>): { code: number, out: string } {
  const result = Bun.spawnSync(['sh', SCRIPT], {
    cwd: repo,
    env: { PATH: process.env.PATH ?? '', HOME: repo, GIT_CONFIG_NOSYSTEM: '1', ...env },
  });
  return { code: result.exitCode, out: new TextDecoder().decode(result.stdout) };
}

function gitConfig(...args: string[]) {
  Bun.spawnSync(['git', 'config', '--local', ...args], { cwd: repo, env: { PATH: process.env.PATH ?? '', HOME: repo } });
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'git-identity-'));
  Bun.spawnSync(['git', 'init', '-q'], { cwd: repo });
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('check-git-identity.sh (FRESCO-828)', () => {
  test('accepts a real identity', () => {
    gitConfig('user.name', 'Basilio');
    gitConfig('user.email', '76871306+BasiMontes@users.noreply.github.com');

    expect(run({}).code).toBe(0);
  });

  test('rejects the test@example.com placeholder from a repo-local config and says how to fix it', () => {
    gitConfig('user.name', 'test');
    gitConfig('user.email', 'test@example.com');

    const { code, out } = run({});
    expect(code).toBe(1);
    expect(out).toContain('placeholder identity');
    expect(out).toContain('git config --local --unset user.email');
  });

  test('rejects any @example.com address, not only test@', () => {
    gitConfig('user.name', 'someone');
    gitConfig('user.email', 'someone@example.com');

    expect(run({}).code).toBe(1);
  });

  test('rejects a placeholder set through the environment even when the config is fine', () => {
    gitConfig('user.name', 'Basilio');
    gitConfig('user.email', 'real@users.noreply.github.com');

    expect(run({ GIT_AUTHOR_EMAIL: 'bot@example.com' }).code).toBe(1);
    expect(run({ GIT_COMMITTER_EMAIL: 'bot@example.com' }).code).toBe(1);
  });

  test('does not reject a lookalike domain', () => {
    gitConfig('user.name', 'Basilio');
    gitConfig('user.email', 'basi@example.com.es');

    expect(run({}).code).toBe(0);
  });
});
