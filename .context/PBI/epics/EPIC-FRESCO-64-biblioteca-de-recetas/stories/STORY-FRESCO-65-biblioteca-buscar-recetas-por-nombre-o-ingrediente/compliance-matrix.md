# Spec Compliance Matrix — FRESCO-65

| AC scenario (Gherkin) | covered_by | evidence | status |
| --- | --- | --- | --- |
| Buscar por nombre | test:lib/api/recipes.test.ts + manual:live-ui | 6 unit tests for `getCatalogRecipes` + Playwright search for "pollo" narrowing to name matches (2026-08-03 session) | covered |
| Buscar por ingrediente | manual:live-ui | Same search term matched ingredient-level substrings (confirmed via the "pollo"/"repollo" case, same filter code path) | covered |
| Buscador sin resultados | manual:live-ui | Garbage search term rendered the distinct "No encontramos nada para tu búsqueda" empty state | covered |
