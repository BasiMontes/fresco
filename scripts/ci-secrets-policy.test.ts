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

  test('the live-backend workflows read only the reduced secret, never the full env file', () => {
    for (const name of ['post-deploy-smoke.yml', 'stripe-e2e.yml']) {
      const w = workflows().find(x => x.name === name);
      expect(w, name).toBeDefined();
      expect(w!.code, name).toContain('secrets.LIVE_E2E_ENV_FILE');
      expect(w!.code, name).not.toContain('secrets.ENV_FILE');
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

  // FRESCO-1110 (audit-8 A8-SUPPLY-02/03/04).
  test('no workflow declares itself without a top-level permissions block', () => {
    const offenders = workflows().filter(w => !/^permissions:/m.test(w.code)).map(w => w.name);
    expect(offenders).toEqual([]);
  });

  test('no run: script expands event or dispatch-input text inline', () => {
    const offenders: string[] = [];
    for (const w of workflows()) {
      const lines = w.code.split('\n');
      lines.forEach((line, index) => {
        const match = /^(\s*)(?:-\s*)?run:(.*)$/.exec(line);
        if (!match) { return; }
        const indent = match[1].length;
        const body = [match[2].trim()];
        for (let next = index + 1; next < lines.length; next++) {
          const nextIndent = /^(\s*)/.exec(lines[next])![1].length;
          if (lines[next].trim() !== '' && nextIndent <= indent) { break; }
          body.push(lines[next]);
        }
        if (/\$\{\{\s*(?:github\.event\.|inputs\.)/.test(body.join('\n'))) {
          offenders.push(`${w.name}:${index + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  test('the post-deploy smoke job validates the deployment URL before using it', () => {
    const smoke = workflows().find(w => w.name === 'post-deploy-smoke.yml')!;
    expect(smoke.code).toContain('^https://[a-z0-9.-]+\\.vercel\\.app/?$');
    expect(smoke.code.indexOf('APP_URL=')).toBeLessThan(smoke.code.indexOf('secrets.LIVE_E2E_ENV_FILE'));
  });

  test('the supermarket workflows holding the service-role key do not persist checkout credentials', () => {
    for (const name of ['refresh-supermarket-prices.yml', 'spike-supermarket-probe.yml']) {
      const w = workflows().find(x => x.name === name);
      expect(w, name).toBeDefined();
      expect(w!.code, name).toContain('persist-credentials: false');
    }
  });
});
