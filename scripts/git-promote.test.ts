import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { applyOverride, evaluatePromotion, hasPullRequestRef, isDocsOnly, migrationNotice, migrationVersion, parseAppliedVersions, pendingMigrations, readCommits } from './git-promote';

/**
 * FRESCO-829 (external audit 6): the staging -> main promotion is a manual
 * fast-forward, so the rule "what reaches main passed the staging PR Check" had
 * no enforcement. These helpers back `bun run git:promote`.
 */

const green = { status: 'completed', conclusion: 'success' };
const clean = {
  sha: 'a'.repeat(40),
  authorEmail: '76871306+BasiMontes@users.noreply.github.com',
  committerEmail: '76871306+BasiMontes@users.noreply.github.com',
  subject: 'fix(FRESCO-1): something (#12)',
  files: ['lib/x.ts'],
};

describe('evaluatePromotion, staging run', () => {
  test('passes with a green run and a clean commit', () => {
    expect(evaluatePromotion({ runs: [green], commits: [clean] })).toEqual([]);
  });

  test('refuses a red run', () => {
    const problems = evaluatePromotion({ runs: [{ status: 'completed', conclusion: 'failure' }], commits: [clean] });
    expect(problems.map(p => p.kind)).toEqual(['run']);
    expect(problems[0].message).toContain('failure');
  });

  test('refuses a pending run, the case that slipped through on the day of the audit', () => {
    const problems = evaluatePromotion({ runs: [{ status: 'queued', conclusion: null }], commits: [clean] });
    expect(problems[0].message).toContain('queued');
  });

  test('refuses a SHA with no run at all', () => {
    expect(evaluatePromotion({ runs: [], commits: [clean] })[0].message).toContain('no pr-check.yml run');
  });

  test('judges only the latest run, so a green re-run after a red one passes', () => {
    expect(evaluatePromotion({ runs: [green, { status: 'completed', conclusion: 'failure' }], commits: [clean] })).toEqual([]);
  });
});

describe('evaluatePromotion, commits', () => {
  test('refuses a placeholder author or committer', () => {
    const problems = evaluatePromotion({ runs: [green], commits: [{ ...clean, authorEmail: 'test@example.com' }] });
    expect(problems.map(p => p.kind)).toEqual(['identity']);
    const committer = evaluatePromotion({ runs: [green], commits: [{ ...clean, committerEmail: 'x@EXAMPLE.com' }] });
    expect(committer.map(p => p.kind)).toEqual(['identity']);
  });

  test('refuses a code commit with no (#PR)', () => {
    const problems = evaluatePromotion({ runs: [green], commits: [{ ...clean, subject: 'fix: direct', files: ['lib/x.ts'] }] });
    expect(problems.map(p => p.kind)).toEqual(['pull-request']);
  });

  test('lets a docs-only commit without (#PR) through, per docs_changes: direct-to-main-ok', () => {
    const docs = { ...clean, subject: 'docs: bitacora FRESCO-1', files: ['.context/bitacora.md'] };
    expect(evaluatePromotion({ runs: [green], commits: [docs] })).toEqual([]);
  });

  test('reports a commit with both problems twice', () => {
    const bad = { ...clean, authorEmail: 'test@example.com', subject: 'fix: direct' };
    expect(evaluatePromotion({ runs: [green], commits: [bad] }).map(p => p.kind)).toEqual(['identity', 'pull-request']);
  });
});

describe('applyOverride', () => {
  const problems = [
    { kind: 'run' as const, message: 'flake' },
    { kind: 'pull-request' as const, message: 'no pr' },
    { kind: 'identity' as const, message: 'example.com' },
  ];

  test('without a reason keeps every problem', () => {
    expect(applyOverride(problems, undefined)).toEqual(problems);
    expect(applyOverride(problems, '   ')).toEqual(problems);
  });

  test('with a reason waives run and pull-request problems but never identity', () => {
    expect(applyOverride(problems, 'flake confirmed after re-run').map(p => p.kind)).toEqual(['identity']);
  });
});

