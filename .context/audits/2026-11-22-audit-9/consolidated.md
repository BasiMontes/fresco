# Audit 9 - project maturity pass (agentic-audit, subject=dev, lens=internal)

Date: 2026-11-22. Target: this repository at `origin/staging` `f05185cf` (production `main` is 4 commits behind, all of them from this day). Rubric: `agentic-audit v1`, `references/rubric-dev.md`. Skill: `agentic-audit` from `upex-galaxy/agentic-user-skills`, commit `f0ca880adbd87c43997868da14b273a456e00cf2`, read in full before running. Card: FRESCO-1252.

## 0. What this pass is, and what it is not

This pass scores **process maturity against the agentic-dev architecture** on six axes: Foundation, Backlog, Traceability, Architecture, Verification, Agent discipline. It is **not** a security, payments, allergen or privacy audit. Audits 4 to 8 were mostly that kind, and their low overall scores (3.2 to 3.5) came from blockers in those areas. **A 4.4 here says nothing about whether the product is safer than it was in audit 8.** Do not read the two numbers against each other.

Off-cycle decision (required by `audit-process.md` section 2): the owner asked for this pass on 2026-11-22. The last pass was audit 8 on 2026-11-03, so it is 19 days later; the regular cadence would put the next one around 2026-12-03. The open remediation epic is FRESCO-986 (status `Listo`): 93 children, 84 in a Done category, 9 not Done (1 `WIP`, 4 `Aplazada`, 3 `Rechazos`, 1 that my status queries did not classify). Children of this pass go under FRESCO-986 with label `auditoria-9`, not under a new epic. The pass does not reset the cadence clock.

Conflict of interest, stated plainly: the auditor is the same agent family that wrote a large part of this repository in the sessions the Agent discipline axis reads. The commits carry a `Session:` trailer, and I read them. Weigh axis 6 accordingly.

## 1. Scores

| # | Axis | Score | Previous external pass (audit 6 externa, a different auditor) |
|---|---|---|---|
| 1 | Foundation | **4.5** | 4.0 |
| 2 | Backlog | **3.8** | 3.5 (provisional) |
| 3 | Traceability | **4.5** | 3.8 |
| 4 | Architecture | **4.5** | 3.8 |
| 5 | Verification | **4.7** | 4.3 |
| 6 | Agent discipline | **4.5** | 3.6 |
| | **Overall (plain mean)** | **4.4** | 3.8 |

Read the comparison with care. The 2026-10-01 pass was by a different person with no Jira and no hosted database, and `README.md` itself says scores are only comparable inside one lens. The per-axis direction is information; the deltas are not a measurement. Audit 3, the first rubric-v1 pass, scored 4.3 overall.

## 2. Findings, ordered by return on effort

Severity here means cost to the project's own method, not product risk. There are no BLOCKER or HIGH findings in this pass.

### F1. The acceptance-criteria convention in the repo is not the one in use (Backlog, MEDIUM)

`.agents/jira-required.yaml` documents the AC custom field with a structured-comment fallback. Measured on the live board with `acli` (not the local mirror):

- Stories in a Done category created since 2026-10-08: 22. With AC in the field or in an `Acceptance Criteria` comment: **0**.
- All Done cards created since 2026-10-08: 344. With `Criterio de cierre`, `Criterios de aceptación`, the AC field, an AC comment or Gherkin words in the description: **264 (77%)**.
- Before 2026-10-08: 259 Done stories, 72 with AC in the field or a comment (28%).

So criteria exist in most recent cards, but in the description, under a heading the catalog does not know about. Anyone or anything that reads the AC field gets nothing. Fix: pick one. Either bless `Criterio de cierre` in the description in `jira-required.yaml` and the skills that read it, or move recent criteria back into the field or the fallback comment. Cheap.

### F2. 446 cards without an epic (Backlog, LOW)

446 of the 1,176 non-epic cards have no parent. 445 were created before 2026-10-08, the day the "every card needs an epic" rule started; **7 are still open** (not Done); **1** was created after the rule: FRESCO-873. Fix: give the 7 open ones an epic and accept the Done ones in one line in `audit-process.md`.

### F3. A committed number that stopped being true (Foundation, LOW)

`.context/business/domain-glossary.md:29` says the project has 39 ADRs, `ADR-0001` to `ADR-0039`, no gaps. There are 70 ADR files, up to `ADR-0070`. `AGENTS.md` rule 17 (committed prose names the source of truth, never its current value) exists for exactly this. Fix: replace the sentence with a pointer to `.context/ADR/`.

