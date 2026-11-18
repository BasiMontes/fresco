/**
 * @fileoverview FRESCO-1238: a fresh worktree must pass the pre-push `vars:env:check`.
 *
 * Project-owned (the synced `cli/lib/env-schema.test.ts` is ignored by bunfig.toml and
 * overwritten by the updater). A fresh worktree has no schema until `bun run vars:schema`
 * generates `.env.core.schema` and seeds `.env.schema` from the template; rule 4b of
 * `vars:env:check` then fails every `.env.example` key that pair does not declare. Fixture
 * names and fake values only: no real env file is read and no value is ever printed.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, test } from 'bun:test';

import {
  checkSchemaSensitivity,
  generateCoreSchema,
  schemaClassification,
  seedProjectSchema,
  writeCoreSchema,
} from '../cli/lib/env-schema.ts';
import { DEPRECATED_VARS, parseDotEnvExampleKeys, VAR_MANIFEST } from '../cli/lib/variables-manifest.ts';

const REPO_ROOT = path.resolve(import.meta.dir, '..');

function withScratch<T>(fn: (dir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'worktree-env-schema-'));
  try {
    return fn(dir);
  }
  finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// FRESCO-1238: a fresh worktree has no schema until `bun run vars:schema` generates the
// core file and seeds `.env.schema` from the template. `vars:env:check` rule 4b then fails
// every `.env.example` key that pair does not declare. These tests build the pair exactly
// the way a fresh worktree does and prove the Pro-plan test users are declared in it.
describe('a schema pair generated from the template (fresh worktree)', () => {
  const PRO_PLAN_USERS = ['DEV', 'PRE', 'PRO'].flatMap(env => [`${env}_PRO_PLAN_USER_EMAIL`, `${env}_PRO_PLAN_USER_PASSWORD`]);

  test('declares every .env.example key, so vars:env:check rule 4b cannot fail on it', () => {
    withScratch((dir) => {
      writeCoreSchema(dir);
      seedProjectSchema(dir);
      const declared = schemaClassification(dir)?.declared ?? new Set<string>();
      const deprecated = new Set(DEPRECATED_VARS.map(d => d.name));
      const undeclared = parseDotEnvExampleKeys(path.join(REPO_ROOT, '.env.example')).filter(k => !declared.has(k) && !deprecated.has(k));
      expect(undeclared).toEqual([]);
    });
  });

  test('declares the Pro-plan test users as optional, with the passwords (and only them) @sensitive', () => {
    const text = generateCoreSchema();
    for (const name of PRO_PLAN_USERS) {
      expect(text).toContain(`\n${name}=`);
      const spec = VAR_MANIFEST.find(s => s.name === name);
      expect(spec?.required).toBe(false);
      expect(spec?.secret).toBe(name.endsWith('_PASSWORD'));
    }
    withScratch((dir) => {
      writeCoreSchema(dir);
      const sensitive = schemaClassification(dir)?.sensitive ?? new Set<string>();
      for (const name of PRO_PLAN_USERS) { expect(sensitive.has(name)).toBe(name.endsWith('_PASSWORD')); }
      expect(checkSchemaSensitivity(dir).ok).toBe(true);
    });
  });

  test('loads through varlock with a fixture .env that omits them, and with one that defines them (fake values, never echoed)', () => {
    const FAKE = 'fixture-fake-value-1238';
    for (const fixture of ['', PRO_PLAN_USERS.map(n => `${n}=${n.endsWith('_EMAIL') ? 'fixture@example.test' : FAKE}`).join('\n')]) {
      withScratch((dir) => {
        writeCoreSchema(dir);
        seedProjectSchema(dir);
        fs.writeFileSync(path.join(dir, '.env'), `${fixture}\n`);
        const run = spawnSync('bunx', ['varlock', 'load', '--agent', '--path', `${dir}${path.sep}`], { cwd: REPO_ROOT, encoding: 'utf8', env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: undefined } });
        expect(run.status).toBe(0);
        expect(`${run.stdout}${run.stderr}`).not.toContain(FAKE);
      });
    }
  });
});
