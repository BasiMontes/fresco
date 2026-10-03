// FRESCO-837: git exports GIT_DIR (and friends) to hooks run from a linked
// worktree. A test that shells out to `git -C <tmp> config user.email ...` then
// writes into the repo GIT_DIR points at, because the variable beats `-C`. That
// leaked `test@example.com` into the real `.git/config` and signed 78 commits.
// Tests that spawn git on a throwaway repo must pass this environment.
const REPO_OVERRIDES = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE'] as const;

export function gitEnvWithoutRepoOverrides(source = process.env) {
  const env = { ...source };
  for (const key of REPO_OVERRIDES) { delete env[key]; }
  return env;
}
