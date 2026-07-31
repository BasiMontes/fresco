# Spec Compliance Matrix — FRESCO-23

Single scenario (this is a Tarea/tech-debt, not a story with Gherkin AC) — the tech-debt's own "Comportamiento esperado":

> Un menú con 20 franjas válidas + 1 franja sin receta seleccionable debería entregarse igual, con esa franja marcada explícitamente en `advertencias`, en vez de fallar la generación completa.

| Scenario | covered_by | evidence | status |
|---|---|---|---|
| Model reports a genuinely unsafe slot (sentinel + advertencia) → validator records it as `unsafeSlots`, not a generic error | test:`supabase/functions/generate-meal-plan/validator.test.ts` ("NO_SAFE_RECIPE_SENTINEL" describe block) | 4 passing tests | covered |
| `index.ts` accepts an `unsafeSlots`-flagged response as a valid, deliverable menu (no throw), persists `recipe_id: null` for that slot | manual:`.context/PBI/tech-debts/.../review.md` (DB-level live verification, real join query matching `index.ts`'s exact write shape) | review.md "DB-level live verification" section | manual |
| `index.ts`'s modified retry/validation loop has no regression on the normal (non-degraded) generation path | manual:`.context/PBI/tech-debts/.../review.md` ("Live verification actually performed") | real Gemini call via the redeployed function, 2026-W32, 200 OK, 21/21 real slots | manual |
| `getMealPlanForWeek()`/`reshapeMenu()` surfaces a null-recipe row as `menu[dia][tipo] === null`, distinct from a genuinely missing row (NFR-REL-2) | test:`lib/api/meal-plan.test.ts` (two new/existing tests) | `surfaces a slot with a null recipe as null...` + `throws MealPlanError when the persisted plan is missing slots...` | covered |
| `/menu` and `/calendar` render a null slot without crashing, with a "Sin receta segura" placeholder | manual:`app/(app)/menu/page.tsx`, `components/calendar/calendar-grid.tsx` (code read + `bun run build` type-check of both render paths) | `bun run build` clean; no live browser render performed | exempt:no live browser session run this session — the real Gemini call above never produced a null slot to render, so there was nothing live to click through even with a browser available |
| Gemini actually emits the sentinel + a paired advertencia per `prompt.ts`'s instructions, when a genuine zero-safe-recipe slot occurs | — | — | uncovered:not exercised — reasoned through in review.md why it's impractical to construct safely against the single shared real project (see "Declared gap") |

**Gate note**: the last row is genuinely `uncovered`, not reclassified to `exempt` — prompt-compliance from a live model is not something code review, unit tests, or a real-but-unconstrained live call can stand in for. Flagged to the user directly (not silently merged past) before this ticket is treated as fully closed.
