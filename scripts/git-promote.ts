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
 *   - the SHA carries a migration the hosted project has not applied, or the hosted list
 *     cannot be read (FRESCO-1023, fail closed): a migration is not applied by a merge or by a
 *     promotion, it goes by hand with `supabase db push --linked`, and a deploy that reaches
 *     production first breaks whatever calls the function or column it creates
 *     (`record_consents` 404 on 2026-10-19, FRESCO-770). A data-only migration meant to run
 *     after the promotion needs `--override-reason`.
 *
 * Dry run by default. `--yes` pushes, never with force. `--override-reason`
 * waives the run-status and pending-migration problems (a flake confirmed by
 * re-running, a data migration applied right after). It NEVER waives a placeholder identity or a
 * code commit without `(#PR)` (FRESCO-1291). A forced promotion leaves an annotated tag
 * `promote-override/<UTC stamp>-<sha8>` on the promoted SHA, with date, reason and author, pushed in
 * the same atomic push as the branches: the terminal echo is not a trail, the tag is.
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
  kind: 'run' | 'identity' | 'pull-request' | 'migration'
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

// Mirrors `git_strategy.policy.docs_changes` in `.agents/project.yaml`. `.agents/` counts only at its top
// level (README-style notes): a SKILL.md or an instruction section changes how the agent behaves, so it needs a PR.
const DOCS_PATTERNS = [/^docs\//, /^\.context\//, /^[^/]+\.md$/, /^\.agents\/[^/]+\.md$/];

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

/** What an override may waive: a flaky or unfinished run, and a migration meant to run after the promotion. */
const WAIVABLE: ReadonlyArray<Problem['kind']> = ['run', 'migration'];

/** Drops what an override may waive. A placeholder identity and a code commit without `(#PR)` are never waivable. */
export function applyOverride(problems: Problem[], reason: string | undefined): Problem[] {
  if (!reason?.trim()) { return problems; }
  return problems.filter(problem => !WAIVABLE.includes(problem.kind));
}

export interface OverrideTag {
  name: string
  message: string
}

/** The annotated tag a forced promotion leaves on the promoted SHA: who forced what, when and why. */
export function overrideTag(input: { sha: string, reason: string, author: string, date: Date, waived: Problem[] }): OverrideTag {
  const iso = input.date.toISOString();
  const stamp = iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const kinds = [...new Set(input.waived.map(problem => problem.kind))].join(', ');
  return {
    name: `promote-override/${stamp}-${input.sha.slice(0, 8)}`,
    message: [
      `Promotion forced past: ${kinds}`,
      `Date: ${iso}`,
      `Author: ${input.author}`,
      `SHA: ${input.sha}`,
      `Reason: ${input.reason.trim()}`,
      '',
      ...input.waived.map(problem => `- [${problem.kind}] ${problem.message}`),
    ].join('\n'),
  };
}

// ---------------------------------------------------------------------------
// Pending migrations (FRESCO-1023)
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = 'supabase/migrations';

/** The version of a migration file: the 14 digits before the first underscore of its name. */
export function migrationVersion(path: string): string | null {
  const name = path.split('/').pop() ?? '';
  return /^(\d{14})_.+\.sql$/.exec(name)?.[1] ?? null;
}

/** File names of the migrations in the promoted tree that the hosted project has not applied, oldest first. */
export function pendingMigrations(files: string[], applied: ReadonlySet<string>): string[] {
  return files
    .filter((file) => {
      const version = migrationVersion(file);
      return version !== null && !applied.has(version);
    })
    .map(file => file.split('/').pop() ?? file)
    .sort();
}

/**
 * The versions the hosted project reports as applied, from the JSON of `supabase migration list --linked`
 * (progress text may surround it). `null` when it cannot be read: the caller says so, it never assumes none.
 */
export function parseAppliedVersions(output: string): Set<string> | null {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start === -1 || end <= start) { return null; }
  try {
    const parsed = JSON.parse(output.slice(start, end + 1)) as { migrations?: Array<{ remote?: unknown }> };
    if (!Array.isArray(parsed.migrations)) { return null; }
    return new Set(parsed.migrations.flatMap(entry => (typeof entry.remote === 'string' && entry.remote !== '' ? [entry.remote] : [])));
  }
  catch {
    return null;
  }
}

