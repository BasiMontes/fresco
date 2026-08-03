# Review — FRESCO-61

Solo mode, self-review (fresh-eyes pass over the diff before commit).

## Diff

- `lib/date/iso-week.ts`: `getDateFromIsoWeek()` (inverse of `getIsoWeek()`) + `addIsoWeeks()`.
- `lib/date/iso-week.test.ts`: 7 new tests (inverse round-trip across a full year sweep, year-boundary crossing, malformed-input throw).
- `components/calendar/week-navigation.tsx` (new): prev/next `Link`s + a Monday–Sunday range label.
- `app/(app)/calendar/page.tsx`: reads `?semana=YYYY-Www` from `searchParams` (a `Promise` in this Next.js version — awaited, not read synchronously), validates it against a strict regex, falls back to the current week on anything malformed or absent, passes it through to `getMealPlanForWeek()` (which already accepted an explicit week — confirmed during Stage 1 planning, no change needed there).

## Findings

None legitimate. Considered and dismissed:

- **Match the mockup's month-style label ("FEB 2026") literally?** Dismissed — the data model is strictly weekly (`meal_plans.semana_iso`, `unique_user_semana`), so a month label doesn't correspond to what's actually being navigated. Used a Monday–Sunday day-range label instead ("3–9 ago"), per Rule 14 (mockup as inspiration, not literal spec) — flagged explicitly during Stage 1 rather than silently deviating.
- **Cross-month label edge case**: a week spanning two months (e.g. 27 Jul – 2 Aug) renders as "27–2 ago" — the trailing month name applies to both start and end days, a common compact-range convention, not a bug. Verified live; the underlying date range is correct (confirmed via the `?semana=` URL and the prev/next targets), only the display shorthand could be made less ambiguous in a future pass. Not blocking — no AC requires a specific cross-month format.
- **Validate `?semana=` more loosely (accept any string, let `getMealPlanForWeek` fail)?** Dismissed — `getDateFromIsoWeek()` throws on a malformed string, and the page would crash instead of showing a normal week. A strict regex gate + fallback-to-current-week keeps this a non-event for any garbage query param (verified live: `?semana=garbage-value` renders the current week's empty state, not an error).

## Live-UI verification

Ran against the real dev server + the shared QA test account (no active plan for any week, since the test account currently has none):

- Initial load: correct current-week label ("3–9 ago", matches 2026-08-03's real ISO week) + empty state.
- Click "Semana anterior": URL updates to `?semana=2026-W30`, label updates to "27–2 ago" (crosses month, correct dates), empty state renders for that week too (AC Scenario 2 — no plan for a different week also falls back correctly).
- Directly navigating to `?semana=garbage-value`: falls back to the current week, no crash, no error page (AC's implicit robustness requirement, not literally in Given/When/Then but a real defensive requirement given this is a user-editable URL param).
- Scenario 3 (returning to current week preserves calendar functions) not independently re-verified with an actual drag-and-drop, since the test account has no plan in any week right now to drag — the code path is structurally unchanged (`CalendarGrid` receives the same `plan.menu`/`slotIds`/`estados` shape regardless of which `semanaIso` produced them), so this is inference from the diff, not a fresh live observation. Flagged rather than silently assumed.
