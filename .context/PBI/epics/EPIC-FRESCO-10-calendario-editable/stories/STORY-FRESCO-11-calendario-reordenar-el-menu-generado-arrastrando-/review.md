---
topic_key: pbi/FRESCO-11/review
---

# Code Review — FRESCO-11 Stage 2 batch 2 (drag-and-drop UI)

Native `gentle-ai` bounded review lifecycle: `lineage=review-411ae59ce3d8097c`, `risk_level=high` (new dependency — `process_boundary` signal), full 4R lens sweep on `CalendarGrid` + `applySlotSwap()` (not yet pushed at review time).

## Adjudicated findings

| # | Severity | File:line | Finding | Verdict | Action |
|---|---|---|---|---|---|
| 1 | CRITICAL | `components/calendar/calendar-grid.tsx` `handleDragEnd` | Confirmed independently by 2 lenses (resilience + reliability): no guard against overlapping drags. A second drag reusing a slot from an unresolved first swap's RPC composes on top of the still-optimistic state; the first swap's revert-on-failure then re-applies against the wrong state, corrupting the grid in a way nothing re-syncs from afterward. Not yet reachable by a live user (component unwired), but a genuine bug that activates the moment batch 3 wires it in. | legitimate | **fixed** — added a `pendingSlots` set; both ends of an in-flight swap are disabled (`useDraggable`/`useDroppable`'s `disabled` option) until the RPC settles, making overlapping drags structurally impossible rather than reconciling them after the fact. Visual `cursor-wait`/`opacity-70` feedback added. |
| 2 | WARNING | `components/calendar/calendar-grid.tsx` swap-failure catch | RPC failure was completely unlogged, unlike the established `console.error` convention in this same feature area (`/menu`, `/calendar` page catch blocks). | legitimate | **fixed** — added `console.error('[CalendarGrid] swapMealPlanSlots failed, reverting', error)`. |
| 3 | WARNING | `components/calendar/calendar-grid.tsx` `useSensors` | Default `KeyboardSensor` coordinateGetter moves a 25px virtual cursor with no snap-to-cell behavior against a ~120px-wide grid column — keyboard reordering works but requires an unpredictable number of arrow presses per cell. | legitimate, UX polish | **declined for now** — no AC requires precise keyboard-step behavior; tracked as a follow-up, not blocking. |
| 4 | SUGGESTION | `apply-slot-swap.ts`/`.test.ts` | Self-swap no-op and untouched-day reference-identity, both documented in the pure function's own doc comment, had no test coverage. | legitimate, cheap | **fixed** — 2 tests added. |
| 5 | SUGGESTION | naming (`slotId()` fn vs `slotIds` prop) | Near-identical names for conceptually unrelated values (dnd-kit interaction id vs persisted slot UUID). | legitimate, cosmetic | **declined** — low value to rename, context disambiguates (function call vs prop access). |
| — | — | (risk lens) | `@dnd-kit/core` legitimacy, client Supabase pattern, XSS, secrets — all confirmed clean. | — | none |

## Next

Component still not wired into any real page — that's batch 3's job, along with the final live-render pass (loading/empty/error states, the AC's interactive flows) required before this story can be considered merge-ready.
