# Spec Compliance Matrix — FRESCO-59

| AC scenario (Gherkin) | covered_by | evidence | status |
| --- | --- | --- | --- |
| Ver las últimas recetas | test:lib/api/recipes.test.ts + manual:live-ui | 7 unit tests for `getLatestAvailableRecipes` (mapping, empty array, DB error, no-session error, order/limit defaults, custom limit, userId escape hatch) + Playwright screenshot showing 6 real, catalog-filtered recipe cards under "Últimas recetas añadidas" (2026-08-03 session) | covered |
| Ver todas las recetas | manual:live-ui | Playwright click on "Ver todas" navigated to `/recipes` | covered |
