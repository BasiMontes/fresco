# Audit 10 - project maturity pass (agentic-audit, subject=dev, lens=internal)

Date: 2026-11-23. Target: this repository at `8d81367d` (`main`, `staging` and `dev` level). Rubric: `agentic-audit v1`, `references/rubric-dev.md`, local copy of the skill dated 2026-11-22 (the same copy audit 9 used; its upstream commit was not re-checked). Model: Opus 5.5, effort `xhigh`, chosen by the owner for this pass.

## 0. What this pass is, and what it is not

Like audit 9, this pass scores **process maturity against the agentic-dev architecture** on six axes. It is not a security, payments, allergen or privacy audit, even though it read the hosted Supabase security advisor (section 4).

Cadence (required by `audit-process.md` sections 1 and 2): the owner asked for the regular pass on 2026-11-23, brought forward from about 2026-12-03. It runs **one day after audit 9**, so the delta it can measure is the nine audit-9 cards plus one story (FRESCO-1269), not a month of work. Most of what is new below is depth, not change: this pass read things audit 9 did not. No remediation epic is open (FRESCO-986 is `Finalizada`; the open epics are product, maintenance and the parked FRESCO-1261), so section 2 allows a new one for this pass's cards once the owner decides them. If the owner counts this pass as the regular one, the next regular pass falls around 2026-12-23.

Conflict of interest: the auditor is the same agent family that wrote much of this repository and, in this same session, shipped and closed FRESCO-1269. Finding F6 is about that ticket. Weigh axis 6 accordingly.

## 1. Scores

| # | Axis | Audit 10 | Audit 9 | Why it moved |
|---|---|---|---|---|
| 1 | Foundation | **4.0** | 4.5 | Depth, not regression: the glossary and ADR-0001 now contradict shipped behavior (F2, F3), and the canonical maps are a placeholder or a month behind (F4). Audit 9 checked one glossary sentence |
| 2 | Backlog | **4.0** | 3.8 | Audit-9 F1, F2 and F5 are closed. Stories carry criteria; sequencing artifacts are frozen at the MVP spine (F8) |
| 3 | Traceability | **4.7** | 4.5 | 168 of 168 code commits in 30 days carry a key and a PR; 50 of 50 production deployments came from a green staging SHA |
| 4 | Architecture | **4.5** | 4.5 | Unchanged. The hosted security advisor was read live for the first time and every warning holds up as intended (F7) |
| 5 | Verification | **4.5** | 4.7 | The CI gate is as strong as before. New: no agent can validate an authenticated screen on a deployed environment (F5) |
| 6 | Agent discipline | **4.3** | 4.5 | The live-UI credential procedure wrote a password to disk in this pass (F1), and a defect was closed today without two of its close gates (F6) |
| | **Overall (plain mean)** | **4.3** | 4.4 | |

Same rubric, same lens and the same agent family as audit 9, but a deeper reading of axes 1 and 6. `README.md` already warns that the trend is measured by findings closed, not by the score. On that measure, all nine audit-9 findings are closed or accepted (section 3).

## 2. Findings, ordered by return on effort

Severity means cost to the project's own method. There are no BLOCKER findings.

### F1. The live-UI login procedure writes the password into the repo tree (Agent discipline, MEDIUM, real problem)

`live-ui-validation.md` section 3.3 says `--raw fill <ref> "$VAR"` is the only way to type a credential. That flag hides only the echo of the fill command. In this pass, the next `playwright-cli click` (the login button) wrote an automatic snapshot to `.playwright/output/page-2026-11-23T17-25-35-467Z.yml`, and that snapshot held the Free test account's email and password in plain text. The subagent deleted it about three minutes later. I re-checked afterwards with a count-only `varlock` scan, which prints no values: 0 occurrences of any of the six test passwords in `.playwright/`, in the scratch directory, and in the subagent's transcript. So the value never reached tool output. The folder is gitignored, but the ephemeral-artifact contract (`agent-orchestration-detail.md`) forbids session material even in ignored repo paths.

Fix (cheap): in section 3.3, submit the form with `run-code` (which writes no snapshot), forbid `snapshot` or `click` while credential fields are filled, and add a count-only scan of `.playwright/output` after every login. Rule reachability: the rule has to land in the reference, in `sprint-development` `## Compact Rules` and in briefing component 7, not in the reference alone.

