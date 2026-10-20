# Unit-test coverage: the loaded figure and the honest one

> FRESCO-990 (audit 7b `A7-TEST-07`). The CI gate is `bun run test:coverage` (`scripts/check-coverage.ts`).
> It prints two coverage figures and fails when either breaks its floor. This page says why there are two.
> The tranche plan and how to raise a floor live in `.context/qa/coverage-ratchet.md`.

## The two figures

| Figure | What it divides | What can inflate it |
|---|---|---|
| **Loaded** (functions and lines) | Lines hit by tests, over the lines of the files some test imports | Deleting a test's `import` of a file removes that file, usually a poorly covered one, from the denominator, so the percentage goes up |
| **Honest** (lines only, "cobertura honesta") | The same lines hit, over the loaded lines **plus every line of every source file no test imports**, counted as not hit | Nothing short of testing more code. Removing an import leaves the file in the denominator |

The loaded figure answers "how well do the tests that exist cover what they load". The honest figure answers
"how much of the code is covered by a test". Only the second one is a floor you can trust.

## What the gate does

- It fails when **either** figure is under its floor (`FLOOR` and `HONEST_FLOOR_LINES` in the script).
- A floor only goes up, by hand, in the PR that earns it. A deliberate drop is a reviewed edit with its reason in the PR.
- A CI run writes both figures, the honest one first, to the job summary of the run.
- `scripts/check-coverage.test.ts` pins the behaviour: dropping an import raises the loaded figure and leaves
  the honest one unchanged, and the honest figure alone can fail the gate.

## How the honest denominator is counted

Every tracked file under `app/`, `components/`, `lib/` and `supabase/functions/` that lcov never listed, minus
tests, type declarations and generated code, adds its non-empty, non-comment lines. It is a conservative count,
not an exact one: a ratchet needs a stable number. Functions have no honest figure, because counting them in
unloaded files would need a parser.

## Reading the numbers

```bash
bun scripts/check-coverage.ts --print              # measure, print, always exit 0
bun scripts/check-coverage.ts --print --unloaded   # also the files no test imports, by risk class
```
