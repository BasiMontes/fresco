#!/usr/bin/env bun
/**
 * Required status checks parity — `bun run git:checks <verify|apply>`.
 *
 * FRESCO-781 (audit-6 A6-T3 + A6-D4). `bun run git:policy` models the ruleset
 * (pull requests, deletion, non-fast-forward) and deliberately CARRIES
 * `required_status_checks` FORWARD untouched; they live in the classic branch
 * protection, not in the ruleset. So the list of checks a PR must pass was
 * declared nowhere and drifted: `test:db-integration` (RLS, SECURITY DEFINER
 * spoof, Edge contract) and `deno:check` ran on every PR but were not required,
 * and a PR could merge with both red.
 *
 * The declaration is `git_strategy.policy.required_checks` in
 * `.agents/project.yaml`. This script is project-owned (not synced from the
 * boilerplate), so `bun run up` never overwrites it.
 *
 *   verify          read-only. Exits 1 when a declared check is not required on
 *                   a protected branch (a required check nobody declared is only
 *                   reported).
 *   apply           dry run. Shows what would be ADDED.
 *   apply --yes     writes it. It only ADDS checks; it never removes one, so it
 *                   can only tighten protection. It changes who can merge, so
 *                   run it deliberately, after the job it requires exists on the
 *                   target branch (otherwise nothing could ever satisfy it).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import pc from 'picocolors';
import { parse as parseYaml } from 'yaml';

const REPO_ROOT = join(import.meta.dir, '..');
const PROJECT_YAML = join(REPO_ROOT, '.agents', 'project.yaml');

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in required-checks.test.ts)
// ---------------------------------------------------------------------------

/** Reads `policy.required_checks` from a `git_strategy` block. An absent or empty list is an error, never "nothing required". */
export function parseDeclaredChecks(gitStrategy: { policy?: { required_checks?: unknown } } | undefined): string[] {
  const raw = gitStrategy?.policy?.required_checks;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('`git_strategy.policy.required_checks` must be a non-empty list in .agents/project.yaml');
  }
  if (!raw.every(c => typeof c === 'string' && c.trim() !== '')) {
    throw new Error('`git_strategy.policy.required_checks` entries must be non-empty strings');
  }
  return [...new Set(raw as string[])];
}

export function diffRequiredChecks(declared: string[], enforced: string[]): { missing: string[], extra: string[] } {
  return {
    missing: declared.filter(c => !enforced.includes(c)),
    extra: enforced.filter(c => !declared.includes(c)),
  };
}

/** Union that keeps every check already required (so applying can only tighten) and appends the missing declared ones. */
export function mergeRequiredChecks(enforced: string[], declared: string[]): string[] {
  return [...new Set([...enforced, ...declared])];
}

// ---------------------------------------------------------------------------
// Host access
// ---------------------------------------------------------------------------

interface RequiredStatusChecks {
  strict: boolean
  contexts: string[]
  checks: { context: string, app_id: number | null }[]
}

function fail(message: string): never {
  console.log(`${pc.red('✖')} ${message}`);
  process.exit(1);
}

function readGitStrategy(): { protected?: string[], policy?: { required_checks?: unknown } } {
  if (!existsSync(PROJECT_YAML)) { fail(`.agents/project.yaml not found at ${PROJECT_YAML}`); }
  const doc = parseYaml(readFileSync(PROJECT_YAML, 'utf8')) as Record<string, unknown>;
  const gs = doc?.git_strategy as { protected?: string[], policy?: { required_checks?: unknown } } | undefined;
  if (!gs) { fail('`git_strategy:` block missing from .agents/project.yaml'); }
  return gs;
}

/** `owner/repo` from the origin remote. */
function readSlug(): string {
  const p = Bun.spawnSync(['git', '-C', REPO_ROOT, 'remote', 'get-url', 'origin'], { stdout: 'pipe', stderr: 'pipe' });
  if (p.exitCode !== 0) { fail('No `origin` remote — cannot resolve the repository.'); }
  const m = p.stdout.toString().trim().match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
  if (!m) { fail('origin is not a GitHub remote.'); }
  return `${m[1]}/${m[2]}`;
}

