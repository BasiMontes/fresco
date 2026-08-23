# Comments for FRESCO-239

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-239)

---

### Basi Montes - 8/23/2026, 5:33:59 PM

# Implementation Plan: FRESCO-239 - Personalizar scoreRecipe() por usuario (no solo agregado global)

## Overview

Extender `scoreRecipe()` (`supabase/functions/generate-meal-plan/menu-selector.ts`) para que, en usuarios Pro/Family, sume un nudge de score basado en las marcas `cocinada`/`descartada` que ESE usuario dejó en `meal*plan*recipes.estado` — no solo en las columnas agregadas globales (`rating*promedio`, `veces*cocinada`, `veces_descartada` de `recipes`) que hoy aplican a todos por igual.

Ver ADR-0008 (`.context/ADR/ADR-0008-scorerecipe-personal-engagement-nudge-pro-only.md`) — decisión arquitectónica: reusa `meal*plan*recipes.estado` (sin tabla nueva), Pro/Family-only (preserva el boundary de ADR-0001).

***Acceptance Criteria a cumplir*** (tech-debt, sin AC formal en Jira — derivados de la descripción + ADR-0008):

- Usuario Pro/Family con recetas marcadas `cocinada` repetidas veces recibe esas recetas con score más alto que un usuario Pro/Family sin historial con la misma receta.
- Usuario Pro/Family que marcó una receta `descartada` recibe esa receta con score más bajo.
- Usuario Free no cambia de comportamiento (cero llamadas nuevas a Supabase, `userEngagement` siempre `undefined`).
- El heurístico global existente (líneas 75-77 de `menu-selector.ts`) sigue aplicando sin cambios a todos los usuarios.

---

## Technical Approach

***Chosen approach******:*** Nueva función SQL `get*user*recipe*engagement(p*user*id uuid)` (mismo patrón `security definer` + ownership check que `get*recent*recipe*marks`/`get*user*cooked*recipe*ids` de ADR-0006), llamada una sola vez por generación dentro del bloque `if (isPro)` existente en `index.ts`. Resultado mapeado a `Map<string, {cocinada, descartada}>` y pasado a `selectMenu()` → `scoreRecipe()` como parámetro opcional.

***Alternatives considered******:***

- Tabla nueva `user*recipe*ratings` con rating explícito — rechazada, mayor scope (ver ADR-0008 Alternatives).
- Aplicar a todos los tiers — rechazada, diluye boundary Free/Pro de ADR-0001 (ver ADR-0008).
- Reusar `get*recent*recipe_marks` quitándole el filtro de ventana — rechazada, esa función colapsa a una sola marca por receta dentro de una ventana; el nudge de score necesita conteos all-time (mismo razonamiento por el que ADR-0006 separó exclusión de destacadas en dos funciones).

***Why this approach******:***

- ✅ Reusa el patrón de seguridad ya auditado (ownership check `auth.uid()`) — sin superficie nueva de riesgo.
- ✅ Sin migración de datos, sin tabla nueva, sin UI nueva.
- ✅ Una sola llamada SQL adicional por generación (Pro-only), mismo call-once discipline que las funciones de ADR-0006.
- ❌ Trade-off: un round-trip SQL más en el path Pro (ahora 3 en vez de 2) — mismo trade-off que ADR-0006 ya aceptó.

---

## Implementation Steps

### ***Step 1******:****** Migración SQL — ***`get*user*recipe_engagement`

***Task******:*** Crear función SQL que devuelve conteo de `cocinada`/`descartada` por receta, para un usuario específico, all-time.

***File******:*** nueva migración `supabase/migrations/<timestamp>*add*get*user*recipe_engagement.sql`

***Details******:***

- `returns table(recipe*id uuid, veces*cocinada*usuario integer, veces*descartada*usuario integer)`, agrupado por `mpr.recipe*id`, filtrando `mpr.estado in ('cocinada', 'descartada')`.
- `language sql stable security definer set search_path = public`.
- Ownership check: `mp.user*id = p*user*id and mp.user*id = auth.uid()` (idéntico a `get*recent*recipe*marks`/`get*user*cooked*recipe_ids`).
- `revoke execute ... from public, anon; grant execute ... to authenticated;` (mismo patrón).
- Usar Supabase MCP (`mcp_*supabase**apply*migration`) para ejecutar; no incluir SQL estático embebido en el plan más allá de esta descripción.

***Testing******:***

- SQL manual: dos usuarios distintos, verificar que cada uno solo ve sus propios conteos (aislamiento — mismo patrón que `tests/steps/aislamiento-datos.steps.ts`).

***Estimated time******:*** 30 min

---

### ***Step 2******:****** Regenerar tipos + wiring en ***`index.ts`

***Task******:*** Regenerar `lib/supabase/types.ts` (Supabase MCP `generate*typescript*types`), luego llamar la nueva función dentro del bloque `if (isPro)` existente.

***File******:*** `supabase/functions/generate-meal-plan/index.ts` (líneas ~103-115)

***Structure/Logic******:***

- Dentro del `if (isPro)` ya existente, agregar llamada `supabase.rpc('get*user*recipe*engagement', { p*user_id: user.id })`.
- Construir `Map<string, { cocinada: number; descartada: number }>` a partir del resultado.
- Pasar el Map a `selectMenu({ candidates, recentRecipeIds, profile, userEngagement })`.
- Free: `userEngagement` queda `undefined`, cero llamadas nuevas.

