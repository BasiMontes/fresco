# Spec Compliance Matrix — FRESCO-61

| AC scenario (Gherkin) | covered_by | evidence | status |
| --- | --- | --- | --- |
| Ver la semana siguiente | test:lib/date/iso-week.test.ts + manual:live-ui | `addIsoWeeks`/`getDateFromIsoWeek` unit tests (round-trip, year-boundary) + Playwright click on "Semana siguiente" updating the URL and label correctly | covered |
| Ver la semana anterior | test:lib/date/iso-week.test.ts + manual:live-ui | Same tests + Playwright click on "Semana anterior" → `?semana=2026-W30`, label "27–2 ago", empty state renders for that week | covered |
| Volver a la semana actual conserva el resto de funciones | review-approved:self | `CalendarGrid` receives the same prop shapes regardless of `semanaIso` — no code path changed for drag/cocinado/descartado; not independently re-verified live (test account has no plan in any week to drag), flagged in `review.md` | manual |
