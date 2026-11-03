# Audit 8 - axis SUPPLY (supply chain, CI/CD)
Commit: 71ab0864 (staging), date 2026-11-03

## (1) Scope
~22 tool calls. Inspected: `package.json`, `bun.lock` diff 408b5045^..19a195f8 (FRESCO-1081/1082), `bun audit` (read-only), `.github/dependabot.yml`, all 19 workflows (grep of permissions / uses pinning / secrets / run-injection / artifacts; full read of edge-functions-drift, post-deploy-smoke, refresh-mercadona-catalog, parts of stripe-e2e and refresh-supermarket-prices), `.mcp.json`, `vercel.json`, `scripts/vercel-ignore-build.sh`, `.husky/*`, `tests/session-login.ts`, brag `uv.lock`, `.gitignore`, tracked secret-looking filenames (name pattern only), `gh api` GET: fork-pr approval, workflow permissions, Dependabot alerts, secret-scanning alerts, code-scanning, secret names, artifacts list, security_and_analysis.

## (2) Findings
Counts: BLOCKER 0, HIGH 0, MEDIUM 1, LOW 3, INFO 2.

### A8-SUPPLY-01 | MEDIUM | CONFIRMED (presence) / PLAUSIBLE (reachability) | Weekly `bun audit` gate red twice in a row: critical DOMPurify + 2 high happy-dom advisories unremediated
Evidence:
- `bun audit` (run now, read-only): "7 vulnerabilities (1 critical, 3 high, 2 moderate, 1 low)". Critical: `posthog-js > @posthog/browser-common > dompurify` ">=3.4.4 <=3.4.16", GHSA-cg2g-xh64-v4q7 (SAFE_FOR_TEMPLATES bypass); high GHSA-mrv2-3pqr-j5jr (same package). `bun.lock` resolves `dompurify@3.4.16`.
- `package.json:152` override is `"dompurify": "^3.4.16"`, i.e. the floor of the previously fixed version, now itself inside the vulnerable range. npm latest is 3.4.17 (`bun pm view dompurify`).
- Dev-only highs: `happy-dom@20.14.6` (GHSA-834v-8h66-3h79 host code execution via import alias, GHSA-c8p4-j97h-3vg8 SSRF) under `@happy-dom/global-registrator` (tests; Dependabot ignore for the 21.x major at `.github/dependabot.yml`, FRESCO-1055). Moderate: `glob@13.0.6` (latest 14.0.3) and `minimatch@10.2.6` (build/lint chain).
- `gh run list --workflow=dependency-audit.yml`: 2026-11-02 schedule failure, 2026-10-26 schedule failure (last green 2026-10-19). Dependabot open alerts = 0, so the GitHub-side alarm is silent; the weekly workflow is the only signal and it has been red for two Mondays.
Impact: DOMPurify ships in the browser bundle via posthog-js (loaded only after cookie consent, `app/providers/posthog-provider.tsx`); exploitation needs attacker-controlled HTML reaching PostHog's sanitizer (surveys/remote config), i.e. PostHog project compromise, so real exposure is low. The process gap is the finding: a red gate nobody acted on in 8 days, and the dompurify override floor is stale.
Reproduction: `bun audit` in repo root.
Fix: bump override to `"dompurify": "^3.4.17"` (and `glob` to >=14.0.2 if Sentry accepts it, else accept moderate in writing); decide happy-dom 21 upgrade or an audit allowlist entry; make the workflow open an issue on failure (as smoke/stripe-e2e already do) so red is visible. Test: `dependency-audit.yml` green on workflow_dispatch; a test asserting override floors are >= the patched version.
Status vs audit 7: NEW (A7 recorded "bun audit clean"; new advisories since 2026-10-16).

