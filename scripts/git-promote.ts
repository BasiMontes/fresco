#!/usr/bin/env bun
/**
 * Promotion gate: `bun run git:promote [--yes] [--override-reason "<why>"]`.
 *
 * FRESCO-829 (external audit 6, finding "Promoción con staging en rojo"). The
 * rule "what reaches `main` passed e2e on staging" was a comment in
 * `pr-check.yml`; nothing stopped the admin who promotes. In September 17 of 179
 * SHAs reached `main` with the staging PR Check in `failure`, and the
 * "mergea y nivela" flow once promoted a SHA whose run was still `queued`.
 *
 * The promotion is a fast-forward mirror push of `origin/staging` to `dev` and
 * `main` (`git_strategy.decisions.promote_method: ff-only`). This script is the
 * only sanctioned way to do it. It refuses when:
 *
 *   - the SHA has no PR Check run on staging, or it is pending or not `success`
 *   - a commit in the range is signed with a placeholder identity (`*@example.com`)
 *   - a commit has no `(#PR)` in its subject and touches more than docs
 *     (`git_strategy.policy.docs_changes: direct-to-main-ok`)
 *   - `main` or `dev` would not be a pure fast-forward
 *
 * Dry run by default. `--yes` pushes, never with force. `--override-reason`
 * waives the run-status and no-PR problems (a flake confirmed by re-running)
 * and is echoed so it leaves a trail; it NEVER waives a placeholder identity.
 * This script is project-owned, `bun run up` does not overwrite it.
 */

import process from 'node:process';

import pc from 'picocolors';

interface RunInfo {
  status: string
  conclusion: string | null
}

interface CommitInfo {
  sha: string
  authorEmail: string
  committerEmail: string
  subject: string
  files: string[]
}

interface Problem {
  kind: 'run' | 'identity' | 'pull-request'
  message: string
}

interface PromotionInput {
  runs: RunInfo[]
  commits: CommitInfo[]
}

const TARGETS = ['dev', 'main'] as const;
const WORKFLOW = 'pr-check.yml';

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in git-promote.test.ts)
// ---------------------------------------------------------------------------

