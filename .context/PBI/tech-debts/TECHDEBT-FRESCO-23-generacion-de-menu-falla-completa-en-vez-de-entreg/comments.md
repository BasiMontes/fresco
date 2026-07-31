# Comments for FRESCO-23

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-23)

---

### Basi Montes - 7/31/2026, 4:07:56 PM

## Spec Implementation Plan (Dev)

***Task******:*** FRESCO-23 — Generación de menú falla completa en vez de entregar parcial con advertencia

### Correction to the ticket's own description

Re-read FRESCO-9's **literal** AC Scenario 4 before designing (the ticket description paraphrased an older `review.md`, which paraphrased loosely): ***"ve una advertencia clara y visible sobre ese espacio concreto. Y el menú nunca se le entrega como si fuera totalmente seguro."**** This does NOT require delivering a 20/21 partial menu — the current hard-fail already satisfies "never delivered as safe" (nothing is delivered at all). The real, narrower gap: the warning is not ****specific to the affected slot***, and the retry loop wastes 2 guaranteed-identical Gemini calls before failing. Scoping to this — not a DB-schema change to allow nullable `recipe_id`, which the earlier framing would have required and which is much larger, riskier surgery for no AC benefit.

### Change

1. `supabase/functions/generate-meal-plan/types.ts`: add `NO*SAFE*RECIPE*SENTINEL = 'SIN*RECETA_SEGURA'` (shared constant, both prompt.ts and validator.ts import it — avoids the two files drifting on the literal string).
2. `prompt.ts`: new instruction — when truly no recipe in the filtered catalog satisfies an absolute rule for a slot, the model must put the sentinel value in that slot's `recipe*id` (never an unsafe real id, never leave the field ambiguous) ***and*** add an `advertencias` entry naming the exact día + tipo*plato affected.
3. `validator.ts`: recognize the sentinel distinctly from a malformed/missing slot. When found: require a non-empty `advertencias` array (the "never silent" contract) — if present, record it as a new `unsafeSlots: string[]` (e.g. `['lunes.desayuno']`) instead of a generic "ID inválido" error. `valid` stays `false` (still can't persist — `meal*plan*recipes.recipe_id` is `not null`), but the failure is now specifically identified.
4. `index.ts`: if `validation.unsafeSlots.length > 0` on any attempt, stop retrying immediately (retrying with the identical catalog/profile is guaranteed to reproduce the same result — 2 wasted Gemini calls today) and throw 422 with a message built from the specific slots, e.g. **"No hay ninguna receta segura para****:**** desayuno del lunes. Prueba ampliando tus preferencias."**
5. `app/onboarding/page.tsx`: the real, simple frontend gap — the 422 catch branch currently ***discards*** the server's message entirely and always shows one hardcoded generic string, regardless of what the backend actually said. Surface `error.message` (the specific per-slot text from step 4) when present, falling back to the existing generic copy only if the message is empty.

### Verification approach

Real unit tests (`bun test` — confirmed working for this Edge Function, 9 existing tests pass today) for the validator's new sentinel-handling logic — deterministic, no Gemini cost, and the realistic way to prove this specific branch (forcing a genuine zero-candidate-for-one-slot condition from the real ~35-recipe catalog via the actual LLM is not reliably reproducible on demand). Live-verify the frontend message pass-through separately with a real 422 (any cause) to confirm `error.message` now reaches the UI unmodified.

### Workload Forecast

Estimated: ~90 additions, 5 files (1 shared constant, prompt/validator/index changes, 1 frontend line, + new test cases)
400-line budget risk: Low
Chain strategy: n/a — `solo-main`
Decision needed before apply: No

---

### Basi Montes - 7/31/2026, 5:41:55 PM

## Spec Implementation Plan (Dev) — FRESCO-23

### Ya hecho (sesión previa, sin commitear)

- Sentinel `NO*SAFE*RECIPE_SENTINEL` en `types.ts`, `prompt.ts` instruye al modelo a usarlo, `validator.ts` distingue slot-inseguro-reportado-limpio (`unsafeSlots[]`) de error genérico, tests cubren el validator.
- `index.ts` corta reintentos cuando hay `unsafeSlots` (reintentar da el mismo resultado) — pero sigue lanzando `422` completo. No cumple el AC ("entregar 20/21 con advertencia, nunca fallar completo").

### Gap real a cerrar

1. Migración: `meal*plan*recipes.recipe_id` pasa a nullable (hoy `not null references recipes(id)`).
2. `generate-meal-plan/types.ts` + `api-contracts.types.ts`: slot de la respuesta admite `Recipe | null`.
3. `index.ts`: si `unsafeSlots.length > 0` sin errores genéricos, construir `menuData` igual (sin throw), persistir esas franjas con `recipe_id: null`, resto normal.
4. `lib/api/meal-plan.ts` (`reshapeMenu`): hoy cualquier `recipes: null` se trata como bug de escritura no-transaccional (NFR-REL-2) y explota. Distinguir "fila existe con `recipe_id` null a propósito" (nuevo caso válido) de "fila no existe" (bug real, sigue fallando). Tipar `menu` como `Record<DiaSemana, Record<TipoPlato, Recipe | null>>`.
5. Frontend (grid semanal en `/menu` y `/calendar`): slot con receta `null` renderiza estado "sin receta segura" + la advertencia asociada, sin crashear ni asumir `Recipe` no-null.
6. `lib/supabase/types.ts`: regenerar tras la migración.
7. Tests: `reshapeMenu` (null intencional vs fila faltante), Edge Function persistencia parcial.

### Fuera de alcance

- Drag-and-drop de slots null (excluir de swap si aplica, evaluado en implementación, sin historia nueva).
- UI de "regenerar solo esa franja" — feature nueva, no pedida.

### Riesgo

Migración relaja `NOT NULL` — reversible, no destructiva. FK conserva `on delete restrict`.

---

### Basi Montes - 7/31/2026, 6:03:25 PM

## Cierre

Implementado, testeado (54/54), deployado (versión 7 de `generate-meal-plan`, ACTIVE) y verificado en vivo (llamada real con el usuario de test — sin regresión en el camino normal; capa de DB confirmada con una fila real `recipe_id: null`). Commit `e33d3e0` en `main`.

***Gap declarado***: no se forzó en vivo el caso exacto donde Gemini reporta una franja sin receta segura (el catálogo actual de recetas no lo dispara de forma natural, y fabricarlo con seguridad requeriría manipular datos del único proyecto real compartido). El manejo del sentinel está cubierto exhaustivamente por tests unitarios del validator + una fijación real a nivel de DB que prueba que la fila con `recipe_id: null` se persiste y se lee correctamente. Detalle completo en `review.md` / `compliance-matrix.md` del tech-debt.

---


_Synced from Jira by sync-jira-issues_
