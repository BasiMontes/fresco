# Measured Gotchas

> Loaded by `business-feature-context`, when reading this project's feature map could mislead a competent session. Every row was measured on the date given against the source it names. Rows that stop being true move to "No longer true"; they are never deleted. Proposed and applied through `references/refresh.md` (approval first).

## 1 · Reading the map

| # | Gotcha | Symptom | Fix | Measured | Verified against |
|---|---|---|---|---|---|
| 1 | `rating`, `veces_calificada` and the `rating` request field are retired | A story asks for a rating UI because the old map listed one | Do not build it: a `rating` in the body is ignored and learning counts once per user and recipe | 2026-10-30 | `supabase/functions/update-recipe-status/validation.ts` (FRESCO-1012), `ADR-0063` |
| 2 | A cooked or discarded mark changes only inside the current ISO week; `sustituida` has no screen | A story assumes marks can be edited any week, or that a screen replaces a dish | Only `pendiente` or the other mark inside the current week; outside it the function answers 409. Only `app/qa/page.tsx` and a landing test mention `sustituida` | 2026-10-30 | `supabase/functions/update-recipe-status/validation.ts` (FRESCO-1014), grep of `components/` and `app/` |
| 3 | A live count belongs in a pointer to the data map, never in a feature row | A feature row keeps a recipe or user count that goes stale | Cite the data map `entity-*` section; the one literal count in `overview` carries its production read date | 2026-10-30 | `business-feature-map.html` `overview`, `business-data-context` map |

## 2 · No longer true

_(empty)_