### F4. The audits index stops at audit 6 (Foundation, LOW)

`.context/audits/README.md` lists passes 1 to 6. The folders `2026-10-16-audit-7` and `2026-11-03-audit-8` exist, and `audit-process.md` cites audit 8 as precedent, but neither is in the table. Fix: add the rows (this pass adds them together with its own).

### F5. FRESCO-986 cannot close under its own definition (Backlog, LOW)

`audit-process.md` section 2 says the epic closes only when every child is `Finalizada`, and the next regular pass does not start until it does. Its 9 non-Done children include 3 `Rechazos` (the owner confirmed on 2026-11-22 that `Rechazos` means will-not-do) and 4 `Aplazada` (blocked by money or consent). As written, the epic cannot close and the regular cadence cannot resume. Fix: decide that `Rechazos` is terminal for this rule and move the `Aplazada` ones to a parked epic.

### F6. History carries two things the current rules forbid (Traceability, LOW, historical)

- **340 commits** have a `Claude-Session:` trailer, between 2026-08-29 and 2026-10-14. *(Correction, 2026-11-23, FRESCO-1257: re-measured with `git log --all --grep='^Claude-Session:'`, it is 230, same date range. Rule 3 allowed the trailer in writing from 2026-09-07 until 2026-10-14; see `audit-process.md`, "Accepted history".)* `AGENTS.md` rule 3 forbids that trailer now. **Zero** since 2026-10-15; the `Session:` forensic trailer replaced it (582 trailer lines in 463 commits since).
- **113 commits** on `main` are authored `test <test@example.com>`, between 2026-09-09 and 2026-10-02, almost all `docs: bitacora FRESCO-…`. **Zero** since 2026-10-15, and `git:promote` now refuses a placeholder identity.

Both are closed at the source. Question for the author: was the `Claude-Session:` trailer ever allowed, or does rule 3 apply backwards? History is pushed, so rule 5 forbids rewriting it; record it as accepted.

### F7. A cache hint the proxy makes moot (Architecture, question, not a defect)

`app/page.tsx` sets `export const revalidate = 3600`, and its comment says a Stripe price change should reach the public page at most hourly. `proxy.ts:17-23` documents the opposite tradeoff: a per-request CSP nonce makes every page dynamic, "no CDN caching". Production answers `cache-control: private, no-cache, no-store, max-age=0, must-revalidate` for `/`. Measured TTFB is 110 to 160 ms in Lighthouse, so the cost is small today. Question: is `revalidate` still doing anything, and where do the Pro prices get cached? Ask, do not assume.

### F8. Policy stamp is 55 days old (Verification, INFO)

`git_strategy.meta.policy_verified` is 2026-09-28. `bun run git:policy verify --stamp` is manual. The live branch protection I read today still matches the declared required checks on `main`, `staging` and `dev`, so this is a stale stamp, not drift.

### F9. 52 of 213 e2e scenarios are not tagged automated (Verification, question)

`regression.feature`: 213 scenarios, 161 tagged `@automatizado`, 3 `@pendiente`, 11 `@smoke`. I did not classify the other 52 (some will be `@requiere-captcha-off` or real-Stripe by design). Question: which of them are intentionally manual?

### Observations that are not findings

- `strict` is `false` and `enforce_admins` is `false` on all three protected branches. `project.yaml` records it as an accepted divergence (`admin-bypass-on-promotion`) with its compensating control. Revisit when a second committer joins.
- The only small tap target on the public landing, "Política de privacidad" at 124x15 px, is an inline link inside the consent sentence of the waitlist form. WCAG 2.5.8 exempts inline links. Not a defect.
- 66 arbitrary pixel values (`[Npx]`) in non-test components. I did not check whether each is justified.

## 3. What the evidence supports

Quoted from the project's own files, not generic praise.

