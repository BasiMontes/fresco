# Implementation Plan: Receipt ticket on "Compra realizada"

Spec: `docs/superpowers/specs/2026-09-04-receipt-ticket-design.md`

## Overview

Add a receipt-printer-style ticket modal that appears when "Compra realizada" is clicked on `/shopping-list`, listing the checked items before they get unchecked. UI-only, no backend change, no new dependencies.

## Deviations from the approved spec (implementation-level refinements, same intent)

- **2 stages, not 3.** Dropped the standalone `'processing'` (~400ms fake pause) — it added a timer + test surface for zero functional payoff, and the 1.75s printing feed already carries the "just a moment" beat. Stage machine is `'printing' → 'complete'`.
- **State machine driven by `onAnimationEnd`, not `setTimeout`.** `components/calendar/delete-week-button.test.tsx` (ADR-0024 §11, FRESCO-419) established the project's preference here: assert real CSS-driven state via DOM events/classes, don't fight real timers in happy-dom. The paper's feed is a CSS `@keyframes` animation; its `onAnimationEnd` flips `stage` to `'complete'`. Tests fire `animationend` synthetically instead of advancing fake timers.
- **CSS `steps(10, jump-end)` timing function, not a ported keyframe array.** Gets the same "a saltos" thermal-printer feel as dqnamo's 20-keyframe easing array from one `translateY(-100%) → translateY(0%)` animation — simpler, no magic-number array to maintain.
- **Reduced motion via `animation-duration: 0.01ms !important`, not `animation: none`.** `.t-modal`'s existing reduced-motion override uses `transition: none` — fine there because Dialog's unmount timer doesn't depend on `transitionend`. This component's stage machine DOES depend on `animationend` firing, so disabling the animation outright would strand it in `'printing'` forever under reduced motion. The near-zero-duration trick keeps the event firing (near-instant, imperceptible) while satisfying reduced-motion intent. Still "no JS branch needed" as the spec said — just a more precise CSS mechanism than a blanket `none`.
- **`shopping-list-view.test.tsx` is a new file**, not an edit — the spec assumed an existing test to resequence; none exists today (verified: only `.tsx` files in `components/shopping-list/`). Scoped narrowly to the new handler behavior, not full-file coverage (out of scope creep for this feature).
- **Button icon**: `Trash2` → `Receipt` (lucide-react). `Trash2` reads as destructive/clear; now that the click prints a receipt first, `Receipt` matches the new framing. Small, included in the wiring task.

## Architecture decisions

- Reuse `components/ui/dialog.tsx` for overlay/focus-trap/Escape/portal/reduced-motion posture — strip its default surface chrome via `className` override (`p-0 bg-transparent shadow-none border-none`) since the printer "machine" body is the visual surface.
- New CSS block in `app/globals.css` (`.t-receipt-print`), following the existing `.t-modal` / `.t-success-check` documented-block convention (comment header naming the driving component + rationale, `@keyframes`, reduced-motion override).
- Reuse `.t-success-check` (already used by `nombre-form.tsx` / `preferences-form.tsx`) verbatim for the "complete" checkmark — no new check-draw animation needed.
- Reuse `Loader2` + `animate-spin` (Tailwind builtin, already the spinner pattern in `shopping-list-generator.tsx`) for the "printing" status icon.
- Reuse `formatUnidad` (already exported-in-module-scope in `shopping-list-view.tsx`) for item-line unit formatting — export it so `receipt-ticket.tsx` can import it, rather than duplicating the singularization rule.

## Task List

### Phase 1: CSS foundation

- [ ] **Task 1** — Add `.t-receipt-print` block to `app/globals.css`
  - **Description:** New `@keyframes t-receipt-print-feed` (translateY(-100%) → translateY(0%)) + `.t-receipt-print` class applying it via `steps(10, jump-end)` over a `--receipt-print-dur` custom property (default 1750ms), plus the `@media (prefers-reduced-motion: reduce)` override dropping duration to `0.01ms !important` (keeps `animationend` firing). Comment block matches the `.t-modal`/`.t-success-check` documentation convention (cites this plan / FRESCO ticket once one exists).
  - **Acceptance criteria:**
    - [ ] `.t-receipt-print` applies a 10-step discrete animation over the custom-property duration
    - [ ] Reduced-motion media query keeps the animation (not `none`) at near-zero duration
  - **Verification:**
    - [ ] `bun run types:check` clean (no TS involved, but keep the gate for consistency)
    - [ ] Visual: covered by Task 2's live browser check, not standalone
  - **Dependencies:** None
  - **Files:** `app/globals.css`
  - **Scope:** XS (1 file, additive block)

### Phase 2: Component

