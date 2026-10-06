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
| loaded functions | 85.5 % | 86.63 % (2026-10-06, FRESCO-795) |
| loaded lines | 87.0 % | 87.57 % (2026-10-06, FRESCO-795) |
| honest lines | 49.0 % | 49.60 % (2026-10-06, FRESCO-795) |

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
