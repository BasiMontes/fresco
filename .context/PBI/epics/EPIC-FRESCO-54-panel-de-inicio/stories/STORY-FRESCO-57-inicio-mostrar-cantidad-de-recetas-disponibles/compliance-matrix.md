# Spec Compliance Matrix — FRESCO-57

| AC scenario (Gherkin) | covered_by | evidence | status |
| --- | --- | --- | --- |
| Ver el total de recetas disponibles | test:lib/api/recipes.test.ts + manual:live-ui | 6 unit tests (exact count, null fallback, DB error, no-session error, userId escape hatch) + Playwright render showing "448 recetas disponibles para ti" against the real test profile (2026-08-03 session) | covered |
| Entrar al catálogo desde la card | manual:live-ui | Playwright click on the card navigated to `/recipes` | covered |