- [ ] **Task 2** — Build `ReceiptTicket` component
  - **Description:** `components/shopping-list/receipt-ticket.tsx`. Props: `open: boolean`, `items: Pick<ShoppingListItem, 'nombre' | 'cantidad' | 'unidad'>[]`, `onClose: () => void`. Renders `Dialog` (chrome stripped) containing: `Machine` (rounded body), `Screen` (status: spinner+label while `stage==='printing'`, `.t-success-check` checkmark + label + "Listo" button once `stage==='complete'`), `Paper` output window (fixed height, `overflow-hidden` while printing, `overflow-y-auto` once complete) containing the `<article className="font-mono">` ticket: header "FRESCO", `Intl.DateTimeFormat('es-ES', ...)` date/time line (small local helper, no existing shared formatter found), dashed divider, "N ITEMS COMPRADOS", item lines (`{cantidad}{unidad} {nombre}` via `formatUnidad`), divider, closing line "¡Buen provecho!" (placeholder copy, easy to swap later). Perforated bottom edge via a module-level precomputed `clip-path: polygon(...)` constant (same zigzag technique as the dqnamo reference, no per-render cost). `stage` resets to `'printing'` whenever `open` flips `true` (so reopening replays the animation).
  - **Acceptance criteria:**
    - [ ] Mounting with `open=true` starts in `'printing'`, paper animates via `.t-receipt-print`
    - [ ] `onAnimationEnd` on the paper flips to `'complete'`: checkmark shows, "Listo" button appears
    - [ ] Clicking "Listo" (or Dialog's own Escape/click-outside/X) calls `onClose`
    - [ ] Long item lists (20+) don't get clipped or truncated — scrollable once `'complete'`
    - [ ] Ticket text uses `font-mono` (Tailwind default stack, no new font load)
  - **Verification:**
    - [ ] `bun run types:check` clean
    - [ ] `bunx eslint components/shopping-list/receipt-ticket.tsx` clean
    - [ ] Covered by Task 3's tests
  - **Dependencies:** Task 1
  - **Files:** `components/shopping-list/receipt-ticket.tsx`
  - **Scope:** M (1 new file, several sub-pieces but one cohesive component)

- [ ] **Task 3** — `receipt-ticket.test.tsx`
  - **Description:** Bun + RTL, matches repo convention (`renderWithProviders`, `setupUser`). Cases: (1) renders with items, starts in printing state (spinner visible, "Listo" absent); (2) firing `animationend` on the paper element flips to complete (checkmark + "Listo" visible); (3) clicking "Listo" calls `onClose`; (4) item lines render `cantidad`/`unidad`/`nombre` correctly, including the `formatUnidad` singular-edge-case already proven on the shopping list itself.
  - **Acceptance criteria:**
    - [ ] All 4 cases pass
    - [ ] No real timers / no `waitFor` on time — synthetic `animationend` only
  - **Verification:**
    - [ ] `bun test components/shopping-list/receipt-ticket.test.tsx` — all pass
  - **Dependencies:** Task 2
  - **Files:** `components/shopping-list/receipt-ticket.test.tsx`
  - **Scope:** S (1 file)

### Checkpoint: Component complete

- [ ] `bun test components/shopping-list/receipt-ticket.test.tsx` green
- [ ] `bun run types:check` clean
- [ ] Review before wiring into the real page

### Phase 3: Wiring

- [ ] **Task 4** — Wire into `ShoppingListView`
  - **Description:** In `components/shopping-list/shopping-list-view.tsx`: add `receiptOpen`/`receiptItems` state; new `handleCompraRealizada` (snapshots `compradosCoords` → `pasillos` lookups into `receiptItems`, opens the modal, does NOT call `handleClearComprados` yet); new `handleReceiptClose` (closes modal, then calls existing `handleClearComprados()` — same DB side effect, now resequenced to fire on dismiss). Button's `onClick` moves from `handleClearComprados` to `handleCompraRealizada`; icon `Trash2` → `Receipt`. Render `<ReceiptTicket open={receiptOpen} items={receiptItems} onClose={handleReceiptClose} />` once, near the button.
  - **Acceptance criteria:**
    - [ ] Clicking "Compra realizada" opens the ticket and does NOT immediately uncheck items
    - [ ] Closing the ticket (any path) unchecks them via the existing `toggleShoppingListItem` flow
    - [ ] Button still only renders when `compradosCoords.length > 0` (unchanged)
  - **Verification:**
    - [ ] `bun run types:check` clean
    - [ ] `bunx eslint components/shopping-list/shopping-list-view.tsx` clean
    - [ ] Covered by Task 5
  - **Dependencies:** Task 2
  - **Files:** `components/shopping-list/shopping-list-view.tsx`
  - **Scope:** S (1 file)

- [ ] **Task 5** — `shopping-list-view.test.tsx` (new file)
  - **Description:** New, narrowly scoped: not full-file coverage, just the new sequencing behavior. Mock `toggleShoppingListItem` (module mock, matches repo convention for Supabase-client calls). Cases: (1) clicking "Compra realizada" with checked items opens the ticket and `toggleShoppingListItem` is NOT called yet; (2) closing the ticket calls `toggleShoppingListItem` once per checked item with `comprado=false`; (3) button is absent when nothing is checked.
  - **Acceptance criteria:**
    - [ ] All 3 cases pass
  - **Verification:**
    - [ ] `bun test components/shopping-list/shopping-list-view.test.tsx` — all pass
  - **Dependencies:** Task 4
  - **Files:** `components/shopping-list/shopping-list-view.test.tsx`
  - **Scope:** S (1 file)

### Checkpoint: Feature complete

- [ ] `bun test` (full suite) green
- [ ] `bun run types:check` clean
- [ ] `bunx eslint .` clean on touched files
- [ ] Live browser check (playwright-cli): `/shopping-list` with checked items → click "Compra realizada" → ticket prints → "Listo" closes → items unchecked
- [ ] Live browser check: reduced-motion (emulate) → ticket still reaches "complete" (no stuck spinner)
- [ ] Ready for review

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `animationend` doesn't fire reliably in happy-dom for real CSS animations during actual dev-server use (only matters for tests, which fire it synthetically) | Low — production relies on the real browser, which always fires it | N/A, non-issue outside tests |
| Perforated `clip-path` zigzag looks wrong at odd paper widths (responsive) | Low-medium, cosmetic | Live browser check across viewport widths before calling done |
| Dialog's own top-right `X` close button visually collides with the stripped-chrome machine top edge | Low, cosmetic | Live browser check; small `pt-*` nudge if needed, no architecture change |

## Open questions

- Final ticket copy (date format, closing line wording) — placeholder from the spec, user said they'll help adapt the text; not a blocker for Tasks 1-5, swap-in-place once finalized.
