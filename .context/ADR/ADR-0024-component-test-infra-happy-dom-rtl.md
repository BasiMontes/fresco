# ADR-0024 — Component tests run on happy-dom + React Testing Library, registered globally for `bun test`

- **Status:** Proposed <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-09-03
- **Deciders:** Founder (approval pending); drafted by AI workflow (FRESCO-409, epic FRESCO-408, audit-4 eje Verificación)
- **Tags:** testing, cross-cutting-invariant, ci, frontend
- **Supersedes:** —
- **Superseded by:** —

---

## Context

`bun test` is the unit runner (415 tests / 40 files at the time of writing). Coverage is good in `lib/` and in the Edge Functions' pure logic, but `components/` (76 `.tsx` files) had **zero** unit tests and `app/` had one. The whole UI + HTTP layer rode on a half-automated e2e suite (FRESCO-321 / ADR-0018): a render regression or a broken client-side branch was invisible in CI until an e2e caught it. Epic FRESCO-408 closes that gap incrementally, ratchet-style; FRESCO-409 (Phase 1) is the infra + a first batch of the riskiest components (10 shipped; `Dialog`-based ones deferred — see Decision point 9).

Constraints that forced a decision:

1. **Bun has no per-file test environment.** Vitest lets a file opt into `jsdom` via a docblock; `bun test` does not. A DOM is either present for every test file or none.
2. **The pure-logic tests must not regress.** They must stay green and the whole suite must stay well under the ADR-0018 ~30s CI cap (it also governs `bun test`, per FRESCO-408).
3. **`@testing-library/*` binds `document.body` at import-evaluation time.** Any module that imports testing-library throws if evaluated before a DOM global exists — so registration order matters, not just registration.
4. **React 19.** The testing-library major must support it.

## Decision

**Component tests use `@happy-dom/global-registrator` + `@testing-library/react@16` + `@testing-library/user-event@14` + `@testing-library/jest-dom@7`. happy-dom is registered globally for every `bun test` file, from the single `bun-test-setup.ts` preload, before any DOM-touching code is evaluated.**

Concretely:

1. **One preload**, `bunfig.toml` → `preload = ["./bun-test-setup.ts"]`. Its first statement is `GlobalRegistrator.register({ url: 'https://test.fresco.local/' })`. `@testing-library/*` binds `document.body` at import-eval time and ESM `import` hoists above executable code, so testing-library is pulled in with `require()` **after** the register call, not a top-level import. A guard throws loudly if `window` is still undefined after `register()` — a clear failure instead of a downstream `ReferenceError` in `react-dom`. (An earlier two-preload split — a bare `happy-dom-setup.ts` listed first — was not reliably honored by `bun test` in CI: the DOM registered locally but not on the runner. One file, explicit statement order, is deterministic.)
2. **The DOM is global, not per-file.** Every test file gets `window`/`document`. The ~415 pure-logic tests do not read them; the cost is one sub-millisecond registration and ~250ms of one-time module init across the run — the suite stays ~1s locally, far under 30s.
3. **`url` is set** so `window.location` has a real origin: `lib` code that branches on `typeof window` now takes the browser path under test, matching the real app rather than an SSR shim.
4. **`@testing-library/jest-dom` self-registers** its matchers on `bun:test`'s `expect`. It ships no types for that runner, so `tests/jest-dom.d.ts` augments `bun:test`'s `Matchers` interface.
5. **RTL `cleanup` runs in a global `afterEach`** in `bun-test-setup.ts` — `bun test` wires none of its own, so without it rendered trees accumulate in the shared happy-dom document across cases.
6. **`@/lib/supabase/client` is stubbed once, globally**, in `bun-test-setup.ts`. It pulls the whole `@supabase/ssr` + `@supabase/supabase-js` graph; a per-file `mock.module` on it (or on any `@/lib/api/*` module that re-exports through it) makes bun re-transpile that graph per file and turns a ~1s suite into a ~75s one. Component tests that must assert on a data call use `spyOn` on the specific `@/lib/api/*` function, or are written against the inert stub's "no session → throws" path.
7. **Shared entry point:** `tests/component-render.tsx` re-exports `@testing-library/react` + `userEvent` and exposes `renderWithProviders` (today a pass-through — `PostHogProvider` is already stubbed — kept so a future provider is a one-line change). `tests/mocks/next-navigation.ts` is the shared `useRouter`/`usePathname` stub.
8. **Scope invariant (from FRESCO-408):** only components with real risk get tests — state logic, form validation, destructive actions, conditional rendering, or high-reuse design-system primitives. Purely presentational components are deliberately left uncovered; the PR that adds a batch documents which were chosen and why.
9. **`Dialog`-based components are deferred.** `components/ui/dialog.tsx` runs a nested double `requestAnimationFrame` in a layout effect; happy-dom's rAF drives it into a CPU spin that stretches a single file to minutes. The components that mount `Dialog` (`delete-week-button`, `delete-account-dialog`, `create-recipe-form`, …) wait on a happy-dom rAF shim or a `Dialog` test seam — tracked as a follow-up, not this story.

