/**
 * FRESCO-468 — a linked-worktree `git push` exports `GIT_DIR`/`GIT_WORK_TREE`
 * (absolute paths into the worktree's private git-dir) into the pre-push
 * hook's environment. Any test that spawns `git -C <tmpdir>` while inheriting
 * those vars has its command redirected to the REAL repo instead of the
 * tmpdir fixture — confirmed live: it wrote `core.bare`/`core.worktree` onto
 * the primary worktree's `.git/config` and created ~99 fixture commits on
 * the real branch before being recovered by hand.
 *
 * One shared sanitizer so every `spawnSync('git', ...)` test helper strips
 * the same set of vars, rather than three call sites drifting independently.
 */
const LEAKED_GIT_ENV_PREFIXES = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_CONFIG_', 'GIT_COMMON_DIR'];

export function sanitizedGitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (LEAKED_GIT_ENV_PREFIXES.some(prefix => key === prefix || key.startsWith(prefix))) {
      delete env[key];
    }
  }
  return env;
}
