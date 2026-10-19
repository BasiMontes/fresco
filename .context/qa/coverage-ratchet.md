# Unit-test coverage ratchet (FRESCO-412)

Companion to the **e2e automation ratchet** in `README.md` (FRESCO-321). Same
idea, other test layer: a floor that only ever moves **up**, enforced in CI,
so coverage cannot silently decay.

## The mechanism

`scripts/check-coverage.ts` (CI job `test:unit`, via `bun run test:coverage`):

1. runs `bun test --coverage --coverage-reporter=lcov`;
2. parses the lcov report and computes the **line-weighted total** —
   `Σ hit / Σ found` across every source file lcov lists, **excluding**
   test-support code (`tests/`, `bun-test-setup.ts`), CI scripts (`scripts/`)
   and the synced updater tooling (`cli/`). This is the **loaded** number;
3. computes the **honest** line number: the same hits over a denominator that
   also counts every non-empty, non-comment line of the source files under
   `app/ components/ lib/ supabase/functions/` that no test imports (lcov never
   lists them), minus generated files (`lib/supabase/types.ts`);
4. fails the job if loaded `functions %` or `lines %` is below `FLOOR`, or the
   honest `lines %` is below `HONEST_FLOOR_LINES`, in that script. Never fails
   on a rise.

### Why two numbers (FRESCO-795, audit-6 A6-T4)

lcov only lists files some test loads. The loaded number can therefore rise by
deleting a test import, and it hid about half the code (130 of 316 source files
on 2026-10-06, e.g. `app/signup/page.tsx`, `generate-meal-plan/index.ts`). The
honest number cannot be improved that way. It is an approximation on the low
side (unloaded files contribute every non-empty line, not only executable ones),
so the real figure sits a few points higher; it is a ratchet signal, not a
report. There is no honest functions figure: counting functions in unloaded
files needs an AST parse.

### Why not `bunfig.toml` `coverageThreshold`

Bun 1.3's `coverageThreshold` — both the single-number and the
`{ lines, functions }` object form — is enforced **per file**. This codebase
has many partially-covered source files by design (`lib/push/web-push-client.ts`
~15 %, server-only branches only e2e exercises), so any per-file bar above
~15 % fails on day one and a bar that low catches nothing real. The AC wants a
**global total**; bun has no option for it, hence the script.

Also: bun's text-reporter "All files" line is an *unweighted mean of per-file
percentages* — small 100 %-covered files inflate it (it read ~89/91 % while the
honest line-weighted total was ~84/86 %). The script reports the weighted number.

## The floor

Lives in **one place**: the `FLOOR` and `HONEST_FLOOR_LINES` constants in `scripts/check-coverage.ts`.

Both live in `scripts/check-coverage.ts` (`FLOOR`, `HONEST_FLOOR_LINES`).

| Metric | Floor | Measured when set |
|---|---|---|
| loaded functions | 87.5 % | 88.12 % (2026-10-14, FRESCO-916) |
| loaded lines | 88.7 % | 89.30 % (2026-10-14, FRESCO-916) |
| honest lines | 54.5 % | 55.26 % (2026-10-14, FRESCO-916) |

Set a touch below the measured value to absorb runner-vs-local noise (the
measurement is deterministic run-to-run, but the CI runner can differ slightly).

**History**
- 2026-09-03 (FRESCO-411): functions 83.0 / lines 85.0 (measured 83.85 / 85.78).
- 2026-09-03 (FRESCO-419): **lowered** to functions 82.0 / lines 84.0. The
  `Dialog`-component tests pulled `components/ui/dialog.tsx` + the
  `delete-week-button` / `delete-account-dialog` / `create-recipe-form`
  graphs into the coverage set; their async submit/delete handlers are
  e2e-covered, not unit-covered, so the weighted total dipped ~1 pp even
  though real coverage of the dialog cycle + validation gates rose. A
  documented, reviewed one-off dip — the ratchet resumes upward from here.
- 2026-10-06 (FRESCO-795): loaded floor **raised** to functions 85.5 / lines 87.0
  (the script had drifted to 84.5 / 86.2 while this doc still said 82 / 84);
  honest line floor 49.0 introduced.
- 2026-10-14 (FRESCO-916): all three **raised**: functions 87.5, lines 88.7, honest
  lines 54.5 (measured 88.12 / 89.30 / 55.26). The honest floor had sat 6.3 pp below
  the real number for a week, so a regression of that size would have passed CI. The
  "consider raising" nudge fires at 1.5 pp of headroom; it had been showing since the
  first week and nobody acted on it, which is why the tranches below have an owner
  and a date.