## Consequences

- **Positive:** the UI layer is now testable in CI in milliseconds, not only through e2e. Render regressions and broken client branches (error mapping, optimistic-update revert, touched-gates, roving tabindex) are caught at `bun test` speed. One shared render helper keeps every component test importing from the same place, so adding a provider later touches one file.
- **Negative / trade-offs:** every test file — including the pure-logic ones — now pays for a DOM it does not use. The cost is small today (~250ms once) but grows with happy-dom's init surface; if the suite ever approaches the 30s cap, revisit. happy-dom is not a real browser: layout, real CSS, and some APIs are stubbed or absent — anything that needs a real engine stays in the Playwright e2e suite. Three new dev dependencies + a hand-written `bun:test` type augmentation that must track `@testing-library/jest-dom` majors.
- **Neutral / follow-ups:** FRESCO-410 (route handlers / server actions), FRESCO-411 (Edge Function `index.ts` orchestration), and FRESCO-412 (a `bun test --coverage` ratchet gate in CI) build on this. The 30s cap is shared with ADR-0018 — the e2e revisit trigger and this one watch the same wall-clock budget from opposite ends. Two happy-dom traps are known and worked around, not solved: (a) `mock.module` on the Supabase graph is a perf cliff (point 6 above); (b) `Dialog`'s nested rAF spins under happy-dom, deferring the modal-mounting components (point 9). A follow-up ticket should add a rAF shim + a `Dialog` test seam and bring those ~3-4 components in.

## Alternatives considered

- **Per-file DOM via a custom loader / docblock convention** — Bun exposes no per-file environment hook the way Vitest does. Emulating one (a preload that inspects the test path and conditionally registers) is fragile: registration is process-global and cannot be undone cleanly between files. Rejected as more moving parts than the cost it saves.
- **jsdom instead of happy-dom** — heavier, slower to initialise, and the extra fidelity (full CSSOM, more complete APIs) is not what these tests need — they assert behaviour and ARIA wiring, not layout. happy-dom's speed matters more given the shared 30s budget.
- **Migrate the unit runner to Vitest** (which has first-class per-file environments + jsdom) — a much larger change: re-tooling 40 green test files, a second test runner alongside `deno test` for Edge Functions, and CI rework, to solve a problem a two-line preload already solves. Out of proportion to the need.
- **Keep leaning on e2e for UI coverage** — the status quo the audit flagged. A render bug in a non-happy-path branch is invisible until an e2e exercises it, and the e2e suite is itself only ~half automated. Rejected — that is the gap this epic exists to close.

## References

- Epic FRESCO-408 (unit-test coverage, ratchet model) · Story FRESCO-409 (Phase 1)
- ADR-0018 — the ~30s CI wall-clock budget this shares
- FRESCO-321 — the e2e automation ratchet this complements (unit for branches, e2e for user flows)
- `bunfig.toml`, `bun-test-setup.ts`, `tests/component-render.tsx`, `tests/mocks/next-navigation.ts`, `tests/jest-dom.d.ts`
