# Spec Compliance Matrix — FRESCO-63

| AC scenario (Gherkin) | covered_by | evidence | status |
| --- | --- | --- | --- |
| Generar para una semana vacía | manual:live-ui | Real Gemini generation triggered directly from `/calendar`'s empty state — 21-slot menu rendered, no navigation away from `/calendar` (2026-08-03 session) | covered |
| No se puede generar sobre una semana que ya tiene menú | review-approved:self | `GenerateWeekButton` only rendered in `NoMenuEmptyState`'s branch (structurally absent once a plan exists — verified live post-generation); `409` handled defensively in code for the race case | manual |
| La generación falla | exempt:reused-validated-logic | Same 422/generic `EdgeFunctionError` handling as `app/onboarding/page.tsx`'s `handleGenerate()`, already live-validated in an earlier session; not re-triggered live in this pass | exempt |
