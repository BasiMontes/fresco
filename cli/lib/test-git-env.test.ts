import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { gitEnvWithoutRepoOverrides } from './test-git-env.ts';

function run(args: string[], env: NodeJS.ProcessEnv): string {
  const res = spawnSync('git', args, { encoding: 'utf8', env });
  return res.stdout.trim();
}

test('drops the variables that make git ignore -C', () => {
  const env = gitEnvWithoutRepoOverrides({
    ...process.env,
    GIT_DIR: '/x/.git',
    GIT_WORK_TREE: '/x',
    GIT_INDEX_FILE: '/x/.git/index',
  });
  expect(env.GIT_DIR).toBeUndefined();
  expect(env.GIT_WORK_TREE).toBeUndefined();
  expect(env.GIT_INDEX_FILE).toBeUndefined();
  expect(env.PATH).toBe(process.env.PATH);
});

test('config written with the sanitized env never reaches the repo GIT_DIR points at', () => {
  const real = mkdtempSync(join(tmpdir(), 'git-env-real-'));
  const scratch = mkdtempSync(join(tmpdir(), 'git-env-scratch-'));
  const hookEnv = { ...process.env, GIT_DIR: join(real, '.git') };
  run(['init', '-q', real], gitEnvWithoutRepoOverrides());
  run(['init', '-q', scratch], gitEnvWithoutRepoOverrides());

  run(['-C', scratch, 'config', 'user.email', 'test@example.com'], gitEnvWithoutRepoOverrides(hookEnv));

  const scratchEmail = run(['-C', scratch, 'config', '--local', 'user.email'], gitEnvWithoutRepoOverrides());
  const realEmail = run(['-C', real, 'config', '--local', 'user.email'], gitEnvWithoutRepoOverrides());
  expect(scratchEmail).toBe('test@example.com');
  expect(realEmail).toBe('');
});
