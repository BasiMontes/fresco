# Audit 9 - re-measurement of the nine findings (2026-11-23)

This is a re-measurement, not an audit pass. It repeats the query behind each finding of `consolidated.md` after the fixes (FRESCO-1253 to FRESCO-1260) and reports before and after. It gives **no new score**: a score would come from a pass of `agentic-audit`, ideally by someone who did not make the fixes. The author of the fixes and of this file is the same agent family that wrote the audit, so read it as a checklist of queries, not as an independent verdict. Measured on `origin/main` at `d86b8717`, same day as the fixes.

## Result

| Finding | Before (audit 9) | After | Query or source |
|---|---|---|---|
| F1 criteria convention | repo documented the 255-char field; 0 of 22 recent stories used it; 77 % of recent cards had criteria in the description | docs, `jira-required.yaml` and the sync say the description (`## Criterio de cierre`); sync fills `acceptance-criteria.md` for a real story (FRESCO-1058) from the inline label | `rg "Criterio de cierre"` in `description-custom-field-dedup.md` and `jira-required.yaml`; `jira:sync-issues pull --story FRESCO-1058` |
| F2 cards without epic | 7 open (and FRESCO-873 after the rule) | **0 open** | `project = FRESCO AND issuetype != Epic AND parent is EMPTY AND statusCategory != Done` |
| F3 stale ADR count | glossary said 39, there were 70 | glossary has no count; ADR files are now **71**, so a number would have been wrong again | `rg "This project has 39\|ADR-0039"` in the glossary; `ls .context/ADR` |
| F4 audits index | stopped at audit 6 | rows for 7b, 8 and 9 present | `.context/audits/README.md` |
| F5 FRESCO-986 cannot close | 9 non-Done children, rule unsatisfiable | rule rewritten (`Rechazos` terminal, `Aplazada` to FRESCO-1261); **epic `Finalizada`**; 3 non-Done children, all `Rechazos` | JQL `parent = FRESCO-986 AND statusCategory != Done` |
| F6 history | 340 commits with `Claude-Session:` and 113 authored `test@example.com` | recorded as accepted history. **Count corrected to 230** (re-measured with `git log --all --grep`). None since 2026-10-15 and 2026-10-03 respectively; 16 of 16 commits on `main` since 2026-11-22 carry the `Session:` trailer | `git log origin/main` |
| F7 `revalidate` vs proxy | `revalidate = 3600` set, proxy makes pages dynamic | line removed; production and `fresco-pre` answer `no-store` with a different nonce per request; the local build lists `/` as dynamic | `curl -I`, `bun run build` |
| F8 policy stamp | 55 days old | `policy_verified: 2026-11-23`, `DRIFT (0)` | `bun run git:policy verify` |
| F9 scenarios | "52 of 213 not tagged automated, 3 `@pendiente`" | **Count corrected: 59 were not automated, 0 `@pendiente`** (the report counted seven mentions inside comments). Now 154 `@automatizado`, 44 `@solo-manual` with a reason, 15 `@pendiente` pointing to FRESCO-1262 to FRESCO-1267; 0 unclassified | script over `regression.feature` |

## What this does not show

- **Not fixed, only classified:** the 15 `@pendiente` scenarios still have no automatic test. They are six open cards under FRESCO-866.
- **Not re-measured:** the authenticated half the audit skipped (Free and Pro users on `staging`), hosted Supabase and Vercel settings, `.env.ci`, test quality (no mutation run), and the 63 audit-8 findings one by one. These blind spots stand.
- **Open items seen while measuring:** two Dependabot PRs (#1052, #1053) with `repo:check` and `test:unit` failing; one `test:e2e` run on `staging` (commit `2ba38892`) failed at the `Start local Supabase` step, an infrastructure step and not a test, on a docs-only commit; `git:policy verify` lists six notes (`non_fast_forward` and `deletion` not enabled on the three protected branches), informational and not declared as required.
- Two figures of the original report were wrong (F6 and F9) and were corrected in `consolidated.md`; re-measure a count before quoting it.

## Next

The regular pass is due around 2026-12-03 (`audit-process.md` §1). It is the place for a new score and for the authenticated half.
