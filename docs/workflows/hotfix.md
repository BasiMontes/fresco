# Hotfix runbook (solo-main)

> Emergency-fix path for Fresco. Git strategy is `solo-main`
> (`.agents/project.yaml` → `git_strategy`): there is **no `hotfix/*` branch and
> no back-merge ceremony** — an emergency fix is a normal change to `main`, made
> fast. `dev`, `staging`, `main` are kept byte-identical by fast-forward-only
> pushes; production is `fresco-pro.vercel.app` (auto-follows `main`).

## 0. Triage — rollback or forward-fix?

| Situation | Path |
|---|---|
| Prod is broken, fix is not obvious | **Rollback first** (§1), debug after |
| You know the one-line fix | **Forward-fix** (§2) — faster than rollback + re-deploy |
| Bug is in a DB migration / stateful change | Rollback does **not** undo DB changes — roll back the deploy, then run the down-migration separately |
| Bug is an env var, not code | Fix via `vercel env`, redeploy from cache — no rollback, no commit |

## 1. Rollback (buy time)

Full detail: `/vercel-cli` skill → `references/rollback.md`. Short form:

```bash
# previous good production deploy
vercel ls --prod --status READY --format json \
  | jq -r '.deployments[1].url'

vercel rollback <that-url>
vercel inspect fresco-pro.vercel.app --wait --timeout=2m
```

`vercel rollback` re-aliases the production domain within seconds. It does not
delete the broken deploy. Then go to §2 for the real fix.

## 2. Forward-fix

```bash
# 1. branch off dev (dev == main right now — they're mirrors)
git checkout dev && git pull origin dev
git checkout -b fix/FRESCO-<id>-<slug>

# 2. make the fix. verify locally (scripts from package.json):
bun run test               # unit tests (bun test)
bun run repo:check         # format + lint + types + vars + skills

# 3. commit (atomic, conventional, no AI attribution)
git add <explicit paths>
git commit -m "fix(FRESCO-<id>): <what>"

# 4a. NORMAL urgency — open a PR, let CI gate it
git push -u origin fix/FRESCO-<id>-<slug>
gh pr create --base dev --fill
gh pr merge --squash --delete-branch   # squash is the only method enabled

# 4b. TRUE emergency, CI too slow — push straight to dev, then mirror forward
git checkout dev && git merge --ff-only fix/FRESCO-<id>-<slug>
git push origin dev
```

## 3. Propagate to production

`dev` → `staging` → `main` are fast-forward mirror pushes (never `--no-ff`,
never squash on the mirror hop):

```bash
git push origin origin/dev:refs/heads/staging
git fetch origin
git push origin origin/staging:refs/heads/main
```

Then confirm the branches match and prod redeployed:

```bash
git fetch origin
for b in dev staging main; do echo "$b: $(git rev-parse --short origin/$b)"; done
vercel inspect fresco-pro.vercel.app --wait --timeout=3m
```

The `post-deploy-smoke.yml` workflow runs the `@smoke` suite against production
on the `deployment_status` event (FRESCO-311). Watch it:
`gh run watch $(gh run list --workflow=post-deploy-smoke.yml -L1 --json databaseId -q '.[0].databaseId')`.

## 4. Close out

1. Log the incident in `.context/bitacora.md` (date, what broke, fix, next).
2. Jira: the fix ticket → `Finalizada`; set `severity` + `root_cause` on it.
3. If a broken deploy was rolled back, label it in the Vercel dashboard so it
   is not re-promoted.

## Worked example — FRESCO-297 (2026-08-27)

The authenticated app broke on `fresco-dev.vercel.app`: the Edge Function CORS
allowlist (`supabase/functions/_shared/cors.ts`) had a hardcoded origin list
that never included the `dev` domain, so `/menu`, `/calendar`, `/shopping-list`
got CORS-rejected on every Edge call.

- **Triage:** forward-fix — root cause was obvious (missing origin), no rollback
  needed, no DB involved.
- **Fix:** added `fresco-dev.vercel.app` to `ALLOWED_ORIGINS`, redeployed the 6
  Edge Functions. Second commit dropped a misleading empty-state banner.
- **Delivery:** `fix/FRESCO-297-cors-dev-origin-and-menu-empty-state` → PR #156
  → squash-merge → ff mirror to `staging` + `main` → Vercel prod redeploy.
- **Elapsed:** ~2 commits, well under the 20-minute emergency budget. Runbook
  above is the path that was actually walked.

> The `direct_push_to_protected: allowed` policy means step 4b is available
> without a confirmation ceremony — use it only when CI latency is the actual
> blocker, not by default.
