# Todo: Receipt ticket on "Compra realizada"

Plan: `tasks/plan.md` · Spec: `docs/superpowers/specs/2026-09-04-receipt-ticket-design.md`

## Phase 1: CSS foundation
- [x] Task 1: `.t-receipt-print` block in `app/globals.css` (stepped keyframes + reduced-motion near-zero-duration override)

## Phase 2: Component
- [x] Task 2: `components/shopping-list/receipt-ticket.tsx`
- [x] Task 3: `components/shopping-list/receipt-ticket.test.tsx` (4/4 green)

### Checkpoint — component complete
- [x] `bun test components/shopping-list/receipt-ticket.test.tsx` green
- [x] `bun run types:check` clean

## Phase 3: Wiring
- [x] Task 4: wire `handleCompraRealizada`/`handleReceiptClose` into `shopping-list-view.tsx`, icon swap (Trash2 → Receipt)
- [x] Task 5: `components/shopping-list/shopping-list-view.test.tsx` (new file, 3/3 green — scope trimmed, see note below)

## Checkpoint — feature complete
- [x] Full `bun test` green (571 pass, 0 fail)
- [x] `bun run types:check` clean
- [x] `bunx eslint .` clean on touched files
- [x] Live browser check: happy path (print → Listo → closes) — via a temporary `/dev/scratch-receipt` route, deleted after
- [x] Live browser check: reduced-motion emulation reaches 'complete' near-instantly, no stuck spinner
- [ ] Commit + push (ask before push, per session convention)

## Notes from implementation (beyond the plan's own "Deviations" section)

- **Task 5 scope trimmed further than planned.** The plan's Task 5 said to assert `toggleShoppingListItem` call counts. Live-ran into the exact same boundary `delete-week-button.test.tsx` already documents (ADR-0024 §11): the real (unmocked) `@/lib/api/*` call actually settles within the same `act()` flush as the test's `user.click()` and its catch-block optimistic-revert kicks in (no live network in the test env), so asserting the post-toggle checkbox state was flaky/wrong, not just slow. Dropped that one assertion; the other 3 cases (button gating, ticket opens without un-checking yet, "Listo" starts the dialog closing) hold.
- **Found (not fixed): `Dialog` crashes SSR if `open` is ever `true` on a component's first server-rendered pass** — `createPortal(..., document.body)` runs unconditionally once `shouldRender` is true, and `document` doesn't exist server-side. Every real `Dialog` consumer today happens to start closed and open only via a client interaction, so this has never fired in production. Not touched here (pre-existing primitive limitation, unrelated to this feature, no current consumer trips it) — worth a follow-up ticket if a future `Dialog` usage ever needs to start open.
- Live verification used a temporary `app/dev/scratch-receipt/page.tsx` (mirroring the existing `app/dev/skeleton-capture/` dev-only-route pattern) instead of a real logged-in flow — generating a real meal plan locally is blocked by the Edge Function CORS allowlist not including `localhost:3000` (`_shared/cors.ts`, needs the local Supabase stack). Deleted after the check; never committed.