### A8-SUPPLY-02 | LOW | CONFIRMED | `post-deploy-smoke.yml` expands `deployment_status` fields inline in `run:` and passes the same URL to a job holding production test secrets
Evidence: `.github/workflows/post-deploy-smoke.yml:106-108` (`echo "Target URL: ${{ github.event.deployment_status.target_url }}"`), `:123` (`APP="${{ github.event.deployment_status.target_url || ...environment_url }}"` then `curl`), `:145` `PLAYWRIGHT_BASE_URL: ${{ ...target_url }}`. Job env holds `secrets.LIVE_E2E_ENV_FILE` written to `.env` (`:97-102`) and the suite uses the service-role key for session login (`tests/session-login.ts:110-111`). The job `if:` (`:45-47`) trusts `state` and `environment` from the same payload. Secrets are repo-level (no environment protection).
Impact: any actor able to create a deployment status (write access or a leaked token with `repo_deployment`) can set `target_url` to a shell-breaking string (command execution on a runner that holds the secret) or to an attacker site while the browser suite logs in with minted sessions. Needs write access; solo-maintainer repo, so exposure is a stolen PAT/Vercel integration token. A7 labelled this "platform-controlled" and did not report it.
Reproduction: not executed (would trigger a secret-bearing job). Static read only.
Fix: pass the three values through `env:` and reference `"$TARGET_URL"`; validate with a regex `^https://[a-z0-9.-]+\.vercel\.app/?$` before use; store LIVE_E2E_ENV_FILE in a GitHub Environment with a required deployment-branch rule. Test: extend `scripts/ci-secrets-policy.test.ts` to fail on `${{ github.event.* }}` inside `run:` blocks.
Status vs audit 7: NEW.

### A8-SUPPLY-03 | LOW | CONFIRMED | `pr-check.yml` still has no `permissions:` block (A7-SUPPLY-03 second half)
Evidence: `rg -n permissions .github/workflows/pr-check.yml` returns nothing; the other 18 workflows declare it. Repo default is `read` (`gh api .../actions/permissions/workflow` -> `default_workflow_permissions: read`), so effective risk is nil today.
Impact: if the repo default is ever flipped to read/write, the heaviest workflow (runs fork-PR code) silently gains write.
Fix: add `permissions: contents: read` at top. Test: workflow lint asserting every workflow declares `permissions:`.
Status vs audit 7: STILL-OPEN A7-SUPPLY-03 (approval policy half FIXED).

### A8-SUPPLY-04 | LOW | CONFIRMED | `refresh-supermarket-prices.yml` and `spike-supermarket-probe.yml` leave checkout credentials on disk; spike inlines a dispatch input
Evidence: `refresh-supermarket-prices.yml:43-45` `actions/checkout` with `ref: main`, no `persist-credentials: false`, then `bun install` and the step holding `SUPABASE_SERVICE_ROLE_KEY` (`:52-53`); `spike-supermarket-probe.yml:30,40` same pattern and `--mode=${{ inputs.mode }}` inline (it is a `type: choice`, so not injectable).
Impact: token is the job's `contents: read` GITHUB_TOKEN, so impact is small; inconsistent with the other 12 workflows that set `persist-credentials: false`.
Fix: add `persist-credentials: false`; pass `inputs.mode` via env. Test: same workflow lint.
Status vs audit 7: NEW.

### A8-SUPPLY-05 | INFO | CONFIRMED | Owner and admin identities in public repo grew
Evidence: `git grep -c hola.frescoapp@gmail.com` sums to 26 hits (A7: 14); personal addresses still in `.context/bitacora-2026-07-to-2026-08.md` (and quoted in the audit-7 report file). Status: STILL-OPEN A7-SUPPLY-05 (kept LOW there; no new capability, so INFO here). Fix unchanged: placeholders + TOTP on admin account.

### A8-SUPPLY-06 | INFO | CONFIRMED | No CodeQL / code scanning
`gh api .../code-scanning/alerts` -> 404 "no analysis found". Secret scanning, push protection, Dependabot security updates all `enabled`. STILL-OPEN A7-SUPPLY-06.

