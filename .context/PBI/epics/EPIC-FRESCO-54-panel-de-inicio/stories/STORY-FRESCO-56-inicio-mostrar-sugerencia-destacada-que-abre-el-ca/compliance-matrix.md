# Spec Compliance Matrix — FRESCO-56

| AC scenario (Gherkin) | covered_by | evidence | status |
| --- | --- | --- | --- |
| Abrir el plan desde la sugerencia | manual:live-ui | Playwright click on "Ver mi plan semanal" navigated to `/calendar` (2026-08-03 session) | covered |
| El banner siempre está visible | manual:live-ui | Playwright screenshot/snapshot of `/menu` empty state showing the banner above `NoMenuEmptyState`; same component instance also renders in the happy-path branch (not independently re-verified live — see `review.md`) | covered |
