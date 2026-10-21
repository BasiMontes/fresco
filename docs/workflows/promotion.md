# Promotion gate: staging to dev and main

> FRESCO-829. The promotion is a fast-forward mirror push of `origin/staging` to `dev` and `main` (`git_strategy.decisions.promote_method: ff-only`). `bun run git:promote` is the only sanctioned way to do it.

## Why

"What reaches `main` passed the staging PR Check" used to be a comment in `.github/workflows/pr-check.yml`. Nothing enforced it, and the admin who promotes bypasses the required checks. In September 2026, 17 of 179 SHAs reached `main` with the staging run in `failure`, and one promotion went out while the run was still `queued`.

## What the script checks

| Check        | Refuses when                                                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staging run  | the SHA has no `pr-check.yml` push run on `staging`, or the latest one is pending or not `success`                                                               |
| Identity     | any commit in the range has an author or committer `*@example.com`                                                                                               |
| Pull request | a commit has no `(#PR)` in its subject and touches more than docs (`docs/`, `.context/`, root `*.md`, `.agents/**/*.md`, per `git_strategy.policy.docs_changes`). A merge commit is judged by the files it brings in against its first parent (FRESCO-1039), so a merge that only carries docs passes and one that carries code still needs a `(#PR)` |
| Fast-forward | `dev` or `main` is not an ancestor of the staging SHA                                                                                                            |

Only the latest run counts: a green re-run after a red one passes.

It also **warns, and never refuses**, about migrations (FRESCO-1023). A merge or a promotion does not apply a migration: it goes by hand with `supabase db push --linked`, and a deployment that reaches production first breaks whatever calls the function or column it creates (`record_consents` answered 404 after the promotion of 2026-10-19, and the same happened with FRESCO-770). After the gate passes, the script compares the migration files of the SHA with `supabase migration list --linked` and prints one of:

| Line | Meaning |
|---|---|
| `✔ migrations: all N migrations in this SHA are applied` | nothing to do |
| `! migrations: K migration(s) ... are NOT applied` | lists them; apply with `supabase db push --linked --dry-run`, then without `--dry-run`. Apply them **before** promoting when the code calls something they create, after is fine when they only change data |
| `! migrations: could not read the hosted migration list` | the Supabase CLI is missing, not logged in or the project is not linked, so nothing was checked: run `supabase migration list --linked` by hand |

It is a warning because a pending migration is sometimes intended (a data migration applied right after the promotion). The exit code is not affected.

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

## Cadence: accumulate in `staging`, promote in batches (FRESCO-925)

**The rule.** PRs land on `staging` as they are ready. `main` gets them in a batch, through `bun run git:promote`, never one promotion per ticket and never on a run that has not finished. The founder asked for this on 2026-10-12.

**Why.** Every push to `main` is a production deployment, and the Vercel Hobby plan caps deployments per day (100) and function storage (the 10 GB cap was hit on 2026-10-12, FRESCO-903 and FRESCO-906). The audit of 2026-10-12 counted 18 deployments one day and 30 the day before, 4 and 7 of them to production. Previews count too: every push to a PR branch makes one.

**What a batch is.** Everything that is ready and green on `staging` when you decide to promote. There is no fixed number per day, because a cap would also block an urgent fix. The exception is the hotfix path (`docs/workflows/hotfix.md`), which is its own promotion on purpose. When in doubt, wait for the next ticket to be ready before spending a production deployment.

**What enforces it, and what does not.**

| Part | Enforced by |
|---|---|
| What reaches `main` (a finished successful staging run, real identities, a PR for code) | The script `git:promote`: it refuses otherwise. |
| How often you promote | Nothing automatic: it is a convention of one maintainer. A hard cap would block the one case where promoting twice in a day is right. |
| `enforce_admins` on the protected branches | **Decided not to enable it** (accepted 2026-10-03, FRESCO-831). Promotion is a fast-forward mirror push, never a PR, so `enforce_admins` would block it; the compensating control is `git:promote`. The full text and the conditions to reopen it are in `.agents/project.yaml`, `git_strategy.accepted_divergences`. |

**Measure it** instead of guessing (production deployments per day, and all of them, from the GitHub deployments API; it returns the latest 100, so it covers about the last three days):

```bash
gh api "repos/BasiMontes/fresco/deployments?per_page=100" \
  -q '[.[] | select(.environment=="Production")] | group_by(.created_at[0:10]) | map({day: .[0].created_at[0:10], n: length})'
gh api "repos/BasiMontes/fresco/deployments?per_page=100" \
  -q 'group_by(.created_at[0:10]) | map({day: .[0].created_at[0:10], n: length})'
```

On 2026-10-13 and 2026-10-14 production got 3 and 2 deployments a day and all environments together 43 and 38, so the daily cap of 100 is the number to watch, not the production count: previews are most of it.

**Revisit** if a day gets near 100 deployments, if a second committer joins, or if a promoted SHA reaches `main` with a red staging run despite `git:promote`.

## Related

- Required checks on the protected branches: `bun run git:checks verify` (FRESCO-781).
- Branch protection parity: `bun run git:policy verify`.
- Source of truth for the strategy: `git_strategy:` in `.agents/project.yaml`.