## (3) A7 findings re-verified
| A7-ID | verdict | evidence |
|---|---|---|
| A7-SUPPLY-01 (.mcp.json @latest, write-capable) | FIXED | `.mcp.json`: context7 `@4.1.1`, mcp-remote `@0.14.3`, varlock `@1.20.0`, supabase `@supabase/mcp-server-supabase@0.13.0 --read-only --project-ref=jdqemhewjrjuopssdurn`; `rg latest .mcp.json` empty. Pinned by `cli/lib/agent-compatibility-contracts.ts` (protected_paths). |
| A7-SUPPLY-02 (secret-scanning alert #1 untriaged) | FIXED | `gh api .../secret-scanning/alerts`: #1 `state: resolved`, `resolution: used_in_tests`. |
| A7-SUPPLY-03 (fork approval first_time_contributors; no permissions in pr-check) | PARTIAL: approval FIXED (`all_external_contributors`), permissions block STILL-OPEN -> A8-SUPPLY-03 |
| A7-SUPPLY-04 (catalog refresh PAT on disk, floating dataset) | FIXED | `refresh-mercadona-catalog.yml:37` `persist-credentials: false`; PAT only in `GH_TOKEN` of the PR step (`:60`); revision resolved by `check-mercadona-dataset-freshness.ts` and passed as `MERCADONA_DATASET_REVISION`. |
| A7-SUPPLY-05 (identities public) | STILL-OPEN | 26 hits now -> A8-SUPPLY-05 |
| A7-SUPPLY-06 (no CodeQL) | STILL-OPEN (INFO) | see above |
| A7-SUPPLY-07 (SUPABASE_ACCESS_TOKEN scope) | STILL-OPEN (INFO) | `edge-functions-drift.yml:84,113,145,152`: token only on deploy/guard/drift steps, `persist-credentials: false`; deploy now waits for green PR Check on the SHA (`:93-110`, FRESCO-1017). Improvement, inherent PAT breadth remains. |
| A7-SUPPLY-08 (CSP wildcards) | not re-probed (no prod request spent; INFO, other axis owns CSP) |

## (4) Checklist items that found NOTHING
- FRESCO-1081/1082 diffs: lockfile changes are version bumps only (10 direct deps plus their Sentry/PostHog/inquirer transitives); no new top-level packages, only `@types/node@26.6.5` nested copies; `trustedDependencies` still `["@sentry/cli"]`; `overrides` unchanged; `.github/dependabot.yml` stripe hold added in 1081 and removed in 1082 (clean). Stripe API version pin moved consistently (lib, edge `deno.json`/`deno.lock`, scripts, tests).
- All `uses:` in 19 workflows are 40-hex SHA pinned (`rg` of unpinned returned nothing).
- No `pull_request_target`, no `workflow_run`; no self-hosted runners.
- Secret list is names only: BACKUP_PASSPHRASE, CATALOG_REFRESH_TOKEN, LIVE_E2E_ENV_FILE, R2_*, SUPABASE_*; full `ENV_FILE` secret gone (FRESCO-853); `pr-check.yml` references no `secrets.*` (builds `.env` from committed `.env.ci` + dummies).
- Artifacts: only `playwright-report/` uploads (pr-check, smoke, stripe-e2e); traces are `on-first-retry`; session-login admin call is Node `fetch` (not Playwright APIRequestContext), so the service-role key is not in traces. 7-day retention.
- Husky hooks: local gates only, no remote fetch. Scripts that hit the network: `fetch-recipe-photos.ts`, `atlassian-url.ts`; the only `curl | bash` text is an install hint string in `cli/preflight.ts` (UI message, not executed).
- `vercel.json` / `vercel-ignore-build.sh`: fails open (builds on doubt); excludes only docs/tests/tooling dirs, `supabase/` and app code always build.
- brag `uv.lock`: urllib3 2.8.0, requests 2.34.2, certifi 2026.10.23 (current); dev-only, `package = false`.
- `.gitignore` covers `.env*` (with `!.env.ci`, `.env.example`, `.envrc` tracked deliberately), `.auth/`, `playwright/.auth`, `supabase/.temp`, `.claude/settings.local.json`. Tracked secret-looking names are docs/tests/`.env.ci` only; no `.pem/.key/.p12`.
- Dependabot alerts: 0 open. Secret scanning + push protection on.

## (5) Could not verify
- Scope of `CATALOG_REFRESH_TOKEN` / `SUPABASE_ACCESS_TOKEN` (GitHub does not expose).
- Whether PostHog surveys (the DOMPurify consumer) are enabled in the PostHog project (needs PostHog console; reachability of A8-SUPPLY-01).
- Webhook list (`gh` lacks `admin:repo_hook`).
- Did not re-run full-history secret scan (A7 did; no new key-shaped filenames in tree).
- Did not trigger `workflow_dispatch` runs (mutating / secret-bearing).

secrets_materialized: none
cleaned: yes