describe('helpers', () => {
  test('isDocsOnly follows the docs_changes policy paths', () => {
    expect(isDocsOnly(['docs/a.md', '.context/b.md', 'README.md', '.agents/x/SKILL.md'])).toBe(true);
    expect(isDocsOnly(['docs/a.md', 'lib/x.ts'])).toBe(false);
    expect(isDocsOnly([])).toBe(false);
  });

  test('hasPullRequestRef needs the (#N) suffix of a squash merge', () => {
    expect(hasPullRequestRef('feat(FRESCO-1): x (#472)')).toBe(true);
    expect(hasPullRequestRef('feat: mentions #472 in the middle')).toBe(false);
  });
});

/**
 * FRESCO-1023: a migration is applied by hand (`supabase db push --linked`), not by a merge or a
 * promotion, so a promotion can ship code that calls a function the hosted project does not have yet.
 * The script warns; it never refuses.
 */
const FILES = [
  'supabase/migrations/20261019210000_register_shopping_list_and_export_rate_limits.sql',
  'supabase/migrations/20261020100000_cron_job_heartbeats.sql',
  'supabase/migrations/20261020110000_diet_labels_follow_their_definition.sql',
];

describe('migrationVersion', () => {
  test('is the 14 digits before the first underscore', () => {
    expect(migrationVersion(FILES[2])).toBe('20261020110000');
    expect(migrationVersion('20261020110000_x.sql')).toBe('20261020110000');
  });

  test.each(['supabase/migrations/README.md', 'supabase/migrations/2026_x.sql', 'supabase/migrations/20261020110000.sql', 'supabase/migrations/20261020110000_x.txt'])('is null for %p', (path) => {
    expect(migrationVersion(path)).toBeNull();
  });
});

describe('pendingMigrations', () => {
  test('lists only the files whose version the hosted project has not applied, by file name', () => {
    const applied = new Set(['20261019210000', '20261020100000']);

    expect(pendingMigrations(FILES, applied)).toEqual(['20261020110000_diet_labels_follow_their_definition.sql']);
  });

  test('is empty when everything is applied', () => {
    expect(pendingMigrations(FILES, new Set(FILES.map(file => migrationVersion(file) as string)))).toEqual([]);
  });

  test('ignores a file that is not a migration instead of calling it pending', () => {
    expect(pendingMigrations(['supabase/migrations/README.md'], new Set())).toEqual([]);
  });

  test('returns them oldest first whatever order git lists them in', () => {
    expect(pendingMigrations([FILES[2], FILES[0]], new Set())).toEqual([
      '20261019210000_register_shopping_list_and_export_rate_limits.sql',
      '20261020110000_diet_labels_follow_their_definition.sql',
    ]);
  });
});

describe('parseAppliedVersions', () => {
  const json = '{"migrations":[{"local":"20261020100000","remote":"20261020100000"},{"local":"20261020110000","remote":""}],"message":"Migrations listed"}';

  test('keeps the remote versions and drops the empty ones, as a local-only migration reports', () => {
    expect([...parseAppliedVersions(json) as Set<string>]).toEqual(['20261020100000']);
  });

  test('finds the JSON when progress text surrounds it', () => {
    expect(parseAppliedVersions(`Connecting to remote database...\n${json}\nA new version is available`)?.size).toBe(1);
  });

  test.each(['', 'not json', '{"migrations":', '{"other":1}', '{"migrations":"x"}'])('is null, never an empty set, for %p', (output) => {
    expect(parseAppliedVersions(output)).toBeNull();
  });
});