***Edge cases handled******:***

- Usuario Pro sin historial (`data` vacío o `null`): Map vacío, `scoreRecipe` no aplica nudge (comportamiento igual al actual).
- RPC falla: mismo patrón que las llamadas existentes (`data` puede ser `null`, no se lanza excepción — no bloquea la generación).

***Testing******:***

- Unit test en `menu-selector.test.ts` (ver Step 3).

***Estimated time******:*** 20 min

---

### ***Step 3******:****** ****`scoreRecipe()`**** + ****`SelectMenuParams`**** — nudge personal***

***Task******:*** Agregar parámetro opcional `userEngagement` y el cálculo del nudge.

***File******:*** `supabase/functions/generate-meal-plan/menu-selector.ts`

***Structure/Logic******:***

- `SelectMenuParams` gana campo opcional `userEngagement?: Map<string, { cocinada: number; descartada: number }>`.
- `scoreRecipe(recipe, season, lastCategoria, lastContundente, engagement?: { cocinada: number; descartada: number })`:
- `selectMenu()` resuelve `userEngagement?.get(recipe.id)` antes de llamar `scoreRecipe()` en el loop existente (línea ~138).

***Edge cases handled******:***

- `userEngagement` `undefined` (Free, o Pro sin historial): comportamiento idéntico al actual, cero regresión.
- Receta con `cocinada` alto Y `descartada` > 0 (usuario cocinó pero después la descartó): ambos términos se aplican — el nudge negativo domina si `descartada > 0`, coherente con "lo descartaste, no lo recomendamos aunque lo hayas cocinado antes".

***Testing******:***

- Unit test: candidato con `engagement.cocinada = 3` puntúa más alto que un candidato idéntico sin `engagement`.
- Unit test: candidato con `engagement.descartada = 1` puntúa más bajo que un candidato idéntico sin `engagement`.
- Unit test: `userEngagement` ausente → score idéntico al comportamiento pre-cambio (regression guard).

***Estimated time******:*** 30 min

---

### ***Step 4******:****** Verificación + docs***

***Task******:*** Lint + build + unit tests; actualizar comentario de cabecera de `scoreRecipe()` si el propósito cambió.

***Testing******:***

- `bun run lint:check`, `bun run build` (o `tsc`), `bun test supabase/functions/generate-meal-plan/menu-selector.test.ts`.

***Estimated time******:*** 15 min

---

## Technical Decisions (Story-specific)

### Decision 1: Pesos del nudge personal (`+1.0` por cocinada, cap 5; `-6` por cualquier descartada)

***Chosen******:**** Personal signal pesa más que el global (`**0.3` cocinada, `-4` solo si `descartada > 2`) — un usuario específico marcando algo es una señal más fuerte que el agregado de toda la base.

***Reasoning******:***

- ✅ Coherente con la intención del ticket: la señal personal debe pesar más, no ser un empate con el agregado.
- ❌ Trade-off: constantes ajustadas a mano, no derivadas de datos — documentado como follow-up en ADR-0008.

Ver ADR-0008 para la decisión de storage (reusar `meal*plan*recipes.estado`, sin tabla nueva) y de tier (Pro/Family-only) — ambas promovidas a ADR por pasar el doble filtro (arquitectónicas + difíciles de revertir).

---

## Dependencies

***Pre-requisitos técnicos******:***

- [x] `get*recent*recipe*marks` / `get*user*cooked*recipe_ids` (ADR-0006) — patrón ya existente, sin bloqueo.
- [x] `isPro` gate en `index.ts` — ya existente.

---

## Risks & Mitigations

***Risk 1******:*** Un usuario Pro con mucho historial de `descartada` en recetas por lo demás bien puntuadas globalmente podría ver el catálogo disponible reducirse de forma agresiva (nudge `-6` es duro).

- ***Impact******:*** Low
- ***Mitigation******:*** El nudge no excluye la receta (a diferencia de `recentRecipeIds`), solo reordena — sigue siendo candidata si no hay mejores opciones en el slot. Revisar con datos reales post-deploy (ADR-0008 Consequences).

***Risk 2******:*** Regresión en el heurístico global para Free si el refactor de `scoreRecipe()` toca la firma de forma incorrecta.

- ***Impact******:*** Medium
- ***Mitigation******:*** Parámetro `engagement` opcional con default `undefined`; unit test de regresión explícito (Step 3).

---

## Estimated Effort

| Step | Time |
| --- | --- |
| 1. Migración SQL `get*user*recipe_engagement` | 30 min |
| 2. Wiring en `index.ts` + tipos | 20 min |
| 3. `scoreRecipe()` + `SelectMenuParams` nudge | 30 min |
| 4. Verificación + docs | 15 min |
| ***Total**** | ****~******1.5 h*** |

***Story points******:*** 2

---

## Definition of Done Checklist

- [ ] Código implementado según este plan
- [ ] Migración SQL aplicada vía Supabase MCP, tipos regenerados
- [ ] Tests unitarios: nudge positivo, nudge negativo, regresión sin `userEngagement`
- [ ] Free tier sin cambio de comportamiento (cero RPC nuevo)
- [ ] Sin errores de linting/TypeScript
- [ ] Code review aprobado (adjudicación de findings)
- [ ] ADR-0008 pasa de `Proposed` a `Accepted` (aprobación humana)
- [ ] Deployed to staging

---


_Synced from Jira by sync-jira-issues_