### F2. Pro soft preferences reverse ADR-0001's reasoning with no decision record (Foundation, MEDIUM, question)

`ADR-0001-behavioral-learning-moat.md:18` calls declared-preference personalization ("cuisines, dislikes, spice level") "table stakes" and rejects it as the Pro gate: the moat is the cooked/discarded signal. Between 2026-11-17 and 2026-11-18, FRESCO-1226, FRESCO-1227 and FRESCO-1232 shipped favourite cuisines, goal and cooking level as **Pro-only** soft preferences in menu generation. The UI says so: `components/onboarding/onboarding-step-identity.tsx:44`, "Con Pro, tu objetivo inclina el menú hacia lo que buscas." The glossary still bans that framing (`domain-glossary.md:108`: "preferences" used loosely for the Pro-tier value proposition). No ADR after ADR-0070 (2026-11-11), no SRS entry and no glossary row mentions the change.

Question for the owner: is this a deliberate repositioning of what Pro sells? If yes, write ADR-0071 amending ADR-0001 (the alternative it rejected is now partly adopted, and why), and add a glossary row for "soft preference". Cheap.

### F3. The glossary and the SRS say there is no admin role, and there is one (Foundation, LOW)

`domain-glossary.md:30` and `.context/SRS/architecture.md:187` say there is "no `admin`/`user` role distinction anywhere". The code has an admin allowlist (`ADMIN_USER_ID`, FRESCO-237) in `lib/auth/is-admin.ts` and `supabase/functions/_shared/admin.ts`, and it gates `app/(app)/admin/recipes/page.tsx` with `notFound()` for everyone else. It is a sound design (no `is_admin` column, server-side check), just not the one the documents describe. Fix: one sentence in each file.

### F4. The canonical business maps are a placeholder or a month behind (Foundation, MEDIUM, more effort)

- `bun run context:map business-api-context` answers: "holds a PLACEHOLDER map: nothing has been generated yet". The only real API map is the legacy `.context/business/business-api-map.md` (2026-10-20), which `cli/lib/context-maps.ts:46` lists as legacy.
- `business-feature-map.html` was generated on 2026-10-30. Since then 38 `feat` commits reached `main`, among them the Pro preferences, the supermarket price comparison (FRESCO-1222), the onboarding steppers and suggestions (FRESCO-1225, FRESCO-1228) and the first-visit tour (FRESCO-1197). The map mentions no FRESCO-12xx ticket.
- `.context/SRS/functional-requirements.md` and `api-contracts.md` were last touched on 2026-08-29.
- `docs/boilerplate.md:322-324` still points the map commands at the legacy `.md` paths.

Cost: a story that reads its map section for context gets the October product. Fix: run `project-context` modes `api` and `features`, then retire the legacy `.md` copies or mark them as superseded.

### F5. No agent can check an authenticated screen on a deployed environment (Verification, MEDIUM, structural)

Since FRESCO-799 (2026-10-05), hosted Supabase Auth requires a Turnstile token for every password sign-in, whether from the `/login` form or from the API. In this pass, both the Free (`PRE_USER_*`) and the Pro (`PRE_PRO_PLAN_USER_*`) identities stopped at an interactive challenge on `fresco-pre`: the token was still empty after 20 and 40 seconds. The e2e suite gets in through `tests/session-login.ts`, which uses a service-role `generate_link` and is documented as test infrastructure for CI. `live-ui-identity.md` section 3 forbids agents exactly that path, which is right. And because staging and production share one Supabase project (ADR-0020), a Turnstile test sitekey on the staging deploy alone would fail server verification. `live-ui-validation.md` does not mention the captcha, so a `/sprint-development` live-UI check on staging hits this wall unannounced. Two audits in a row are now blind on the authenticated half.

Options, all the owner's call: a headed session where the owner ticks the box and the agent continues (cheap, needed on every run); name the local stack (no captcha) as the sanctioned place for authenticated live-UI checks and say so in section 3; or accept the blind spot in writing. **Update (section 8):** decided the same day, authenticated screens are checked on the local stack, and that run was done.

### F6. FRESCO-1269 was closed today without two of its close gates (Agent discipline, LOW, real problem)

