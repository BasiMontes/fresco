# Code Review — FRESCO-239

PR: https://github.com/BasiMontes/fresco/pull/116 (`feat/FRESCO-239-personalizar-scorerecipe-usuario` → `dev`)

## Adversarial review (`/code-review high`, background, independent pass)

Reviewed `main...HEAD` (includes prior already-merged work on `dev`; only findings inside this PR's actual diff — `dev...HEAD` — are in scope here).

| # | Finding | File:line | Verdict | Resolution |
|---|---|---|---|---|
| 1 | `spyOn(Math, 'random')` installed at describe-body scope, torn down with `mockClear()` (resets call history only, not the monkey-patch) — `Math.random` stayed pinned to 0 for the rest of the process, silently zeroing jitter in earlier describe blocks in the same file too (describe bodies run during collection, before any test executes). | `menu-selector.test.ts:236` | **legitimate** | Moved to `beforeAll`/`afterAll` with `mockRestore()`. Verified: full suite (`bun test`, 213 tests) green before and after. |
| 2 | `get_recent_recipe_marks` and `get_user_recipe_engagement` are independent (both only need `user.id`) but were awaited sequentially — two round-trips where one `Promise.all` would do, on every Pro/Family generation. | `index.ts:108` | **legitimate** | Parallelized via `Promise.all`. |
| 3 | `updateRecetaPropia(client, id, input)` — 3 positional params, violates CLAUDE.md §10. | `lib/api/recipes.ts:230` | **false-positive (out of scope)** | Not part of this PR's diff (`git diff dev...HEAD` confirms — file untouched here). Belongs to prior, already-merged work on `dev`; the reviewer scanned `main...HEAD` which includes it. No action in this PR. |

## Static checklist

- Acceptance Criteria (derived, tech-debt has no formal Jira AC): all 4 covered — see plan's `## Overview` bullets; verified by the 3 new unit tests + the unchanged 19 pre-existing tests (Free-tier regression guard).
- Lint / build / types: clean.
- Code standards: `scoreRecipe()` converted to object-param (CLAUDE.md §10, pre-existing violation fixed while touching the signature).
- Security: reuses the audited ADR-0006 `security definer` + `auth.uid()` ownership-check pattern — no new attack surface.
- UI/UX: N/A — backend-only change, no UI story to validate against.

## Spec Compliance Matrix

| AC scenario | covered_by | evidence | status |
|---|---|---|---|
| Pro/Family user with repeated `cocinada` marks scores that recipe higher | test | `menu-selector.test.ts` — "cocinada history is favored" | covered |
| Pro/Family user with a `descartada` mark scores that recipe lower | test | `menu-selector.test.ts` — "descartada mark outweighs" | covered |
| Free tier behavior unchanged (zero new RPC calls) | test | `menu-selector.test.ts` — "Free tier ... unaffected" | covered |
| Existing global heuristic still applies to all tiers | test | pre-existing 19 tests in `menu-selector.test.ts`, green post-change | covered |

No `uncovered` rows — merge not blocked.

## Outcome

All legitimate findings fixed (commit `c07d315`). Ready for Stage 4 (merge to `dev`).