/** `null` when the branch has no classic required-status-checks protection (404) or the call failed. */
function readEnforced(slug: string, branch: string): RequiredStatusChecks | null {
  const p = Bun.spawnSync(['gh', 'api', `repos/${slug}/branches/${branch}/protection/required_status_checks`], { stdout: 'pipe', stderr: 'pipe' });
  if (p.exitCode !== 0) { return null; }
  try { return JSON.parse(p.stdout.toString()) as RequiredStatusChecks; }
  catch { return null; }
}

function enforcedContexts(host: RequiredStatusChecks): string[] {
  return [...new Set([...(host.contexts ?? []), ...(host.checks ?? []).map(c => c.context)])];
}

function write(slug: string, branch: string, host: RequiredStatusChecks, contexts: string[]): boolean {
  const appIds = new Map((host.checks ?? []).map(c => [c.context, c.app_id] as const));
  const body = {
    strict: host.strict,
    checks: contexts.map(context => (appIds.has(context) ? { context, app_id: appIds.get(context) } : { context })),
  };
  const p = Bun.spawnSync(
    ['gh', 'api', '-X', 'PATCH', `repos/${slug}/branches/${branch}/protection/required_status_checks`, '--input', '-'],
    { stdin: new TextEncoder().encode(JSON.stringify(body)), stdout: 'pipe', stderr: 'pipe' },
  );
  if (p.exitCode !== 0) {
    console.log(`${pc.red('✖')} ${branch}: ${p.stderr.toString().trim() || 'PATCH failed'}`);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function run(mode: 'verify' | 'apply', yes: boolean): number {
  const gs = readGitStrategy();
  const slug = readSlug();
  let declared: string[];
  try { declared = parseDeclaredChecks(gs); }
  catch (error) { return fail((error as Error).message); }
  const branches = gs.protected ?? [];
  if (branches.length === 0) { fail('`git_strategy.protected` is empty — nothing to check.'); }

  console.log(pc.bold(`\nRequired status checks — ${mode}${mode === 'apply' && !yes ? ' (dry run)' : ''}`));
  console.log('='.repeat(50));
  console.log(`Repository: ${slug}`);
  console.log(`Declared:   ${declared.join(', ')}\n`);

  let exit = 0;
  for (const branch of branches) {
    const host = readEnforced(slug, branch);
    if (!host) {
      console.log(`${pc.yellow('▲')} ${branch}: no classic required-status-checks protection readable (not configured, or the token cannot read it)`);
      exit = 1;
      continue;
    }
    const enforced = enforcedContexts(host);
    const { missing, extra } = diffRequiredChecks(declared, enforced);

    if (missing.length === 0) {
      console.log(`${pc.green('✔')} ${branch}: all declared checks are required${extra.length ? pc.dim(` (also required, undeclared: ${extra.join(', ')})`) : ''}`);
      continue;
    }

    if (mode === 'verify') {
      console.log(`${pc.red('✖')} ${branch}: declared but NOT required: ${missing.join(', ')}`);
      exit = 1;
      continue;
    }

    console.log(`${pc.yellow('▲')} ${branch}: would ADD ${missing.join(', ')}`);
    if (yes) {
      if (write(slug, branch, host, mergeRequiredChecks(enforced, declared))) {
        console.log(`${pc.green('✔')} ${branch}: now requires ${mergeRequiredChecks(enforced, declared).join(', ')}`);
      }
      else {
        exit = 1;
      }
    }
  }

  if (mode === 'apply' && !yes) {
    console.log(pc.dim('\nDry run — nothing sent. Re-run with --yes to write.'));
  }
  return exit;
}

function main(): void {
  const [cmd, ...flags] = process.argv.slice(2);
  if (cmd === 'verify') { process.exit(run('verify', false)); }
  if (cmd === 'apply') { process.exit(run('apply', flags.includes('--yes'))); }
  console.log('Usage: bun run git:checks <verify | apply [--yes]>');
  process.exit(cmd === '--help' || cmd === '-h' ? 0 : 1);
}

if (import.meta.main) {
  main();
}