This agent closed FRESCO-1269 as `Finalizada` on 2026-11-23 after the promotion to `main`. `.context/backlog/definition-of-done.md:36` asks of a defect that "the reproduction was reproduced, then is no longer reproducible after the fix", and that `root_cause` is set at close. The fix is covered by unit tests in the same PR, but nobody re-ran the tile-versus-warning reproduction on a deployed environment (F5 blocked the attempt in this pass), and `root_cause` is empty. It is the only one of the 15 defects since 2026-10-15 with neither field. Fix: fill `root_cause`, and verify the reproduction on staging (needs F5) or move the ticket back to `Merged` until someone does. **Update (section 8):** `root_cause` was filled (`code_error`) and the reproduction repeated on the local stack with Free and Pro; FRESCO-1276 is `Finalizada`.

### F7. The Supabase advisor's warnings hold up, but nothing records that (Architecture, LOW)

Read live today (first time a pass reads hosted settings): 29 WARN and 17 INFO.

- **11 `SECURITY DEFINER` functions executable by `authenticated`.** Each one filters by `auth.uid()`, and `anon` cannot execute any of them (`pg_get_functiondef` and `has_function_privilege`, read-only).
- **16 anonymous-sign-in warnings.** These are guest-mode policies scoped to the user's own rows, plus two Supabase-managed `cron` tables.
- **Leaked password protection.** It needs Supabase Pro; `lib/validation/pwned-password.ts` covers it in the app.
- **17 tables with RLS and no policy.** All are service-role-only tables, as documented, for example `stripe_webhook_events` in the data map.

All of it is by design, and none of it is written down as accepted, so every pass and every agent that runs `get_advisors` re-investigates it, as this one did. Fix: an accepted-advisor list with the reason per lint, modelled on `git_strategy.policy.accepted_divergences`.

### F8. The sequencing artifacts stopped at the MVP spine (Backlog, LOW, question)

`.context/dev-roadmap.md` says "Edges last updated: 2026-10-04", and `master-implementation-plan.md` was last touched on 2026-10-05. Both describe the MVP master sprints. The eight open product and maintenance epics (FRESCO-865 to FRESCO-884 and others) have no dependency order anywhere. Question: are these files retired now that the work runs by epic and batch? If yes, say so in their headers. If not, refresh them.

### F9. Closing criteria on tasks (Backlog, INFO, forward only)

November cards excluding `Aplazada` and `Rechazos`: stories 18 of 19 carry a criteria or verification section, tasks 98 of 162 (60%), defects 3 of 6. Jira text search is fuzzy, so treat these as approximate. The `## Criterio de cierre` convention was decided on 2026-11-23 (FRESCO-1253), so these cards predate it; re-measure next pass. Note that `scripts/sync-jira-issues.ts:1415` extracts only `Criterio de cierre`, while many older stories use a `Verificación` heading.

### F10. The e2e job is creeping toward the ADR-0018 early warning (Verification, INFO)

The 12 latest green `test:e2e` jobs on `staging` averaged 365 s (max 393 s). 2 of the 12 were at or over 390 s, but not consecutive, so the ADR-0018 trigger ("~6m30s sustained, two consecutive runs") has not fired. `audit-process.md` section 4 still says "~5.5 min". Nothing measures the trigger automatically. Watch it; do not act yet.

### F11. Two branch prefixes outside the declared list (Traceability, INFO, pattern deviation)

140 of the last 150 merged PR branches follow `{prefix}/FRESCO-N-slug`. `ci/FRESCO-1202-…` and `perf/FRESCO-1145-…` use prefixes that `git_strategy.branch_prefixes.precedence` does not list. Add them, or not; no cost either way.

## 3. Audit 9 findings, re-checked

| Audit 9 | State | Checked today with |
|---|---|---|
| F1 criteria convention | Closed | `scripts/sync-jira-issues.ts:1415` extracts `## Criterio de cierre`; stories 18 of 19 carry criteria |
| F2 cards without epic | Closed | open-card JQL from `audit-process.md`: **0** |
| F3 ADR count in glossary | Closed | no count sentence in `domain-glossary.md` |
| F4 audits index | Closed | rows for audits 7b, 8 and 9 in `README.md` |
| F5 FRESCO-986 | Closed | not among the open epics |
| F6 history | Accepted | `audit-process.md`, "Accepted history" |
| F7 `revalidate` | Closed | 0 in `app/page.tsx` |
| F8 policy stamp | Closed | `policy_verified: 2026-11-23` |
| F9 scenarios | Classified | from the 2026-11-23 re-measurement, not re-run; 15 `@pendiente` remain in FRESCO-1262 to FRESCO-1267 |