describe('migrationNotice', () => {
  test('is ok and counts the files when all are applied', () => {
    const notice = migrationNotice(FILES, new Set(FILES.map(file => migrationVersion(file) as string)));

    expect(notice.level).toBe('ok');
    expect(notice.lines[0]).toContain('all 3 migrations');
  });

  test('warns, names each pending migration and says when to apply it', () => {
    const notice = migrationNotice(FILES, new Set(['20261019210000']));

    expect(notice.level).toBe('warn');
    expect(notice.lines[0]).toContain('2 migration(s)');
    expect(notice.lines.join('\n')).toContain('20261020100000_cron_job_heartbeats.sql');
    expect(notice.lines.join('\n')).toContain('supabase db push --linked --dry-run');
    expect(notice.lines.join('\n')).toContain('BEFORE promoting');
  });

  test('says it did NOT check when the hosted list is unreadable, instead of reporting all applied', () => {
    const notice = migrationNotice(FILES, null);

    expect(notice.level).toBe('warn');
    expect(notice.lines[0]).toContain('NOT checked');
  });
});

/**
 * FRESCO-1039: `git log --name-only` prints no files for a merge commit, so `isDocsOnly([])` was false and a
 * merge that only carried a docs commit was refused as "touches more than docs". These tests run the real
 * `readCommits` against a throwaway repository with real merges, because the bug lived in what git prints.
 */
describe('readCommits, merge commits', () => {
  const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'dev@fresco.test', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'dev@fresco.test' };

  function inRepo(run: (repo: string, git: (...args: string[]) => string) => void) {
    const repo = mkdtempSync(join(tmpdir(), 'git-promote-'));
    const git = (...args: string[]) => {
      const result = Bun.spawnSync(['git', ...args], { cwd: repo, env: GIT_ENV, stdout: 'pipe', stderr: 'pipe' });
      if (result.exitCode !== 0) { throw new Error(`git ${args.join(' ')}: ${result.stderr.toString()}`); }
      return result.stdout.toString().trim();
    };
    try {
      git('init', '--quiet', '--initial-branch=main');
      run(repo, git);
    }
    finally {
      rmSync(repo, { recursive: true, force: true });
    }
  }

  /** Commits `file` on the current branch. */
  function commit(repo: string, git: (...args: string[]) => string, file: string, subject: string) {
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    writeFileSync(join(repo, file), `${subject}\n`);
    git('add', file);
    git('commit', '--quiet', '-m', subject);
  }

  /** A base commit, a side branch with one commit, a commit on main, then a real merge of the branch into main. */
  function mergeOf(file: string, run: (merge: ReturnType<typeof readCommits>[number], all: ReturnType<typeof readCommits>) => void) {
    inRepo((repo, git) => {
      commit(repo, git, 'README.md', 'base');
      const base = git('rev-parse', 'HEAD');
      git('switch', '--quiet', '-c', 'side');
      commit(repo, git, file, 'work on the side');
      git('switch', '--quiet', 'main');
      commit(repo, git, 'docs/main-only.md', 'work on main');
      git('merge', '--no-ff', '--quiet', '-m', 'merge side into main', 'side');
      const commits = readCommits(`${base}..HEAD`, repo);
      run(commits.find(found => found.subject === 'merge side into main')!, commits);
    });
  }

  test('a merge lists the files it brought in, diffed against its first parent', () => {
    mergeOf('docs/from-side.md', (merge) => {
      expect(merge.files).toEqual(['docs/from-side.md']);
    });
  });

  test('a merge that only carries docs is not refused for lacking a (#PR)', () => {
    mergeOf('.context/business/from-side.md', (merge, commits) => {
      const problems = evaluatePromotion({ runs: [green], commits: [merge] });

      expect(problems).toEqual([]);
      expect(commits).toHaveLength(3);
    });
  });

  test('a merge that carries code is still refused without a (#PR)', () => {
    mergeOf('lib/from-side.ts', (merge) => {
      const problems = evaluatePromotion({ runs: [green], commits: [merge] });

      expect(problems.map(problem => problem.kind)).toEqual(['pull-request']);
      expect(problems[0].message).toContain(merge.sha.slice(0, 8));
    });
  });

  test('the commit set is unchanged: the commit that came in through the merge is audited too', () => {
    mergeOf('lib/from-side.ts', (_merge, commits) => {
      expect(commits.map(found => found.subject).sort()).toEqual(['merge side into main', 'work on main', 'work on the side']);
    });
  });
});
