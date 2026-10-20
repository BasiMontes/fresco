# Audit 7 - axis SUPPLY (supply chain, CI/CD, secrets hygiene)
Commit: 1feb6062 (staging), date 2026-10-16

## Findings
(appended as confirmed)

Counts: BLOCKER 0, HIGH 0, MEDIUM 1, LOW 4, INFO 3. Scope: ~55 tool calls: 17 workflows (grep of triggers/permissions/uses/secrets, full read of cron-heartbeat, edge-functions-drift, refresh-mercadona, stale-branch-cleanup), full-history diff scan (1738 commits, `git log --all -p` through rg for sk_live/sk_test/rk_/whsec_/AKIA/ghp_/github_pat_/xox/SG./re_/sntrys_/private keys/eyJ JWT pairs/user:pass@host URLs), `gh api` (repo security settings, branch protection x3, secret list names, environments, secret-scanning/dependabot/code-scanning), `bun audit`, 4 GET probes of fresco-pro (/, /login, /qa, one chunk + .map), 1 GET of public Supabase /auth/v1/settings with the public anon key, 3 read-only SELECTs (storage.buckets, storage.objects policies, public extensions), `vercel env ls` (names only).

### A7-SUPPLY-01 | MEDIUM | CONFIRMED | Supabase MCP in committed `.mcp.json` runs unpinned with an account-wide access token and write access
Evidence: `.mcp.json:25-41`: `"bunx","-y","@supabase/mcp-server-supabase@latest"` launched under `varlock run --filter SUPABASE_ACCESS_TOKEN`; no `--read-only`, no `--project-ref`. `@upstash/context7-mcp` is also `bunx -y` unpinned (`.mcp.json:4-5`).
Impact: the repo is public and `.mcp.json` is auto-offered to every contributor/agent. A compromised or typosquatted new release of `@latest` executes on the maintainer machine with the personal Supabase PAT (all orgs/projects, incl. the one holding every user's data) and can run DDL/DML. The varlock/Rule-1 discipline protects the token from the AI, not from the package.
Reproduction: read the file; `bunx -y pkg@latest` resolves the newest registry version at each start (no lock).
Fix: pin exact versions (`@supabase/mcp-server-supabase@<x.y.z>`, `@upstash/context7-mcp@<x.y.z>`), add `--read-only` and `--project-ref=jdqemhewjrjuopssdurn` for the default server (separate write profile on demand). Test: extend `lib/no-public-secrets.test.ts`-style lint asserting no `@latest` in `.mcp.json`.

### A7-SUPPLY-02 | LOW | PLAUSIBLE | Open GitHub secret-scanning alert #1 (Stripe webhook signing secret) never triaged
Evidence: `gh api repos/BasiMontes/fresco/secret-scanning/alerts/1`: state open, `publicly_leaked:true`, type `stripe_webhook_signing_secret`, location `.env.ci` line 37 (first commit 6b38a63a, created 2026-09-01). History scan shows `STRIPE_SECRET_KEY=sk_test_*`, `STRIPE_WEBHOOK_SECRET=whsec_*`, `STRIPE_WEBHOOK_SECRET_DEV=whsec_*` introduced in commit 289a39ef (FRESCO-376) in `.env.ci`; header says the overlay isolates CI from prod Stripe. Values are 41 chars each (real Stripe test keys are ~107 chars), so they look like dummies, but I did not and must not compare against real secrets.
Impact: if any value is the real test-mode secret it is public in a public repo (test mode: forged webhooks / API calls on the test account). If dummy, the alert is noise that will mask a real future leak.
Reproduction: open the alert; compare name/length only.
Fix: owner confirms dummy, then close the alert as "used in tests"/false positive (or rotate in Stripe test mode if real). Add a custom pattern/allowlist so future real hits are not drowned.

### A7-SUPPLY-03 | LOW | CONFIRMED | Fork-PR workflow approval is `first_time_contributors` on a public repo
Evidence: `gh api .../actions/permissions/fork-pr-contributor-approval` -> `approval_policy: first_time_contributors`. `pr-check.yml` has no top-level `permissions:` (default workflow permission is `read`, `can_approve_pull_request_reviews:false`, `sha_pinning_required:true`, all good) and uses no `secrets.*` (comment at pr-check.yml:274-281), so no secret exposure.
Impact: after one trivial merged PR, an external account's fork PRs run the 5 heavy jobs (e2e with Supabase stack, ~6 min) without approval: free runner abuse / Actions minutes burn / noisy `Check` statuses, and arbitrary code execution inside runners (no secrets).
Fix: set approval to `all_external_contributors`; add `permissions: contents: read` at top of pr-check.yml (defence if the repo default is ever changed). Pin: a workflow lint test asserting each workflow declares `permissions:`.

### A7-SUPPLY-04 | LOW | CONFIRMED | Scheduled catalog-refresh job keeps a repo-write PAT on disk while running dependency install and scripts on unpinned third-party data
Evidence: `.github/workflows/refresh-mercadona-catalog.yml:25-28` `actions/checkout` with `token: ${{ secrets.CATALOG_REFRESH_TOKEN }}` and default `persist-credentials` (token stored in `.git/config`), then `bun install --frozen-lockfile`, `bun scripts/gen-mercadona-catalog.ts` (fetches `https://huggingface.co/datasets/datania/mercadona-catalog/resolve/main` = floating `main`, `scripts/gen-mercadona-catalog.ts:40`) and pushes a branch + opens a PR. Output uses `JSON.stringify` (line 173) and `mercadona-catalog.test.ts:36` pins `shareUrl` to `https://tienda.mercadona.es/product/` so injection is bounded; the PR needs a human merge, but `require_pr_reviews` is 0 and the solo maintainer merges on green checks.
Impact: a dependency or dataset compromise could use the PAT (scope not visible via API) to push branches/PRs, or ship poisoned prices/links to the shopping list if the merge is rubber-stamped.
Fix: `persist-credentials: false` and pass the token only to the final `git push`/`gh pr create` step; pin the dataset revision (commit hash in URL) and bump it deliberately; use a fine-grained PAT limited to contents+PR on this repo. Test: workflow lint for `persist-credentials` where a PAT is used.

### A7-SUPPLY-05 | LOW | CONFIRMED | Owner and admin account identities published in a public repo
Evidence: `git grep`: `hola.frescoapp@gmail.com` x14, `<admin account>` (`.context/business/business-api-map.md:501`, labelled as the `ADMIN_USER_ID` allowlist account), the admin auth UID in `.context/bitacora-2026-08-to-09.md:34`, personal `basilio.montescastano@gmail.com` and `basi_montes@hotmail.com`. No third-party user PII found (other addresses are example/test domains).
Impact: the single account that can call `delete-catalog-recipe` is publicly identifiable: targeted credential stuffing / phishing / password-reset spam against the one admin.
Fix: replace with placeholders in docs; enforce a 2nd factor (TOTP) on the admin account; consider moving the admin allowlist off a single identity. Test: docs lint rejecting `@gmail.com` outside an allowlist.

### INFO
- A7-SUPPLY-06 INFO: no CodeQL/code scanning configured (`code-scanning/alerts` -> 404 "no analysis found"). Secret scanning, push protection and Dependabot security updates are ON (`security_and_analysis`); `secret_scanning_non_provider_patterns` and validity checks are disabled. Dependabot alerts open: 0; `bun audit` -> "No vulnerabilities found".
- A7-SUPPLY-07 INFO: `SUPABASE_ACCESS_TOKEN` (repo secret) is a personal account token used by the staging-push auto-deploy (`edge-functions-drift.yml:51-63`); it is only exposed to the deploy step (not the install step) and checkout uses `persist-credentials:false`. Inherent token breadth; rotate on a schedule. Secrets exist at repo level, not in the Preview/Production GitHub environments.
- A7-SUPPLY-08 INFO: CSP (`proxy.ts`, live header on fresco-pro) is nonce + `strict-dynamic`, no `unsafe-inline` in `script-src`; `style-src 'unsafe-inline'` documented/accepted; `connect-src` allows `https://*.sentry.io` and `*.posthog.com` wildcards (exfil channel only after an XSS); no `upgrade-insecure-requests` directive (HSTS preload covers it).

## Checklist: items that found NOTHING (or only clean results)
1. Secrets in tree and history: full-history scan found no live-format Stripe live keys, AWS, GitHub tokens, Slack, SendGrid, Resend, Sentry auth tokens, private keys or credentialed URLs. Only hits: `.env.ci` (committed on purpose; Supabase local demo JWTs + dummy Stripe values, see -02), `psql "postgresql://postgres.<project-ref>:Password!@host..."` and `postgresql://user:password@localhost` placeholders, `xoxb-your-token` doc placeholder. `.env` never committed (deleted-file history lists no `.env*`, `.pem`, `.key`, `.auth`). Only `.env.ci`, `.env.example`, `.envrc` tracked. `.auth/` and `.env*` ignored. `.claude/settings.local.json`, `supabase/.temp` not tracked. `supabase/seed.sql` has no emails and no auth.users inserts. Prod JS bundle contains only the anon JWT (role decoded: `anon`). Untracked `.context/audits/2026-10-16-audit-7/` and `revision-alergenos-2026-10-16.csv` are not gitignored: do not `git add -A`.
2. NEXT_PUBLIC: 17 names in code; `NEXT_PUBLIC_TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_API_TOKEN` appear only in `lib/no-public-secrets.test.ts` (a guard test); `vercel env ls production/preview` shows none of them. `next.config.mjs` `env:` inlines only VERCEL_ENV and commit SHA. `server-only` used in service/env modules; no client file reads non-public env.
3. Dependencies: `bun audit` clean, Dependabot 0 alerts, one open Dependabot PR (#694); `trustedDependencies` = `@sentry/cli` only; overrides are security bumps; `deno.lock` exists, edge imports are `npm:` specifiers (supabase-js and stripe exact, `web-push@3` range pinned by lock); no esm.sh/URL imports; no typosquats seen.
4. Actions: no `pull_request_target`/`workflow_run`; all third-party actions SHA-pinned (`sha_pinning_required:true`); no `${{ github.event.* }}` of user-controlled text in `run:` (only `deployment_status` URLs from Vercel in post-deploy-smoke, and `github.event.before`, both env-passed or platform-controlled); monitor workflows pass probe output via `env:` and validate `PROBE_PATH` with a regex; least-privilege `permissions:` in 16/17 workflows; no self-hosted runners; artifacts are Playwright reports only.
5. Next config: headers, CSP, HSTS, X-Frame-Options fine; source maps return 403 on prod; `/ingest` rewrite targets PostHog only; images.remotePatterns restricted to Unsplash and Pexels.
6. Branch protection (main/staging/dev): required checks present, no force-push, no deletion, enforce_admins false (accepted divergence, not re-reported). `git-promote.ts` refuses non-success staging run, placeholder identity.
7. Supabase: local `config.toml` has password min 10, refresh rotation on, jwt_expiry 3600; hosted `/auth/v1/settings`: signup open, `mailer_autoconfirm:false`, anonymous users enabled. Bucket `recipe-photos` is public read, service_role-only write (policies confirmed by SELECT), no size/mime limit (INFO). Only `pg_trgm` in public schema.
8. Scripts: all service-role scripts (clean-*, prune-*, merge-*, backfill-*, apply-photo-generations, refresh-supermarket-prices) default to dry-run and need `--apply`; `seed-e2e-users.ts` refuses non-local URLs; the only CI job with prod service-role (`refresh-supermarket-prices`) is `workflow_dispatch` only with an apply input default off.

## Could not verify
- Hosted Supabase captcha (Turnstile) and SMTP/redirect allowlist: needs Management API token; `/auth/v1/settings` does not expose them. Hosted values of password policy/JWT expiry not readable without it.
- Scope of `CATALOG_REFRESH_TOKEN` and `SUPABASE_ACCESS_TOKEN` (GitHub does not expose).
- Whether `.env.ci` Stripe values are dummies (would require reading values; refused by rule).
- Screenshots in `docs/brand/launch-kit/screenshots/*.png` not inspected for PII.
- GitHub dependabot/hooks scope `admin:repo_hook` missing for `gh`; webhook list unread.

secrets_materialized: none (JWT from public bundle decoded for its role claim only, temp file deleted)
cleaned: yes
