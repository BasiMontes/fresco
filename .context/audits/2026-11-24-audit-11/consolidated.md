# Audit 11 - project maturity pass (agentic-audit, subject=dev, lens=internal)

Date: 2026-11-24. Target: this repository at `3809de78` (`main`, `staging` and `dev` level). Rubric: `agentic-audit v1`, `references/rubric-dev.md`, the same local copy of the skill as audits 9 and 10 (file dated 2026-11-22; its upstream commit was not re-checked). Model: Opus 5.5, run as one subagent of the orchestrating session. Re-audit of audit 10 (2026-11-23, `8d81367d`, 4.3/5).

## 0. What this pass is, and what it is not

Same scope as audits 9 and 10: process maturity against the agentic-dev architecture, on six axes. It is not a security, payments, allergen or privacy audit, although it re-read the hosted Supabase security advisor (section 4).

**Cadence.** This is the third pass in three days: audit 9 on 2026-11-22, audit 10 on 2026-11-23, this one on 2026-11-24. The measurable delta is 32 first-parent commits in about 28 hours: the audit-10 remediation (FRESCO-1271 to 1282), FRESCO-1249, FRESCO-1251 in three phases, FRESCO-1262 to 1267, FRESCO-1283 and two Dependabot PRs. `audit-process.md` §1 calls passes this close "measurement churn" (F9). §2 is satisfied: FRESCO-1270 and its 11 children are `Finalizada` (Jira, read today), so no remediation epic is open and a new one is allowed once the owner decides these findings. The pass was requested through the orchestrating session; the owner's own reason for running it before the next regular date was not visible to this pass, so it is not recorded here, and §2 asks for it. **Owner decision, recorded on 2026-11-24 after delivery:** an off-cycle pass by owner decision; the next regular pass still counts from audit 10 (around 2026-12-23). No remediation epic was open at that moment: FRESCO-1270 and its 11 children were `Finalizada`. The findings went to the new epic FRESCO-1287, F1 on its own card and the low and informative findings grouped into one hygiene card per axis (FRESCO-1288 to 1293).

**Conflict of interest.** The auditor is the same agent family that wrote much of this repository. All 30 non-bot commits in the window carry an agent `Session:` trailer; none was written in this session. Weigh axes 3 and 6 accordingly.

**Constraints set by the brief.** Read-only on the repository; no login on any deployed environment; no local dev server and no local Supabase stack. The last one means the chaos exercise that `audit-process.md` §6 asks of every pass ran only in its stack-free part, `chaos:stripe-stall` (F8).

## 1. Scores

| # | Axis | Audit 11 | Audit 10 | Δ | Why it moved |
|---|---|---|---|---|---|
| 1 | Foundation | **4.4** | 4.0 | +0.4 | A10-F2, F3 and F4 are closed at the destination: ADR-0071 amends ADR-0001, the glossary and the SRS name the admin allowlist, the API map exists and 19 of 30 feature-map sections were regenerated. Residue: the data map is 24 migrations behind (F6) |
| 2 | Backlog | **4.2** | 4.0 | +0.2 | All 32 non-epic cards created since the convention, read one by one, carry `## Criterio de cierre` and an epic; the roadmap files are retired by a recorded decision. New gap: defects found by chaos runs are typed `Tarea` (F1) |
| 3 | Traceability | **4.7** | 4.7 | 0 | 32 of 32 commits conventional, 13 of 13 code commits with key and PR, 30 of 30 with both forensic trailers, 4 of 4 production deployments from a green staging SHA. One promotion override with no durable reason (F4) |
| 4 | Architecture | **4.5** | 4.5 | 0 | A10-F7 is closed: the accepted-advisor list exists and its four checks return 0 rows today. Offset by what the chaos runs exposed: the Stripe client waits 241 s before giving up (tracked in FRESCO-1285) |
| 5 | Verification | **4.6** | 4.5 | +0.1 | A10-F5 closed by decision (the local stack is the sanctioned place) and A10-F10 by a script. New, both LOW: the flake card counts relaunches, not failures (F2); 58 of 59 manual-only scenarios have no current verification (F5) |
| 6 | Agent discipline | **4.4** | 4.3 | +0.1 | A10-F1 and F6 are closed with evidence. But FRESCO-1283 was closed on "commit on main and deploy success" with its planned live re-run skipped: the shape of A10-F6, one day later (F1) |
| | **Overall (plain mean)** | **4.47** | 4.33 | +0.13 | Two decimals so the mean is not rounded up; audit 10 published its 4.33 as 4.3 |

