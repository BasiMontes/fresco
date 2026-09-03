# Unit-test coverage ratchet (FRESCO-412)

Companion to the **e2e automation ratchet** in `README.md` (FRESCO-321). Same
idea, other test layer: a floor that only ever moves **up**, enforced in CI,
so coverage cannot silently decay.

## The mechanism

`scripts/check-coverage.ts` (CI job `test:unit`, via `bun run test:coverage`):

1. runs `bun test --coverage --coverage-reporter=lcov`;
2. parses the lcov report and computes the **line-weighted total** —
   `Σ hit / Σ found` across every source file, **excluding** test-support
   code (`tests/`, `bun-test-setup.ts`) and CI scripts (`scripts/`);
3. fails the job if `functions %` or `lines %` is below `FLOOR` in that
   script. Never fails on a rise.

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

Lives in **one place**: the `FLOOR` constant in `scripts/check-coverage.ts`.

| Metric | Floor | Measured when set (2026-09-03, after FRESCO-411) |
|---|---|---|
| functions | 83.0 % | 83.85 % |
| lines | 85.0 % | 85.78 % |

Set ~0.8 pp below the measured value to absorb runner-vs-local noise (the
measurement is deterministic run-to-run, but the CI runner can differ slightly).

## Raising the floor

New work pays as it goes — every PR that adds `lib/` / `app/` / `components/` /
`supabase/functions/` code adds tests for it, same as the e2e same-PR rule. When
that has pushed the real number comfortably above the floor:

```sh
bun scripts/check-coverage.ts --print   # measure, no enforcement
```

then bump `FLOOR` in `scripts/check-coverage.ts` to roughly the new numbers,
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
