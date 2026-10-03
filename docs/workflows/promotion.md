# Promotion gate: staging to dev and main

> FRESCO-829. The promotion is a fast-forward mirror push of `origin/staging` to `dev` and `main` (`git_strategy.decisions.promote_method: ff-only`). `bun run git:promote` is the only sanctioned way to do it.

## Why

"What reaches `main` passed the staging PR Check" used to be a comment in `.github/workflows/pr-check.yml`. Nothing enforced it, and the admin who promotes bypasses the required checks. In September 2026, 17 of 179 SHAs reached `main` with the staging run in `failure`, and one promotion went out while the run was still `queued`.

## What the script checks

| Check        | Refuses when                                                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staging run  | the SHA has no `pr-check.yml` push run on `staging`, or the latest one is pending or not `success`                                                               |
| Identity     | any commit in the range has an author or committer `*@example.com`                                                                                               |
| Pull request | a commit has no `(#PR)` in its subject and touches more than docs (`docs/`, `.context/`, root `*.md`, `.agents/**/*.md`, per `git_strategy.policy.docs_changes`) |
| Fast-forward | `dev` or `main` is not an ancestor of the staging SHA                                                                                                            |

Only the latest run counts: a green re-run after a red one passes.

## Usage

```bash
bun run git:promote                              # dry run: shows the verdict, pushes nothing
bun run git:promote --yes                        # pushes staging to dev and main, ff-only, never force
bun run git:promote --yes --override-reason "test:e2e flake, green on re-run <run url>"
```

`--override-reason` waives the staging-run and pull-request refusals only. It is echoed in the output so it leaves a trail. A placeholder identity can never be overridden: fix the commit instead.

## The "merge and level" flow

1. Squash-merge the PR into `staging`.
2. Wait for the `PR Check` push run on the new staging SHA to finish.
3. `bun run git:promote`, read the verdict, then `bun run git:promote --yes`.
4. Transition the Jira ticket and append the `bitacora.md` entry.

Never promote on a `queued` or `in_progress` run, and never reason from tree equality instead of the run.

## Related

- Required checks on the protected branches: `bun run git:checks verify` (FRESCO-781).
- Branch protection parity: `bun run git:policy verify`.
- Source of truth for the strategy: `git_strategy:` in `.agents/project.yaml`.
