# Spec Compliance Matrix — FRESCO-67

| AC scenario (Gherkin) | covered_by | evidence | status |
| --- | --- | --- | --- |
| Filtrar por cocina | manual:live-ui | Playwright: "italiana" filter narrowed to Italian-style dishes only (2026-08-03 session) | covered |
| Filtrar por dieta | manual:live-ui | "vegano" filter narrowed correctly (display-tag quirk noted in `review.md`, unrelated to filter correctness) | covered |
| Filtrar por un alérgeno puntual | manual:live-ui | "Gluten" filter excluded bread/toast recipes, kept an explicitly "sin gluten"-tagged one | covered |