/**
 * The refusal for the migration check. `null` when every migration of the SHA is applied.
 * An unreadable hosted list is a problem too: "could not check" never counts as "nothing pending".
 */
export function migrationProblem(files: string[], applied: ReadonlySet<string> | null): Problem | null {
  if (applied === null) {
    return { kind: 'migration', message: 'could not read the hosted migration list (Supabase CLI missing, not logged in, or the project not linked), so pending migrations were NOT checked. Check by hand: supabase migration list --linked' };
  }
  const pending = pendingMigrations(files, applied);
  if (pending.length === 0) { return null; }
  return { kind: 'migration', message: `${pending.length} migration(s) in this SHA are NOT applied on the hosted project: ${pending.join(', ')}. Apply them first (supabase db push --linked --dry-run, then without --dry-run).` };
}

interface MigrationNotice {
  level: 'ok' | 'warn'
  lines: string[]
}

/** What the promotion prints about migrations once the gate passed (a problem was already raised by `migrationProblem`). */
export function migrationNotice(files: string[], applied: ReadonlySet<string> | null): MigrationNotice {
  if (applied === null) {
    return { level: 'warn', lines: [
      'could not read the hosted migration list (Supabase CLI missing, not logged in, or the project not linked), so pending migrations were NOT checked.',
      'Check by hand: supabase migration list --linked',
    ] };
  }
  const pending = pendingMigrations(files, applied);
  if (pending.length === 0) {
    return { level: 'ok', lines: [`all ${files.length} migrations in this SHA are applied on the hosted project.`] };
  }
  return { level: 'warn', lines: [
    `${pending.length} migration(s) in this SHA are NOT applied on the hosted project:`,
    ...pending.map(name => `  - ${name}`),
    'A merge or a promotion does not apply them. Apply by hand: supabase db push --linked --dry-run, then without --dry-run.',
    'Order: BEFORE promoting if the code calls a function or column they create; after is fine if they only change data.',
  ] };
}

// ---------------------------------------------------------------------------
// Host access
// ---------------------------------------------------------------------------

function fail(message: string): never {
  console.log(`${pc.red('✖')} ${message}`);
  process.exit(1);
}

function git(args: string[], cwd?: string): string {
  const result = Bun.spawnSync(['git', ...args], { stdout: 'pipe', stderr: 'pipe', cwd });
  if (result.exitCode !== 0) { fail(`git ${args.join(' ')} failed: ${result.stderr.toString().trim()}`); }
  return result.stdout.toString().trim();
}

function isAncestor(ancestor: string, descendant: string): boolean {
  return Bun.spawnSync(['git', 'merge-base', '--is-ancestor', ancestor, descendant]).exitCode === 0;
}

function readMigrationFiles(sha: string): string[] {
  return git(['ls-tree', '-r', '--name-only', sha, '--', MIGRATIONS_DIR]).split('\n').filter(file => file.endsWith('.sql'));
}

function readAppliedVersions(): Set<string> | null {
  try {
    const result = Bun.spawnSync(['supabase', 'migration', 'list', '--linked', '--output-format', 'json'], { stdout: 'pipe', stderr: 'pipe' });
    return result.exitCode === 0 ? parseAppliedVersions(result.stdout.toString()) : null;
  }
  catch {
    // The binary is not on PATH.
    return null;
  }
}