`README.md` still applies: the trend is measured by findings closed, not by the score. On that measure all 11 audit-10 findings are closed, two of them with a residue (section 3).

## 2. Findings, ordered by return on effort

Severity means cost to the project's own method. There are no BLOCKER or HIGH findings. "Carried" means the finding continues an audit-10 finding; "new" means it was not there, or not visible, a day ago.

### F1. Defects found by chaos runs are typed `Tarea`, so the defect close gate never runs (Agent discipline, MEDIUM, real problem, carried in shape from A10-F6)

FRESCO-1283 and FRESCO-1284 describe user-visible wrong behaviour found by the FRESCO-1251 runs: after a lost response the screen asks the user to delete the menu they just generated (1283), or reverts a mark the server already saved and says "Vuelve a intentarlo" (1284). Both are typed `Tarea`. `definition-of-done.md:36` binds its Defect row to the `Error` type: the reproduction is reproduced, then no longer reproduces after the fix, and `severity`, `error_type` and `root_cause` are set. As a `Tarea` none of that applies, and the checks built for defects never see them. `scripts/check-closure-evidence.ts:74-81` judges only `Error` cards ("Other ticket kinds are never judged here"), so it printed "Defects without an epic or a link: 0" today; typed as `Error`, the resolved FRESCO-1283 (epic FRESCO-884, no issue link) would have been listed as missing a link and the check would exit 1. The count of `Error` cards since 2026-10-15 is still 15, the same as in audit 10.

What it cost already: the fix plan for FRESCO-1283 (Jira comment 1) listed step 4, "Comprobación en vivo en la pila local repitiendo E1". Comment 2: "Sin verificar: no se repitió E1 en vivo desde la pantalla en la pila local." Comment 3 closed the card on "el código ya está en main ... deploy ... estado success". A deploy status is a receipt for the call, not the outcome (`AGENTS.md` rule 16). The chaos registry has no row re-running E1 after the fix, although its own precedent is to re-run after a fix (the `db-restart` row after FRESCO-1250, the timeout row after FRESCO-1249), and `docs/workflows/chaos-experiments.md:163` still says in the present tense that the weakness exists. Nothing schedules the re-run: the per-pass list (lines 228-235) covers `flows`, the four infrastructure faults and `stripe-stall`, not E1 to E4. A10-F6 was closed by re-running FRESCO-1269's reproduction once, not by a rule, and the gap came back on the next defect.