const DOCS_PATTERNS = [/^docs\//, /^\.context\//, /^[^/]+\.md$/, /^\.agents\/.+\.md$/];

export function isDocsOnly(files: string[]): boolean {
  return files.length > 0 && files.every(file => DOCS_PATTERNS.some(pattern => pattern.test(file)));
}

export function hasPullRequestRef(subject: string): boolean {
  return /\(#\d+\)\s*$/.test(subject);
}

function runProblem(runs: RunInfo[]): Problem | null {
  const latest = runs[0];
  if (!latest) { return { kind: 'run', message: `no ${WORKFLOW} run exists for this SHA on staging` }; }
  if (latest.status !== 'completed') { return { kind: 'run', message: `latest ${WORKFLOW} run is ${latest.status}, not finished` }; }
  if (latest.conclusion !== 'success') { return { kind: 'run', message: `latest ${WORKFLOW} run concluded ${latest.conclusion ?? 'unknown'}, not success` }; }
  return null;
}

function commitProblems(commits: CommitInfo[]): Problem[] {
  const problems: Problem[] = [];
  for (const commit of commits) {
    const short = commit.sha.slice(0, 8);
    const placeholder = [commit.authorEmail, commit.committerEmail].find(email => /@example\.com$/i.test(email));
    if (placeholder) {
      problems.push({ kind: 'identity', message: `${short} is signed with a placeholder identity (${placeholder})` });
    }
    if (!hasPullRequestRef(commit.subject) && !isDocsOnly(commit.files)) {
      problems.push({ kind: 'pull-request', message: `${short} has no (#PR) in its subject and touches more than docs: "${commit.subject}"` });
    }
  }
  return problems;
}

/** Every reason the promotion must stop. Empty means it may proceed. */
export function evaluatePromotion(input: PromotionInput): Problem[] {
  const run = runProblem(input.runs);
  return [...(run ? [run] : []), ...commitProblems(input.commits)];
}

/** Drops what an override may waive. A placeholder identity is never waivable. */
export function applyOverride(problems: Problem[], reason: string | undefined): Problem[] {
  if (!reason?.trim()) { return problems; }
  return problems.filter(problem => problem.kind === 'identity');
}

// ---------------------------------------------------------------------------
// Host access
// ---------------------------------------------------------------------------

function fail(message: string): never {
  console.log(`${pc.red('✖')} ${message}`);
  process.exit(1);
}

function git(args: string[]): string {
  const result = Bun.spawnSync(['git', ...args], { stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) { fail(`git ${args.join(' ')} failed: ${result.stderr.toString().trim()}`); }
  return result.stdout.toString().trim();
}

function isAncestor(ancestor: string, descendant: string): boolean {
  return Bun.spawnSync(['git', 'merge-base', '--is-ancestor', ancestor, descendant]).exitCode === 0;
}

function readRuns(sha: string): RunInfo[] {
  const result = Bun.spawnSync(
    ['gh', 'run', 'list', '--workflow', WORKFLOW, '--branch', 'staging', '--commit', sha, '--event', 'push', '--limit', '5', '--json', 'status,conclusion'],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  if (result.exitCode !== 0) { fail(`gh run list failed: ${result.stderr.toString().trim()}`); }
  return JSON.parse(result.stdout.toString()) as RunInfo[];
}

function readCommits(range: string): CommitInfo[] {
  const log = git(['log', '--name-only', '--format=%x1e%H%x1f%ae%x1f%ce%x1f%s%x1f', range]);
  return log.split('\x1E').filter(Boolean).map((record) => {
    const [sha, authorEmail, committerEmail, subject, files] = record.split('\x1F');
    return {
      sha: sha.trim(),
      authorEmail,
      committerEmail,
      subject,
      files: files.split('\n').map(file => file.trim()).filter(Boolean),
    };
  });
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function main(): number {
  const yes = process.argv.includes('--yes');
  const overrideReason = readFlag('--override-reason');

  git(['fetch', '--quiet', 'origin']);
  const sha = git(['rev-parse', 'origin/staging']);
  const pending = TARGETS.filter(target => git(['rev-parse', `origin/${target}`]) !== sha);

  console.log(pc.bold(`\nPromotion gate${yes ? '' : ' (dry run)'}`));
  console.log('='.repeat(50));
  console.log(`staging SHA: ${sha.slice(0, 8)}`);

  if (pending.length === 0) {
    console.log(`${pc.green('✔')} dev and main already at ${sha.slice(0, 8)}, nothing to promote.`);
    return 0;
  }
  for (const target of pending) {
    if (!isAncestor(`origin/${target}`, sha)) {
      fail(`origin/${target} is not an ancestor of staging: not a fast-forward, hand it to conflict resolution.`);
    }
  }

  const range = `origin/${pending.includes('main') ? 'main' : pending[0]}..${sha}`;
  const commits = readCommits(range);
  const problems = evaluatePromotion({ runs: readRuns(sha), commits });
  const remaining = applyOverride(problems, overrideReason);

  console.log(`commits to promote: ${commits.length} (${range})`);
  for (const problem of problems) {
    console.log(`${pc.red('✖')} [${problem.kind}] ${problem.message}`);
  }
  if (remaining.length > 0) {
    console.log(`\n${pc.red('Promotion refused.')} Fix the above and re-run${problems.some(p => p.kind === 'identity') ? ' (a placeholder identity cannot be overridden)' : ', or pass --override-reason "<why>" for a confirmed flake'}.`);
    return 1;
  }
  if (problems.length > 0) {
    console.log(`${pc.yellow('!')} OVERRIDE accepted: ${overrideReason}`);
  }
  console.log(`${pc.green('✔')} gate passed for ${pending.join(' + ')}.`);

  if (!yes) {
    console.log(`\nDry run. Re-run with ${pc.bold('--yes')} to push ${sha.slice(0, 8)} to ${pending.join(' and ')} (fast-forward only, no force).`);
    return 0;
  }
  const push = Bun.spawnSync(['git', 'push', 'origin', ...pending.map(target => `${sha}:refs/heads/${target}`)], { stdout: 'inherit', stderr: 'inherit' });
  return push.exitCode === 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(main());
}