- 2026-10-19 (FRESCO-991): all three **raised**: functions 89.0, lines 89.7, honest
  lines 63.0 (measured 89.60 / 90.10 / 63.35, from 61.47 honest). New handler tests for
  `generate-meal-plan`, `generate-shopping-list`, `get-shopping-list-suggestions`,
  `delete-catalog-recipe` and `_shared/posthog.ts`. `--unloaded` added (see below).

## Tranches (honest lines)

The honest number is the one that cannot be gamed, so it is the one with a plan. Each
tranche is a floor, raised in a PR of its own once the number has held for a few runs.

| Tranche | Honest floor | Target date | State |
|---|---|---|---|
| 1 | 54.5 % | 2026-10-14 | **Done** (FRESCO-916): measured 55.26 %, the ticket's "55 % in a month" was already met |
| 2 | 60 % | 2026-12-14 | **Done early** (FRESCO-991): measured 63.35 %, floored at 63.0 |
| 3 | 70 % | Set by the owner 2026-10-19 | Open. About 1,600 more covered lines at the 2026-10-19 count (6,782 of the unloaded lines are UI pages and components) |

**Where the gap is** (uncovered lines counted on 2026-10-14, by area): `components/calendar`
847, `app/(app)` 804, `components/recipes` 705, `components/profile` 675,
`supabase/functions` 659, `components/landing` 616, `components/onboarding` 545,
`components/signup` 488. The 12 files that cost most, all of them loaded by no test:
`components/recipes/recipe-library.tsx` (352), `app/qa/page.tsx` (252), `app/login/page.tsx`
(233), `components/profile/ayuda-section.tsx` (204), `components/calendar/calendar-grid.tsx`
(203), `components/landing/site-nav.tsx` (186), `components/recipes/recipe-detail.tsx`
(183), `supabase/functions/generate-meal-plan/index.ts` (176), `components/landing/hero.tsx`
(174), `components/ui/filter-drawer.tsx` (149), `app/(app)/calendar/page.tsx` (128) and
`components/onboarding/onboarding-footer.tsx` (128). A component test of the first three or
four of those would clear most of tranche 2.

**Regression test for a closed finding.** A finding closed as BLOCKER or ALTO (audit
severity, or a defect with `severity` critica or mayor) carries a regression test that
fails without the fix, or a stated reason in the closing comment. The rule and what
counts as a reason live in `.context/backlog/definition-of-done.md`.

**Which files first.** The files no test imports, ranked by what a bug would cost
(money, then allergens and consent, then Edge handlers, then user-data routes and loaders,
then the rest), regenerated whenever you need it:

```sh
bun scripts/check-coverage.ts --print --unloaded
```

On 2026-10-19 the first four classes are clear of runtime code no test reaches: what is
left there is type-only files, the legal pages (21 lines each, static text), the Supabase
client factories (mocked by every handler test) and `manage-subscription-button.tsx`.
`lib/profile/load-profile-page-data.ts`, `lib/menu/load-menu-page-data.ts` and the pages
under `app/(app)` are the next real candidates; the rest is UI, covered by e2e.

## Raising the floor

New work pays as it goes — every PR that adds `lib/` / `app/` / `components/` /
`supabase/functions/` code adds tests for it, same as the e2e same-PR rule. When
that has pushed the real number comfortably above the floor:

```sh
bun scripts/check-coverage.ts --print   # measure, no enforcement
```

then bump `FLOOR` and `HONEST_FLOOR_LINES` in `scripts/check-coverage.ts` to roughly the new numbers,
rounded down a touch, and note the new measurement in its comment + the table
above. The script prints a "consider raising the floor to …" nudge once there
is ≥ 1.5 pp of headroom.

**Lowering** the floor is allowed only as a deliberate, reviewed trade-off,
in the same PR that causes the drop, with the reason in the PR description.

## Read it live

```sh
bun scripts/check-coverage.ts --print
```

## Scope notes

- **Per-folder tracking**: not maintained as a doc — `bun test --coverage`
  already prints the per-file table on every run, which is the same
  information fresher. Revisit if the single global number ever hides a
  folder rotting while another improves.
- The e2e ratchet (`README.md` / FRESCO-321) and this one are independent:
  unit coverage for branches, e2e for user flows.