What limits the damage: the fix shipped its tests in the same PR (#1078), the second comment says the three new tests fail with the helper reverted, and the unverified part was written down.

Fix (about an hour): decide in `definition-of-done.md` whether a chaos weakness with a user-visible effect is a defect; if yes, retype FRESCO-1283 and FRESCO-1284 as `Error` with the QA fields. Re-run E1 on the local stack and add the dated row. Add "re-run the experiment after its fix and record the row" to step 4 of "Cómo añadir un experimento".

### F2. The flake card counts relaunches, not failures, and missed today's recurrence (Verification, LOW, real problem, new)

Staging push run 45422579978 (commit `4c310e59`, 2026-11-24 15:11Z) failed `test:db-integration` with 761 pass and 62 fail, every failure a "real functions runtime" HTTP test timing out at 5000 ms. The diagnostic step added in #1022 printed the first cause candidate: `supabase_edge_runtime_fresco   Exited (135) 6 minutes ago`, a SIGBUS of the edge runtime container. The run was not relaunched; the next push was green. FRESCO-1219, which tracks this flake, is `WIP`, its last comment is from 2026-11-22, and its closing criterion is "14 días seguidos sin relanzar ningún job del PR Check ... y causa identificada si vuelve a fallar db-integration". A failure that the next push supersedes is never counted, so the card can close on 2026-12-05 with this recurrence inside its window. The chaos commits in that push touched only `docs/` and `scripts/chaos/`, so they are not the cause.

The gate behaved: in the same minute `edge-functions-drift.yml` refused to deploy ("PR Check on 4c310e59 concluded failure; Edge Functions NOT deployed").

Fix (15 minutes): add the occurrence and the exit code 135 to FRESCO-1219, and count failed `test:db-integration` runs with the whole-block signature instead of relaunches.

### F3. The open resilience cards are well written; two tracking gaps (Backlog, LOW, tracking of known follow-ups)

FRESCO-1284, 1285 and 1286 are not re-reported. Each carries context, measured evidence, the files to change and a testable `## Criterio de cierre`, and this pass reproduced FRESCO-1285's figure: `bun run chaos:stripe-stall` gave up after **241.0 s** with 3 connections, the same as the registry. Two gaps:

- **FRESCO-1285 does not name the subscription portal, which shares its cause.** `app/api/stripe/portal/route.ts:5,82` uses the same `stripe` client, built with `apiVersion` only (`lib/stripe.ts:85-89`), and `components/profile/manage-subscription-button.tsx:30` posts to `/api/stripe/portal` with no `AbortSignal`. Changing `lib/stripe.ts` covers the server half; the button and the closing criterion do not.
- **Only FRESCO-1286 links to FRESCO-1251**, whose runs found all four cards. FRESCO-1283, 1284 and 1285 name it in their text and carry no link. With the roadmap retired (FRESCO-1278), the tracker is the only source of order and blockers.

Fix (5 minutes): add the portal to FRESCO-1285's scope and criterion, and add the `Relates` links. The type of FRESCO-1284 is F1.

### F4. A promotion override leaves no durable reason, and one was used outside the two documented cases (Traceability, LOW, real problem, new)

`.context/bitacora.md:214`: the promotion of `ebc08055` (it touches `.agents/project.yaml`, no PR) was refused by `git:promote` and "salió con `--override-reason` autorizado por el dueño". The same promotion carried `3f1aab21`, a direct commit that changed `.agents/skills/sprint-development/SKILL.md`, `.agents/skills/REGISTRY.md` and `.agents/instructions/agent-project.md`. Neither commit fits `git_strategy.policy.docs_changes` (`docs/**`, `.context/**`, root `*.md`, `.agents/*.md`). `docs/workflows/promotion.md:28,38` documents the override for "a confirmed flake or a data migration" and says the reason "is echoed in the output so it leaves a trail". The echo lives in a terminal, and the log line does not quote the reason. Because `enforce_admins` is off by an accepted divergence, `git:promote` is the compensating control, and an override nobody can read back weakens it. The project corrected course the next day ("lo de skills va por PR", bitácora of 2026-11-24), and the later skill changes went through #1061 and #1062.

Fix (30 to 60 minutes): make `git:promote --override-reason` append the date, the SHA and the reason to a tracked file, or require a ticket key in the reason.

### F5. 58 of 59 deliberately manual scenarios have no current verification (Verification, LOW, real problem, new)

`.context/qa/regression.feature` holds 214 scenarios: 155 tagged `@automatizado`, 59 `@solo-manual`, 0 `@pendiente` (A9-F9 is fully closed). The file's own rule (lines 10-14) says a `@verificado-manual-YYYY-MM-DD` stamp older than six weeks "ya no cuenta como garantía vigente". 43 of the 59 carry a stamp: 42 are older than six weeks (the oldest from 2026-07-29) and one is from 2026-11-24 (the admin 404 that FRESCO-1267 verified that day); 16 carry none. On a rough reading of the reason comments, 26 of the 59 point at a test that guards the behaviour and 33 (15% of the catalogue) do not; that split was not verified scenario by scenario. Nothing re-verifies the set on a schedule, so by the project's own standard 58 of the 59 have no current proof. *Corrected on 2026-11-24, after delivery: the first version said 33 stamped and 26 unstamped, the newest from 2026-08-19; the recount reads the tags of each scenario block.*

Fix: either re-verify the set on the local stack in each audit pass (it fits with F8), or name the guarding test in each scenario's comment and drop the date tag. A short script that lists expired stamps makes the six-week rule enforceable.

### F6. The data map is 24 migrations behind (Foundation, LOW, residue of A10-F4)

`business-data-map.html` says "generated 2026-10-29" (last commit 2026-10-30), and 24 migrations were added since. It does not mention `analytics_consent_at` or `analytics_consent_version` (`20261105130000_analytics_consent_version.sql`), nor `recorrido_visto` (`20261112100000_user_profiles_tour_seen.sql`); it still describes `analytics_consent` alone. A10-F4 named the API and feature maps, and both were fixed. The cost is bounded: `stack.database.schema_source` is `migrations`, so the migrations stay the source of truth for the schema.

Fix: run `project-context` in UPDATE mode for the data map, which regenerates only the stale sections. One session.

### F7. The one unverified piece of Dependabot #1053 lives only in the log (Verification, INFO, new)

`posthog-node` went from 5 to 6 and reached `main` in #1053. The log says the PR was reviewed ("la API de posthog-node que usamos no cambia, el endpoint de captura pasa a la ruta v1") and leaves one item open: "confirmar con el primer pago con consentimiento que el evento llega a PostHog por la ruta nueva" (`.context/bitacora.md:239-240`). The server client (`lib/posthog/server.ts`) is only called from the Stripe webhook and `lib/billing/grant-pro.ts:78`, the billing funnel events. No card holds the check. The weekly `stripe-e2e.yml` run exercises the webhook on staging, and nothing reads PostHog afterwards.

Fix (10 minutes): a card that queries PostHog for the webhook events after the next weekly Stripe run.

### F8. `audit-process.md` §6 asks every pass for a local-stack chaos run that a read-only pass cannot do (Verification, INFO, question)

§6 (added on 2026-11-24 in `cbc02f1a`) and `chaos-experiments.md` lines 228-235 ask each audit pass to start the local stack and run `flows`, four fault scenarios and `stripe-stall`. This pass was briefed read-only, with no local stack, so only `stripe-stall` ran (241.0 s, unchanged). Step 3 compares against "the limit FRESCO-1285 agrees", which does not exist yet. Question for the owner: is the chaos run part of the audit pass (then the audit brief must allow the local stack), or a separate step whose dated registry row the audit reads (then §6 should say how old that row may be)? **Answered on 2026-11-24:** a separate step, run by the working session right before each pass; the audit reads the dated row of that same week (FRESCO-1289).

### F9. Third pass in three days (Agent discipline, INFO, question)

`audit-process.md` §1 sets a monthly cadence because closer passes measure noise and compete with remediation for one person's time. Audits 9, 10 and 11 ran on consecutive days, and this one measures 32 commits. Question: is this the regular pass (the next would fall around 2026-12-24) or an off-cycle one (the next regular stays around 2026-12-23)? Record the answer in the `README.md` row, which this pass did not write. **Answered on 2026-11-24:** off-cycle; the next regular pass around 2026-12-23 (section 0).

## 3. Audit 10 findings, re-checked

| Audit 10 | State | Checked today with |
|---|---|---|
| F1 password in a snapshot | Closed | the rule is in `live-ui-validation.md` §3.3 (submit with `run-code`, count-only scan), in the `sprint-development` Compact Rules (`SKILL.md:22`) and in `REGISTRY.md:670`; the count-only scan of `.playwright/` gives 0 for each of the six deployed-environment test passwords |
| F2 soft preferences vs ADR-0001 | Closed | ADR-0071 `Accepted`; amendment line in ADR-0001; glossary row "Soft preference" and the anti-glossary entry; the onboarding copy matches |
| F3 admin role | Closed | `domain-glossary.md:30` and `.context/SRS/architecture.md:187` name the allowlist |
| F4 business maps | Closed, residue | API map generated 2026-11-23; 19 of 30 feature-map sections regenerated (28 FRESCO-12xx tickets cited); the three legacy `.md` maps marked superseded; `docs/boilerplate.md:322-324` fixed; the SRS carries a validity note; the data map is behind (F6) |
| F5 authenticated screens | Closed by decision | `live-ui-validation.md` §3.6; not exercised in this pass (section 6) |
| F6 FRESCO-1269 close gates | Closed, the pattern recurs | `root_cause=code_error`, `severity=moderada`, `error_type=functional`; the same gap came back on FRESCO-1283 (F1) |
| F7 advisor list | Closed | `docs/workflows/supabase-advisor-accepted.md`; the live advisor shows 27 WARN and 17 INFO, all in its four families; its four check queries return 0 rows |
| F8 roadmap files | Closed by decision | RETIRED banner in both files; Phase 0b override in `sprint-development/SKILL.md:325`; "Retired planning files" in `agent-project.md` |
| F9 closing criteria | Closed | the §5 JQL returns 0; 32 of 32 non-epic cards created since 2026-11-23 carry the heading and an epic, read one by one |
| F10 e2e wall-clock | Closed | `bun run ci:e2e-wallclock` exists and runs (figures below) |
| F11 branch prefixes | Closed | comment above `branch_prefixes.precedence` (FRESCO-1281); 18 of 18 human PR branches in the window follow `{prefix}/FRESCO-N-slug` |

### Standing checks the process asks every pass to repeat

| Check | Result today | Trend |
|---|---|---|
| `audit-process.md` §5 JQL (closing criterion, created since 2026-11-24) | **0** | first run of this check |
| `audit-process.md` §2 JQL (open cards without an epic) | **0** | 0 in audit 10 |
| `bun run ci:e2e-wallclock` (last 12 green staging runs) | mean **5m49s**, max **6m32s**; one run over 6m30s (14:37Z), never two in a row, so the ADR-0018 trigger has not fired | audit 10 report: mean 365 s, max 393 s; bitácora of 2026-11-24 morning: max 6m27s. Flat, with a wide spread (4m44s to 6m32s) |
| `bun run jira:closure-evidence` | 61 closed in 7 days, 0 without a comment; 0 defects without an epic or a link | it judges `Error` cards only (F1) |
| Chaos (§6) | `stripe-stall` only: 241.0 s, 3 connections | unchanged; the rest not run (F8) |
| `bun run test` | 7563 tests in 572 files: 6819 pass, 744 skip, 0 fail, 85 s | the skips are the DB-integration suite (`RUN_DB_INTEGRATION`, 83 files), which its own CI job runs |
| `bun run types:check` | clean | |
| `bun run lint:check` | 0 errors, 4 warnings | all four predate audit 10 (for example the unused `EdgeErrorBody`, unused since FRESCO-1072) |
| `bun run git:checks verify` and `bun run git:policy verify` | the five declared checks are required on `main`, `staging` and `dev`; 0 drift; force-push and deletion blocked | |
| Staging `PR Check` runs since audit 10 | 30 of 31 green; the red one is F2 | |

## 4. What the evidence supports

Measured or quoted, not general praise.

- **The audit-10 remediation closed on evidence, and fast.** Eleven findings went through FRESCO-1271 to 1281, plus FRESCO-1282 for the gap the feature map exposed, between the report commit (2026-11-23 18:46) and the epic's close log (2026-11-24 11:09). Each one checks out at the destination (section 3), not only in the tracker.
- **Every change in the window is traceable.** 32 of 32 first-parent commits are conventional; 13 of 13 `feat`, `fix`, `refactor`, `perf` and `test` commits carry a `FRESCO-` key and a `(#PR)`; 30 of 30 non-bot commits carry both `Worktree:` and `Session:`; no AI attribution; commit size median 2 files, max 18.
- **The promotion gate held.** 4 of 4 production deployments since 2026-11-23 16:00 UTC came from a SHA whose staging push `PR Check` passed, and 4 of 4 got a green post-deploy smoke.
- **A gate fired correctly on a real failure.** On the red run of 2026-11-24 15:11Z the Edge Function auto-deploy refused to ship, and its drift comparison still passed.
- **The database boundary is recorded, not re-investigated.** The accepted-advisor page lists families, never counts, and gives one read-only query per family. All four return 0 rows today; the live advisor shows 27 WARN and 17 INFO, all inside those families.
- **The layering holds.** `cycles:check`: 485 files, no cycle. Zero imports from `lib/` into `components/` or `app/`, zero from `components/` into `app/`, no new raw colour value. Edge Function calls go through one helper with a per-function time limit (FRESCO-1249).
- **Chaos work done hypothesis first.** `chaos-experiments.md` writes each hypothesis before the run and states what was not measured: "**Lo que no se midió:** qué corta primero, el SDK o el límite de duración de la función en Vercel." Its S1a figure reproduced here to the decimal.
- **The human steers, and says what is unverified.** `.context/bitacora.md`, 2026-11-24: the independent review of #1064 "halló un fallo real (un guardado reenviaba objetivo y nivel y podía pisar un valor más nuevo), corregido antes de mergear"; the FRESCO-1282 card "pedía mal bloquear a Free en la base de datos: el onboarding de Free escribe esas columnas, así que el bloqueo es solo de pantalla"; `jira:closure-evidence` "destapó dos cierres sin comentario, FRESCO-1274 (mío) y FRESCO-1240".
- **Decision records stay coherent.** `adr:check`: 71 ADRs, index complete, no stale `Proposed`. The SRS now says it is the MVP contract and "does not describe everything the product does today", instead of silently drifting.
- **Credential hygiene.** Count-only scan of `.playwright/`: 0 for the six deployed test passwords. No token patterns in the files changed since audit 10. `.env` was never committed.

## 5. Live surface

Read-only and anonymous on `fresco-pre`, one browser session run from the scratch directory and closed at the end.

- **`/` at 390 and 1440 px.** `lang="es"`, one `h1`, 15 headings with no skips, 20 of 20 images with `alt`, no horizontal overflow at either width. The only targets under 24 px are two inline links inside sentences (one in the waitlist consent text), which WCAG 2.5.8 exempts. `responseStart` 110 ms, `domContentLoadedEventEnd` 1390 ms, load 2117 ms, LCP 1472 ms on unthrottled desktop Chrome (not a field figure), CLS 0.000.
- **Console.** 0 errors. Two warnings, both caused by this pass's own measurement call (a deprecated performance API), not by the app.
- **`/legal/privacidad` at 390 px**, not measured by earlier passes: `lang="es"`, one `h1`, 9 headings with no skips, no overflow, no console messages.
- **Anonymous redirects and health.** `/calendar`, `/shopping-list`, `/profile` and `/admin/recipes` answer 307 to `/login?next=…`, and `/menu` answers 307 to `/login`, as in audit 10. `/api/health` answers `{"status":"ok","checks":{"app":"ok","supabase":"ok"}}` (1.9 s, a cold start). Staging serves `robots.txt` with `Disallow: /` and an empty sitemap; the production sitemap lists six public URLs.

## 6. Blind spots

- **The authenticated app was not exercised anywhere in this pass**: no login on deployed environments and no local stack, by brief. FRESCO-1282's `/profile/preferences`, FRESCO-1249's time-limit messages and FRESCO-1283's fix are unmeasured live.
- **Chaos §6** ran only `stripe-stall` (F8).
- **`.env.ci` was not opened** (rule 1; the harness also refused a names-only read), so the local-stack test passwords were not part of the count-only scan. `.playwright/output/` holds 76 page snapshots written today between 15:36 and 15:38 local time; they were not opened. After delivery (2026-11-24) a count-only scan gave 0 for the six deployed test passwords and the folder was emptied (FRESCO-1293).
- **Which commit `fresco-pre` serves** was not confirmed; the pages measured did not change in the window.
- **Hosted settings.** Only the security advisor and the four check queries were read. The performance advisor, the Vercel settings and the Auth settings were not.
- **Test quality** was counted, not sampled; no mutation run beyond the evidence quoted in FRESCO-1283's comment.
- **Design fidelity** (`DESIGN.md` tokens, per-screen divergence records) was not re-checked.
- **The owner's reason for this pass** reached it through the orchestrating session and was not seen first-hand.

## 7. Suggested order of work (not a plan, no cards created)

1. **F1:** decide whether a chaos weakness is a defect, retype FRESCO-1283 and 1284, re-run E1 and record the row.
2. **F2 and F3:** a comment on FRESCO-1219, the portal added to FRESCO-1285, and three `Relates` links.
3. **F4:** persist the override reason.
4. **F5 and F8:** decide who runs the local-stack checks (chaos and the manual-only scenarios) and when.
5. **F6:** refresh the data map.
6. **F7 and F9:** a card for the PostHog check; record the cadence decision in the `README.md` row.
