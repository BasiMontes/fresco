import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

/**
 * FRESCO-802 (audit-6 A6-D6): the repo is public and a pull request from a
 * branch of the SAME repo runs its own copy of the workflow with the repo's
 * secrets in reach. These tests keep that exposure closed:
 *
 *   - a workflow that runs on `pull_request` (or `pull_request_target`)
 *     references no secret;
 *   - the live-backend workflows read the reduced `LIVE_E2E_ENV_FILE` first;
 *   - every `uses:` is pinned by commit SHA (a precondition of enabling the
 *     repository setting `sha_pinning_required`, which fails any run that
 *     references an action by tag).
 */

const WORKFLOWS_DIR = join(import.meta.dir, '..', '.github', 'workflows');

function workflows(): { name: string, code: string }[] {
  return readdirSync(WORKFLOWS_DIR)
    .filter(f => f.endsWith('.yml'))
    .map(name => ({
      name,
      // Comments explain the history and may name a secret; only code counts.
      code: readFileSync(join(WORKFLOWS_DIR, name), 'utf8')
        .split('\n')
        .map(line => line.replace(/(?:^|\s)#.*$/, ''))
        .join('\n'),
    }));
}

describe('CI secrets policy (FRESCO-802)', () => {
  test('a workflow triggered by a pull request references no secret', () => {
    const offenders = workflows()
      .filter(w => /^\s{2}(?:pull_request|pull_request_target):/m.test(w.code))
      .filter(w => /\bsecrets\./.test(w.code))
      .map(w => w.name);
    expect(offenders).toEqual([]);
  });

  test('the pull-request gate never restores the production env file', () => {
    const prCheck = workflows().find(w => w.name === 'pr-check.yml');
    expect(prCheck).toBeDefined();
    expect(prCheck!.code).not.toContain('ENV_FILE');
  });

  test('the live-backend workflows prefer the reduced secret and keep a fallback', () => {
    for (const name of ['post-deploy-smoke.yml', 'stripe-e2e.yml']) {
      const w = workflows().find(x => x.name === name);
      expect(w, name).toBeDefined();
      expect(w!.code, name).toContain('secrets.LIVE_E2E_ENV_FILE || secrets.ENV_FILE');
    }
  });

  test('every action is pinned by a full commit SHA', () => {
    const unpinned = workflows().flatMap(w =>
      [...w.code.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)/gm)]
        .map(m => m[1])
        .filter(ref => !ref.startsWith('./') && !/@[0-9a-f]{40}$/.test(ref))
        .map(ref => `${w.name}: ${ref}`),
    );
    expect(unpinned).toEqual([]);
  });
});