## 4. What the evidence supports

Measured or quoted, not general praise.

- **Every code change is traceable.** On `main` since 2026-10-23: 325 of 325 first-parent commits are conventional; 168 of 168 `feat`, `fix`, `refactor` and `perf` commits carry a `FRESCO-` key and a `(#PR)`; 318 of 321 non-bot commits carry the `Session:` trailer (the three without it are the automated catalog-refresh PRs #832, #922 and #950). No AI attribution since 2026-10-15. Commit size over the last 200: median 2 files, p90 10, max 45.
- **The promotion gate works.** 50 of 50 production deployments since 2026-10-23 came from a SHA whose latest staging `PR Check` succeeded. In September, before `git:promote`, 17 of 179 SHAs reached `main` with a failed staging run.
- **The merge gate is live, not documented.** The five required checks are enforced on `main`, `staging` and `dev` (`gh api`, today). The pre-push runs a Bun version guard and the framework gates; `test:coverage` runs in CI with a ratchet floor; the post-deploy smoke ran green on today's production deployments.
- **Defects are filed properly.** For the 15 `Error` cards since 2026-10-15: severity 15 of 15, evidence 15 of 15, error type 14 of 15, root cause 12 of 15.
- **The layering holds.** `cycles:check`: 483 files, no cycle. Zero imports from `lib/` into `components/` or `app/`, and zero from `components/` into `app/`. The three real hex values in components are the Open Graph image (Satori cannot read CSS variables), the browser `themeColor`, and a documented `color-mix`.
- **The database boundary holds where the linter worried.** Every `SECURITY DEFINER` function an authenticated user can call is bounded by `auth.uid()`, and none is executable by `anon`.
- **The test infrastructure names its own risk.** `tests/session-login.ts`: "it must never be pointed at an account that is not a test account."
- **False positives are discarded after measuring, in writing.** `.context/bitacora.md`, 2026-11-20: the lazy logo and the two `@font-face` rules without `font-display` "eran falsos positivos (FRESCO-504; caras de respaldo de `next/font`), no se tocaron."
- **The audits correct themselves.** The audit 9 re-measurement states its own conflict of interest and fixes two wrong figures in the original report.

## 5. Live surface

Read-only, through one subagent on `fresco-pre`.

- **Authenticated half: not reached** (F5). Both identities stopped at the Turnstile challenge. The Pro credentials were never typed.
- **`/login`, anonymous, at 390 and 1440 px.** `lang="es"`, one `h1`, no heading skips, 0 of 2 images without `alt`, no horizontal overflow. The only target under 44 px is the visually hidden skip link. `responseStart` 119 ms, `domContentLoadedEventEnd` 1616 ms.
- **Console.** 7 errors, all from inside the Cloudflare Turnstile frame (its own CSP refusing `data:`), 0 from the app.
- **Two non-issues.** The Turnstile text uses "usted" ("Verifique que es un ser humano") while the app uses "tú"; that text is the widget's own. Four of five protected routes keep `?next=` on the anonymous redirect, and `/menu` does not, which looks intended because `/menu` is the default landing.

Screenshots (scratch, not committed): `login-captcha-blocked-390.png` and `login-captcha-blocked-1440.png` in this session's scratch directory under `audit10/live/`.

## 6. Blind spots

- **The authenticated app was not exercised on a deployed environment**, for the second pass running (F5); it was measured afterwards on the local stack (section 8). Plan gating, the FRESCO-1269 budget check on a real menu and `/menu` timings are unmeasured. The admin role was never measured live in any pass.
- **Hosted settings.** Only the Supabase security advisor and function definitions were read. The performance advisor, Vercel project settings and Auth settings were not.
- **`.env.ci` is tracked and was not opened**, per `AGENTS.md` rule 1, same as audit 9.
- **Backlog counts come from Jira text search**, which is fuzzy. A criterion written under another heading or in a comment is not counted.
- **Test quality was counted, not sampled.** No mutation run.
- **The 15 `@pendiente` scenarios** were not re-checked against their cards.

## 7. Suggested order of work (not a plan, no cards created)

1. **F1:** fix the login procedure and propagate it to the Compact Rules, before the next live-UI run.
2. **F6:** fill `root_cause` on FRESCO-1269, and decide where it waits until its reproduction is re-run.
3. **F2 and F3:** answer the Pro-preferences question; then one ADR and three sentences.
4. **F5:** decide how authenticated screens get checked (headed tick, local stack, or accepted blind spot).
5. **F7 and F8:** an accepted-advisor list; retire or refresh the roadmap files.
6. **F4:** regenerate the API and feature maps.
7. **F9 to F11:** re-measure next pass.

## 8. Addendum (2026-11-23, after the report): the authenticated half, measured on the local stack

The same day the owner decided that authenticated screens are checked on the local stack (FRESCO-1275), and it was run: Free and Pro, at 390 and 1440 px, through the app's own login form, with a menu generated by the Edge Functions. One subagent, read and write allowed because the database is disposable.

**A first attempt failed because of this pass's own setup, not the app.** The dev server picked up `NEXT_PUBLIC_TURNSTILE_SITE_KEY` from the developer's `.env*` files, so `/login` showed a real Turnstile that a headless browser cannot pass. The local Supabase has no captcha; the CI forces that variable empty last (`pr-check.yml`). The documentation written for FRESCO-1275 said "the local stack has no captcha" without that condition, and it is corrected.

Results, measured and then re-checked by the orchestrator where noted:

| Check | Free | Pro |
|---|---|---|
| Login through the form | works | works |
| Plan shown on `/profile` | Free, with the Pro offer | Pro, "Gestionar mi suscripción" |
| Routes (`/menu`, `/calendar`, `/shopping-list`, `/recipes`, `/profile` and the header routes) | `lang="es"`, one `h1`, no heading skips, no `img` without `alt`, no horizontal overflow | same |
| FRESCO-1269 budget reproduction | tile 168,75 €: budget 153 gives a warning of 15,75 € (168,75 − 153), 100 gives 68,75 €, 189 and 500 give none | tile 121,61 €: budget 106 gives 15,61 €, 142 and 500 give none |
| `/menu` timings (dev mode, not comparable with production) | 240 ms to first byte, 310 ms to DOM content | 230 ms, 266 ms |
| Credential left on disk | 0 occurrences, re-counted by the orchestrator | 0 |

- **F6 is closed on evidence:** the warning comes from the same figure as the tile and its overage is that figure minus the budget, to the cent, for both plans.
- **Plan gating holds.** Free sees the note that its marks are not applied to its menus and the Pro offer; Pro sees none of that. Goal, level and favourite cuisines are selectable by Free with copy saying they only shape the menu in Pro, which is what ADR-0071 describes. Nothing Pro is unlocked for Free and nothing is locked for Pro.
- **One console error, not a defect.** The first visit to `/shopping-list` logs a `409` from `generate-shopping-list`. `shopping-list-generator.tsx` treats a `409` as "the list already exists" and just re-reads, and in development React runs effects twice, which sends the second request. It was not checked against production.
- **Observations, not scored:** icon buttons and calendar arrows measure 36 to 38 px (the 44 px comfort guideline, not the WCAG 2.5.8 minimum); the weekly budget can only be edited in onboarding step 3, and a fresh load of that step shows the field empty instead of prefilled; the recipe tab title is the generic "Receta · Fresco" on purpose (FRESCO-966, WCAG 2.4.2). One more observation was not verified: the Free summary showed "Cocinas favoritas: Española" without the subagent choosing it.
- **Still not measured:** anything that only exists on a deployment (Vercel behaviour, hosted Auth settings, the real catalog and photos, which show a letter placeholder locally), extra menus, favouriting, marking recipes cooked or discarded, the billing flow, `/recipes/<id>` as Pro, and the admin role.

The scores in section 1 are not changed. This half found no new defect, and the changes of the day (F1 to F8) are tracked in FRESCO-1270.