- **ADRs carry the rejected alternative.** `.context/ADR/ADR-0020-single-supabase-project-until-pro.md:211`: "Buy Supabase Pro now and split properly. Rejected on cost — no revenue,". All 70 ADR files contain an alternatives or rejected keyword (a keyword match, not a read of each one).
- **A visual trade-off is written down, with its reason.** `app/layout.tsx:43`: "`display: 'optional'` (not the default `'swap'`)", then three lines on why the large above-the-fold face must not shift on a slow connection.
- **A cost is named next to the decision.** `proxy.ts:22-23`: "Consequence: every page is now dynamically rendered (documented nonce tradeoff — no CDN caching)."
- **Real measured facts about the traceability.** Since 2026-10-15, **241 of 241** code-changing commits on `main` (`feat`, `fix`, `refactor`, `perf`) carry a ticket key and arrive through a PR. Overall, 96% of `main` first-parent commits are conventional and 82% carry a `FRESCO-` key. Commit size is small: median 2 files, p90 9, max 45 over the last 200.
- **The gate is real.** 582 unit and component test files, 87 DB integration test files, five required checks enforced on `main`, `staging` and `dev` (read live with `gh api`, not from the doc), `bun test` plus framework gates in `pre-push`, coverage floors of 93% functions and 96% lines, 20 workflows including a restore drill, a drift check, an uptime monitor and a post-deploy smoke.
- **The layering holds.** `cycles:check`: 479 files, no circular import. Zero imports from `lib/` into `components/` or `app/`, and zero from `components/` into `app/`. 725 semantic token class usages against 3 real hex values in code (the other 8 hex matches are in comments); the 3 are the browser `themeColor` meta and a documented `color-mix`.
- **Secret hygiene is clean.** No real `.env` was ever added in history (only `.env.example`, `.envrc`, `.env.ci`, and n8n example files). No `sk_live_`, `AKIA`, `sb_secret_` or long `sk-` match in tracked files. The JWT-shaped strings in `scripts/seed-e2e-users.ts` decode to `iss: supabase-demo` (the public local-stack keys, expiry 2032); the two in the audit-3 HTML and `docs/architectures/supabase-nextjs/auth-tokens.md` are header fragments, not full tokens.
- **Decisions are narrated with the why.** `.context/bitacora.md` entries follow Qué / Por qué / Siguiente, the file rotates at 50 entries with five archives, and entries record rejected work, for example the Cloudflare filter false positives and the owner's explicit "Lote a main" confirmation for a batched promotion.
- **Audit 8 was closed.** All 41 cards labelled `auditoria-8` are Done. This pass did **not** re-measure the 63 audit-8 findings one by one.

## 4. Live surface (public landing, read-only)

`https://fresco-pro.vercel.app/` in a real browser at 390x844 and 1440x1000, plus today's Lighthouse mobile runs. No login, no writes.

- One `h1`, heading order `H1, H2, H3` without skips, `lang="es"`, title "Fresco — Planificador de menús semanales", canonical present, 4 JSON-LD blocks, no `noindex`, skip link present.
- 20 images, 0 without an `alt` attribute (16 with `alt=""`, decorative by design). No horizontal overflow at either width. **0 console errors** at both widths.
- Headers: HSTS with `preload`, enforcing CSP, `X-Frame-Options: DENY`, `nosniff`, strict referrer and permissions policies.
- Lighthouse mobile, three runs, simulated Moto G Power on slow 4G: performance 89, 94, 95; accessibility, best practices and SEO 100 in all three; CLS 0. LCP 2.5 to 2.8 s is borderline and was investigated and closed in FRESCO-1247 (simulation noise, no reliable fix).

## 5. Blind spots

An audit that hides these reads as complete when it is not.

- **The authenticated app was not exercised.** Only the public landing was driven. `/menu`, `/calendar`, `/shopping-list`, `/profile` and `/admin` are unmeasured here.
- **Hosted Supabase and Vercel settings were not read.** Only the repository, the public site, GitHub branch protection and the Jira board.
- **`.env.ci` is tracked and was not opened**, per `AGENTS.md` rule 1. Its JWT-shaped value and its `whsec_ci` prefix are consistent with local-stack and CI dummy values, and `pr-check.yml` fails the job if the URL is not the local stack, but I did not verify its contents. The owner can confirm with a claims-only decode.
- **Backlog numbers come from the live board through `acli` text and field queries.** Criteria written in another format, or in an attachment, would not be counted.
- **Test quality was counted, not sampled.** No mutation run, no reading of individual tests.
- **No screenshots were saved.** The measurements are in this file.
- **The skill's own secret-hygiene recipe was changed on purpose.** It greps the whole tree with `-o`, which would print values and open the local `.env*` files. I used `git grep` on tracked files, file names and counts only, per rule 1.
- **The 63 audit-8 findings were not re-run one by one.** Closure of their cards is a count, not a re-measure.

## 6. Suggested order of work (not a plan, no cards created)

1. F1: decide where acceptance criteria live and write it down.
2. F5 and F2: unblock FRESCO-986 and give the 7 open cards without an epic one.
3. F3 and F4: two one-line documentation fixes.
4. F7 and F9: two questions to answer, not tasks yet.
5. Run the authenticated half this pass did not (a Free user and a Pro user on staging) and the security-shaped passes on their own cadence; this one does not replace them.
