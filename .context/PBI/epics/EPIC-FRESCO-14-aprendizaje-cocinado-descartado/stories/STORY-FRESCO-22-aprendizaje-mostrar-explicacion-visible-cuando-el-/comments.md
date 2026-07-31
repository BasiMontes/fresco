# Comments for FRESCO-22

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-22)

---

### Basi Montes - 7/31/2026, 3:15:54 PM

## Acceptance Criteria

```gherkin
Escenario: Explicación visible para usuaria Pro con historial real
  Dado que soy Laura, usuaria Pro, y ya tengo al menos una semana previa con recetas marcadas cocinadas o descartadas
  Cuando genero mi menú de esta semana
  Entonces veo una explicación concreta, en primera persona del plural, de qué ajustó Fresco y por qué
  Y esa explicación se muestra en una tarjeta propia, distinta de cualquier advertencia de seguridad alimentaria
```

```gherkin
Escenario: Sin explicación en la primera semana de una usuaria Pro
  Dado que soy Laura, usuaria Pro recién suscrita, sin ninguna semana previa con historial
  Cuando genero mi menú
  Entonces no veo ninguna tarjeta de explicación de aprendizaje
  Y el sistema no inventa una frase genérica para rellenar el hueco
```

```gherkin
Escenario: Una usuaria Free nunca ve esta explicación
  Dado que soy una usuaria del plan Free
  Cuando genero mi menú semanal
  Entonces no veo ninguna tarjeta de explicación de aprendizaje en el menú
```

```gherkin
Escenario: Las advertencias de seguridad no se mezclan con la explicación de aprendizaje
  Dado que mi menú generado incluye tanto una advertencia de seguridad alimentaria como una explicación de aprendizaje
  Cuando veo mi menú
  Entonces ambas se muestran en componentes visualmente distintos, sin combinarse en un mismo bloque de texto
```

---

### Basi Montes - 7/31/2026, 3:15:56 PM

## Scope

- Mostrar, solo a usuarias Pro con historial real de al menos una semana, una explicación concreta de qué ajustó Fresco en el menú generado y por qué.
- Distinguir claramente esa explicación de las advertencias de seguridad alimentaria existentes — deben poder mostrarse ambas a la vez sin mezclarse en un mismo componente.
- No mostrar ninguna explicación cuando la usuaria Pro todavía no tiene historial (primera semana).

---

### Basi Montes - 7/31/2026, 3:15:57 PM

## Out Of Scope

- Cómo se pesa el historial para generar el menú en sí (qué recetas se priorizan o evitan) — eso es FR-5.4, ya implementado.
- El aviso de que el aprendizaje es una función Pro para usuarias Free — eso ya existe en `/calendar` (FRESCO-15).
- Cambios al contenido o formato de las advertencias de seguridad alimentaria — quedan intactas, solo se separan visualmente de esta explicación.

---

### Basi Montes - 7/31/2026, 3:15:58 PM

## Business Rules Specification

- La explicación solo aplica a usuarias Pro con historial real — nunca en la primera semana de suscripción Pro, y nunca para Free.
- La explicación debe ser concreta y en primera persona del plural (2-3 frases), nunca una frase vacía o genérica cuando no hay historial.
- Decisión técnica pendiente para la implementación (no resuelta en esta historia): hoy la explicación y las advertencias de seguridad comparten el mismo campo `advertencias` sin ningún discriminador — separarlas requiere un cambio de schema/prompt, no solo de UI. Ver FRESCO-21 para el trace completo de por qué esto quedó mezclado.

---

### Basi Montes - 7/31/2026, 3:26:55 PM

## Spec Implementation Plan (Dev)

***Story******:*** FRESCO-22 — Aprendizaje | Mostrar explicación visible cuando el menú se ajusta por historial Pro (FR-5.5)

### Root of the gap (confirmed via code, see FRESCO-21)

Gemini already generates the FR-5.5 explanation correctly (Pro + real history gated, prompt-level instruction), but it lands inside the same `advertencias: string[]` array as the FR-2.10/FR-8.2 safety warnings — no discriminator exists at the schema level. The dedicated `card-insight` UI component was removed as fabricated mock content in FRESCO-21; this story gives it a real, separate data source.

### Change (schema → Edge Function → API contract → frontend, in that order)

1. ***Migration***: `alter table public.meal*plans add column explicacion*aprendizaje text;` — nullable, single cohesive string (not an array; FR-5.5's "2-3 sentences" is one paragraph, not discrete warning items like `advertencias`). NULL means "no explanation this week" (Free, or Pro with no history yet) — never an empty string standing in for "nothing to say."
2. `supabase/functions/generate-meal-plan/prompt.ts`: move the FR-5.5 instruction out of the `## ADVERTENCIAS` bullet list into its own `## EXPLICACIÓN DE APRENDIZAJE` section, targeting a new top-level JSON field `explicacion_aprendizaje` (string or `null`), sibling to `advertencias`. Update the JSON schema example accordingly.
3. `supabase/functions/generate-meal-plan/types.ts`: add `explicacion_aprendizaje?: string | null` to `MenuSemanal`.
4. `supabase/functions/generate-meal-plan/index.ts`: normalize (`?.trim() || null` — a stray empty/whitespace string from the model is treated as "no explanation," not validated/retried — this isn't safety-critical like `advertencias`, so it doesn't belong in `validator.ts`'s retry-triggering checks), persist on the `meal_plans` insert, include in the response.
5. `api/schemas/api-contracts.types.ts`: add `explicacion_aprendizaje: string | null` to `GenerateMealPlanResponse`.
6. `lib/api/meal-plan.ts`: add `explicacionAprendizaje: string | null` to `MenuSemanalPersistido` + `MealPlanJoinRow`, extend the `select()` query, extend the return statement — same additive pattern already used for `slotIds`/`estados` (FRESCO-11/15).
7. `app/(app)/menu/page.tsx`: render a `Card variant="insight"` (the LEGITIMATE use of that DESIGN.md-reserved variant this time — real Pro-learning data, not the fabricated placeholder FRESCO-21 removed) when `plan.explicacionAprendizaje` is non-null. No extra `isPro` check needed client-side — the server already gates population of the field at generation time, so its mere presence is proof of the gate having passed.
8. `lib/supabase/types.ts`: regenerate (`bun run db:types`) after the migration applies, so the new column is typed.

### AC → step mapping

| AC scenario | Covered by |
| --- | --- |
| Explicación visible para usuaria Pro con historial real | Steps 1-7 — new field populated + rendered |
| Sin explicación en la primera semana de una usuaria Pro | Prompt instruction (unchanged behavior, now in its own field) + `NULL` render-gate |
| Usuaria Free nunca ve esta explicación | Same NULL gate — Free path never populates the field (existing `isPro` branch in `index.ts`, untouched) |
| Advertencias de seguridad no se mezclan con la explicación | Separate columns/fields end to end; separate `Card` in the UI |

### Workload Forecast

Estimated: ~90 additions + ~15 deletions = ~105 lines, 7 files (1 new migration)
400-line budget risk: Low
Chain strategy: n/a — `solo-main`, direct commit to `main`
Decision needed before apply: No

---


_Synced from Jira by sync-jira-issues_
