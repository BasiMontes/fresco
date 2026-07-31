# Spec Compliance Matrix — FRESCO-22

| AC scenario (Gherkin) | covered_by | evidence | status |
|---|---|---|---|
| Explicación visible para usuaria Pro con historial real | manual:partial | Real end-to-end call (`generate-meal-plan`, `plan='pro'` on the project's test user, real 2-week cocinado/descartado history): response returned a genuine, warm, first-person-plural `explicacion_aprendizaje` (235 chars), confirmed persisted in `meal_plans` and readable via the exact `select()` string `lib/api/meal-plan.ts` uses. The React render itself (`Card variant="insight"`) wasn't visually confirmed in a browser (see `review.md` finding 1) — same JSX pattern already proven live for the FRESCO-19 banner. | manual |
| Sin explicación en la primera semana de una usuaria Pro | manual:prompt-instruction | Prompt explicitly instructs `null` when Pro without history (unchanged logic path, not separately re-tested this pass — verified by inspection of the unchanged `isPro`/`recentRecipeIds` gate in `index.ts`, already tested for FR-5.4 previously). | manual |
| Usuaria Free nunca ve esta explicación | manual:live-ui-validation | FRESCO-19's live guest-flow test (same session, Free/anonymous path) confirmed a real generation response with `explicacion_aprendizaje` absent from the old schema; this story's Edge Function only populates it inside the unchanged `if (isPro)` branch. | covered |
| Advertencias de seguridad no se mezclan con la explicación de aprendizaje | covered | Real test response: `advertencias` (4 safety/quality strings) and `explicacion_aprendizaje` (1 separate string) returned as two distinct top-level fields — confirmed structurally separate end to end (schema column, Edge Function response, `MenuSemanalPersistido` type, UI `Card`). | covered |

No unit-test infra in this project — manual live evidence is the applicable shape, consistent with FRESCO-17/19.