function readRuns(sha: string): RunInfo[] {
  const result = Bun.spawnSync(
    ['gh', 'run', 'list', '--workflow', WORKFLOW, '--branch', 'staging', '--commit', sha, '--event', 'push', '--limit', '5', '--json', 'status,conclusion'],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  if (result.exitCode !== 0) { fail(`gh run list failed: ${result.stderr.toString().trim()}`); }
  return JSON.parse(result.stdout.toString()) as RunInfo[];
}

/**
 * `--diff-merges=first-parent` makes a merge commit list the files it brought in, diffed against its first
 * parent. Without it `git log --name-only` prints NO files for a merge, `isDocsOnly([])` is false, and a
 * merge that only carries a docs commit is refused as "touches more than docs". The commit set is
 * unchanged (no `--first-parent`: a commit that arrives through a merge is still audited), and a merge that
 * brings code still shows that code, so it is still refused without a (#PR).
 */
export function readCommits(range: string, cwd?: string): CommitInfo[] {
  const log = git(['log', '--diff-merges=first-parent', '--name-only', '--format=%x1e%H%x1f%ae%x1f%ce%x1f%s%x1f', range], cwd);
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
  const migrationFiles = readMigrationFiles(sha);
  const appliedVersions = readAppliedVersions();
  const migration = migrationProblem(migrationFiles, appliedVersions);
  const problems = [...evaluatePromotion({ runs: readRuns(sha), commits }), ...(migration ? [migration] : [])];
  const remaining = applyOverride(problems, overrideReason);

  console.log(`commits to promote: ${commits.length} (${range})`);
  for (const problem of problems) {
    console.log(`${pc.red('✖')} [${problem.kind}] ${problem.message}`);
  }
  if (remaining.length > 0) {
    const hint = problems.some(p => p.kind === 'identity')
      ? ' (a placeholder identity cannot be overridden)'
      : problems.some(p => p.kind === 'pull-request')
        ? ' (a code commit without (#PR) cannot be overridden: land it through a PR)'
        : ', or pass --override-reason "<why>" for a confirmed flake or a data migration meant to run after the promotion';
    console.log(`\n${pc.red('Promotion refused.')} Fix the above and re-run${hint}.`);
    return 1;
  }
  const tag = problems.length > 0
    ? overrideTag({ sha, reason: overrideReason ?? '', author: Bun.spawnSync(['git', 'config', 'user.name'], { stdout: 'pipe', stderr: 'pipe' }).stdout.toString().trim() || 'unknown', date: new Date(), waived: problems })
    : null;
  if (tag) {
    console.log(`${pc.yellow('!')} OVERRIDE accepted: ${overrideReason}`);
    console.log(`  annotated tag ${tag.name} will record it on ${sha.slice(0, 8)}.`);
  }
  console.log(`${pc.green('✔')} gate passed for ${pending.join(' + ')}.`);

  const notice = migrationNotice(migrationFiles, appliedVersions);
  console.log(`${notice.level === 'ok' ? pc.green('✔') : pc.yellow('!')} migrations: ${notice.lines[0]}`);
  for (const line of notice.lines.slice(1)) {
    console.log(`  ${line}`);
  }

  if (!yes) {
    console.log(`\nDry run. Re-run with ${pc.bold('--yes')} to push ${sha.slice(0, 8)} to ${pending.join(' and ')} (fast-forward only, no force).`);
    return 0;
  }
  // A forced promotion without its trail is worse than no promotion: create the tag BEFORE pushing and stop if it fails.
  if (tag) {
    const created = Bun.spawnSync(['git', 'tag', '-a', tag.name, '-m', tag.message, sha], { stdout: 'pipe', stderr: 'pipe' });
    if (created.exitCode !== 0) { fail(`could not create the override tag, nothing was pushed: ${created.stderr.toString().trim()}`); }
  }
  const refs = [...pending.map(target => `${sha}:refs/heads/${target}`), ...(tag ? [`refs/tags/${tag.name}`] : [])];
  const push = Bun.spawnSync(['git', 'push', ...(tag ? ['--atomic'] : []), 'origin', ...refs], { stdout: 'inherit', stderr: 'inherit' });
  if (push.exitCode !== 0 && tag) { Bun.spawnSync(['git', 'tag', '-d', tag.name], { stdout: 'pipe', stderr: 'pipe' }); }
  return push.exitCode === 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(main());
}
