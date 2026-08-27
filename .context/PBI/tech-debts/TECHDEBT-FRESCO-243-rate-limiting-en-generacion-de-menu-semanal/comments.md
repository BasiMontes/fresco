# Comments for FRESCO-243

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-243)

---

### Basi Montes - 8/23/2026, 6:47:27 PM

## Spec Implementation Plan (Dev)

# Implementation Plan: TECHDEBT-FRESCO-243 - Rate limiting en generate-meal-plan

## Overview

Añadir control de abuso a la Edge Function `generate-meal-plan`: hoy cualquier usuario autenticado puede invocarla sin límite, generando escritura/lectura repetida en BD (RPC `get*filtered*recipes`, lecturas de `user*profiles`, inserts en `meal*plans` + `meal*plan*recipes`) sin coste de contención en el propio flujo (la función ya bloquea la regeneración de la misma semana ISO con un 409, pero nada impide invocar la función repetidamente contra semanas ISO distintas o reintentar tras borrar el plan).

***Nota de precisión respecto al ticket original******:**** la descripción de FRESCO-243 habla de "límite de costo", en referencia a una posible llamada a un LLM. Verificado contra `supabase/functions/generate-meal-plan/index.ts`: por ADR-0005 la selección de los 21 slots es un algoritmo determinista (`menu-selector.ts`), sin llamada a Gemini; el único uso de Gemini que quedaba (`explicacion*aprendizaje`, FR-5.5) también es determinista (`buildLearningExplanation` en `prompt.ts`). ****No hay gasto de LLM en esta función.*** El riesgo real es abuso de escritura/lectura en Postgres (spam de filas en `meal*plans`/`meal*plan*recipes`, presión sobre `get*filtered*recipes`), no coste de inferencia.

***Acceptance Criteria a cumplir*** (derivadas para este tech-debt — el ticket no traía AC formal; confirmadas con el usuario antes de este plan):

- Mecanismo: contador en tabla Postgres (`rate_limits`), sin dependencia externa (no Upstash/Redis), verificado vía función RPC atómica para evitar condiciones de carrera entre dos requests concurrentes.
- Umbral: 5 intentos de generación por usuario por hora (ventana fija, no deslizante).
- El check ocurre justo después de `requireAuthenticatedUser`, antes de la RPC `get*filtered*recipes` — así un usuario limitado recibe un 429 rápido sin pagar el coste de lectura/procesamiento.
- El límite es por usuario, no por IP ni global — el endpoint ya está auth-gated, así que `user.id` es el discriminador natural.

## Acceptance Criteria (Gherkin)

```
Scenario: Happy path — dentro del límite
  Given un usuario autenticado con menos de 5 intentos de generación en la última hora
  When invoca POST generate-meal-plan con una semana ISO sin plan existente
  Then la función procede con el flujo normal (perfil, RPC get*filtered*recipes, selectMenu, insert)
  And el contador de intentos del usuario se incrementa en 1

Scenario: Sexto intento en la misma hora — bloqueado
  Given un usuario autenticado que ya acumula 5 intentos de generación en la última hora
  When invoca POST generate-meal-plan de nuevo
  Then la función responde 429 sin ejecutar get*filtered*recipes ni tocar meal_plans
  And el body de error indica el motivo (límite de generación alcanzado)

Scenario: La ventana expira y el contador se resetea
  Given un usuario que alcanzó el límite hace más de 1 hora (ventana fija ya cerrada)
  When invoca POST generate-meal-plan
  Then la función lo trata como una ventana nueva y permite el intento (contador vuelve a 1)

Scenario: El límite es por usuario, no por IP ni global
  Given dos usuarios autenticados distintos, cada uno con menos de 5 intentos en la última hora
  When cada uno invoca POST generate-meal-plan independientemente
  Then ambos requests proceden sin bloquearse entre sí
  And el contador de cada usuario es independiente del otro
```

---

## Technical Approach

***Chosen approach******:*** Tabla `rate*limits` en Postgres + función RPC `check*and*increment*rate*limit(p*user*id uuid, p*limit int, p*window*seconds int) returns boolean`, marcada `SECURITY DEFINER` para poder leer/escribir la tabla sin depender de policies RLS abiertas al usuario, invocada desde `index.ts` vía `supabase.rpc(...)` inmediatamente después de que `requireAuthenticatedUser` resuelve el usuario. Si la función devuelve `false` (límite alcanzado), `index.ts` lanza `HttpError('Límite de generación alcanzado, inténtalo de nuevo en unos minutos', 429)` antes de tocar `get*filtered*recipes`.

La función RPC hace el incremento y el check en una sola sentencia SQL (upsert atómico con `ON CONFLICT ... DO UPDATE` sobre `(user*id)` o `(user*id, window_start)` según el diseño final de Step 1), evitando el race condition de "leer count=4, comprobar, incrementar" en dos pasos separados desde el edge function — dos requests concurrentes del mismo usuario no pueden ambos leer 4 y proceder.

***Alternatives considered******:***

- ***Redis/Upstash externo******:*** más rápido en throughput puro, pero añade una dependencia y credencial nuevas para un único endpoint con volumen bajo. Descartado por el usuario explícitamente — mantener cero dependencias externas.
- ***Rate limit en memoria del Edge Function (closure global)******:*** Deno Edge Functions no garantizan una única instancia persistente entre invocaciones (escalan horizontalmente), así que un contador en memoria de proceso no es fiable entre requests — se perdería o duplicaría el estado. Descartado.
- ***Ventana deslizante (sliding window) en vez de fija******:*** más precisa (evita el "burst" en el borde de la ventana), pero añade complejidad (timestamps por request o log de eventos) sin necesidad clara para un umbral de 5/hora. El usuario confirmó que fixed-window es aceptable dado que encaja con la simplicidad de "tabla contador".

***Why this approach******:***

- ✅ Cero dependencias externas nuevas — reutiliza la infraestructura Postgres ya existente.
- ✅ Atómico por diseño (una sola sentencia SQL vía RPC), sin race condition entre requests concurrentes.
- ✅ Check point temprano (justo tras auth) — un usuario limitado no paga el coste de `get*filtered*recipes` ni de `selectMenu`.
- ❌ Trade-off: ventana fija tiene el efecto "burst en el borde" (un usuario podría hacer 5 requests a las 10:59 y 5 más a las 11:00) — aceptado explícitamente como aceptable para este umbral y volumen.
- ❌ Trade-off: la tabla `rate_limits` no tiene limpieza automática de filas viejas en el alcance de este ticket — filas de ventanas expiradas se acumulan indefinidamente. Ver Risks & Mitigations.

---

## Implementation Steps

### Step 1: Migración — tabla `rate*limits` + función `check*and*increment*rate_limit`

***Task******:*** Crear la migración con la tabla de contadores y la función RPC atómica.

***File (Stage 2, NO se crea en este plan)******:*** `supabase/migrations/20260823180000*add*rate*limits*table*and*check_function.sql`

***Details******:***

- Tabla `rate*limits`: `user*id uuid` (FK a `auth.users`), `window*start timestamptz`, `count int`, `updated*at timestamptz`. Clave natural sobre `(user*id, window*start)` truncado a la hora, o `user*id` como PK único con reset del `window*start` cuando expira — decisión de detalle de Stage 2, documentada como Decision 1 abajo.
- RLS: `ENABLE ROW LEVEL SECURITY` en la tabla, sin policies para el rol `authenticated` (nadie lee/escribe la tabla directamente desde el cliente) — todo el acceso pasa por la función `SECURITY DEFINER`.
- Función `check*and*increment*rate*limit(p*user*id uuid, p*limit int DEFAULT 5, p*window*seconds int DEFAULT 3600) RETURNS boolean`, `SECURITY DEFINER`, `SET search*path = public`. Hace upsert atómico: si no existe fila para el usuario o la ventana expiró, la crea/resetea con `count = 1` y devuelve `true`; si existe y `count < p*limit`, incrementa y devuelve `true`; si `count >= p*limit` y la ventana sigue vigente, devuelve `false` sin incrementar.
- `GRANT EXECUTE` de la función al rol `authenticated` (la tabla en sí queda sin grants directos).

***Testing******:***

- Manual/staging: invocar la función vía SQL editor de Supabase o `supabase.rpc()` 6 veces seguidas para el mismo `user_id` y confirmar que la 6ª devuelve `false`. Este repo no tiene harness pgTAP/SQL para tests automatizados de funciones Postgres (verificado: no existe ningún `*.test.sql` ni carpeta de tests bajo `supabase/`) — la verificación de la función en sí queda a nivel manual/staging, no unit test.

***Estimated time******:*** 45 min

---

### Step 2: Edit `supabase/functions/generate-meal-plan/index.ts` — invocar el check tras auth

***Task******:*** Añadir la llamada a `check*and*increment*rate*limit` justo después de `requireAuthenticatedUser`, antes del parseo del body / carga de perfil.

***File******:*** `supabase/functions/generate-meal-plan/index.ts`

***Structure/Logic******:***

- Tras `const user = await requireAuthenticatedUser(req, supabase)` (paso 1 actual), añadir un nuevo paso `1.5`: `const { data: allowed, error: rateLimitError } = await supabase.rpc('check*and*increment*rate*limit', { p*user*id: user.id, p*limit: 5, p*window_seconds: 3600 })`.
- Si `rateLimitError`, tratarlo como fallo de infraestructura — decisión de diseño (fail-open vs fail-closed) documentada como Decision 2 abajo.
- Si `allowed === false`, `throw new HttpError('Límite de generación alcanzado, inténtalo de nuevo en unos minutos', 429)` antes de continuar al paso 2 (parseo del body).

***Edge cases handled******:***

- Usuario que reintenta tras un 409 (plan ya existe para esa semana): el intento igualmente cuenta contra el límite, porque el check ocurre antes de la verificación de plan existente — es deliberado, ya que el objetivo es limitar el volumen de invocaciones, no solo las que generan un plan nuevo con éxito.
- Fallo de la RPC de rate limit en sí (p.ej. problema de conexión a la función): ver Decision 2 — comportamiento fail-open u fail-closed a decidir en Stage 2.

***Testing******:***

- Ver Step 3 para el test unitario de la lógica de mapeo `allowed → HttpError(429)`.
- Integración manual en staging: 6 llamadas seguidas al endpoint real con el mismo JWT, confirmar 429 en la 6ª.

***Estimated time******:*** 30 min

---

### Step 3: Test — lógica de mapeo `allowed → 429`

***Task******:*** Aislar la decisión "si `allowed === false`, lanzar 429" en una función pura testeable, siguiendo el estilo de test existente en la carpeta (`menu-selector.test.ts`, `bun:test`).

***Details******:***

- `index.ts` (el handler `Deno.serve`) no tiene test directo hoy — verificado: solo `menu-selector.test.ts` y `prompt.test.ts` existen en `supabase/functions/generate-meal-plan/`, ambos testeando funciones puras (`selectMenu`, `buildLearningExplanation`), no el handler HTTP en sí.
- Para mantener esa misma cobertura de "lógica pura, no HTTP", extraer una función auxiliar pequeña, p.ej. `assertRateLimitAllowed(allowed: boolean): void` (lanza `HttpError(..., 429)` si `false`, no-op si `true`), y testearla con `bun:test` igual que `menu-selector.test.ts`.
- El comportamiento de la función RPC (`check*and*increment*rate*limit`) en sí — el upsert atómico, el reset de ventana — no tiene test automatizado en este repo (ver Step 1); solo la lógica de decisión del lado del edge function queda cubierta por unit test.

***Testing******:***

- `describe('assertRateLimitAllowed')`: caso `allowed = true` no lanza; caso `allowed = false` lanza `HttpError` con status 429.

***Estimated time******:*** 20 min

---

## Technical Decisions (Story-specific)

### Decision 1: Forma de la clave de la tabla `rate_limits`

***Chosen******:*** `user*id` como clave única de la tabla (una fila por usuario), con `window*start` reseteado por la función cuando la ventana expira, en vez de una fila nueva por cada ventana horaria.

***Reasoning******:***

- ✅ Evita crecimiento indefinido de filas — una fila por usuario, siempre.
- ✅ El upsert atómico es más simple (`ON CONFLICT (user_id) DO UPDATE`) que gestionar múltiples filas por ventana.
- ❌ Trade-off: pierde el historial de ventanas pasadas (no hay auditoría de "cuántas veces se limitó a este usuario en el último mes") — aceptable, este ticket es control de abuso, no analítica.

### Decision 2: Comportamiento si la RPC de rate limit falla (fail-open vs fail-closed)

***Chosen (propuesto, a confirmar en Stage 2 con el implementador)******:*** fail-closed — si `check*and*increment*rate*limit` devuelve error de infraestructura (no relacionado con el límite en sí), tratarlo como 500 y no dejar pasar el request, en vez de asumir "no lo pude comprobar, dejo pasar".

***Reasoning******:***

- ✅ Consistente con el resto de `index.ts`, que ya falla rápido ante cualquier error de Supabase (`profileError`, `recipesError`, `planError`, `slotsError` todos lanzan `HttpError`).
- ❌ Trade-off: un fallo transitorio de la función RPC bloquea temporalmente TODAS las generaciones, no solo las de usuarios que abusan — mismo trade-off que ya acepta el resto del endpoint (fail-fast por diseño, NFR de este proyecto per CLAUDE.md §10 "Errors: Public methods: fail fast").

### ¿Nueva ADR?

***Recomendación******:****** sí, se sugiere una ADR nueva — ****`See ADR-NNNN (proposed)`****.***

Razonamiento contra el doble filtro de `.context/ADR/README.md`:

- ***Gate 1 (arquitectónico)******:*** el mecanismo elegido — contador Postgres + función `SECURITY DEFINER` atómica, sin dependencia externa — no es una decisión local de esta función; establece el patrón de rate limiting que previsiblemente reutilizarán futuras Edge Functions del proyecto (cualquier endpoint auth-gated con riesgo de abuso). Es un invariante cross-cutting: "el rate limiting de este proyecto vive en Postgres, no en un servicio externo".
- ***Gate 2 (difícil de revertir)******:*** si en el futuro se decide migrar a un rate limiter externo (Upstash/Redis) por volumen, habría que migrar el estado de `rate_limits` y tocar cada Edge Function que ya haya adoptado este patrón — coordinación no trivial.

No se creó el archivo ADR en este plan (fuera de alcance de Stage 1 per instrucciones) — el orquestador decide si lo materializa tras revisar este plan. No se encontró ninguna ADR existente (`ADR-0001` a `ADR-0009`) que cubra rate limiting, auth de Edge Functions o abuso de endpoints, así que este plan no contradice ninguna decisión previa.

---

## Dependencies

***Pre-requisitos técnicos******:***

- [x] `supabase/functions/_shared/auth.ts` (`requireAuthenticatedUser`) — ya existe, sin cambios necesarios.
- [x] `supabase/functions/_shared/http.ts` (`HttpError`) — ya existe, reutilizado para el 429.
- [ ] Ninguno bloqueante — este tech-debt no depende de otro ticket en curso.

---

## Risks & Mitigations

***Risk 1******:*** La tabla `rate_limits` no tiene limpieza automática de filas expiradas en el alcance de este ticket.

- ***Impact******:*** Low
- ***Mitigation******:*** Con `user*id` como clave única (Decision 1), el volumen de filas es acotado por el número de usuarios activos, no por el número de ventanas — no hay crecimiento indefinido. Si se detecta necesidad real, un `pg*cron` de limpieza (patrón ya usado en el proyecto — ver `20260823120000*enable*pg*cron*cleanup*abandoned*guest_users.sql`) puede añadirse después, fuera de este ticket.

***Risk 2******:*** Fail-closed (Decision 2) implica que un fallo transitorio de Postgres bloquea la generación de menú para todos los usuarios, no solo para quien abusa.

- ***Impact******:*** Medium
- ***Mitigation******:*** Mismo patrón de fail-fast que ya usa el resto del endpoint (perfil, catálogo, insert). Si en producción se observa que los fallos transitorios de esta RPC son más frecuentes que los de las otras queries del endpoint, se puede revisar fail-open específicamente para esta RPC en un ticket de seguimiento — no se justifica añadir esa complejidad de antemano sin evidencia.

***Risk 3******:*** El check de rate limit consume una llamada RPC adicional en cada invocación, incluso para usuarios legítimos muy por debajo del límite.

- ***Impact******:*** Low
- ***Mitigation******:*** Es una única sentencia SQL indexada por `user*id` (PK), coste marginal comparado con `get*filtered_recipes` (que ya escanea el catálogo de recetas). No se espera impacto de latencia perceptible.

---

## Estimated Effort

| Step | Time |
| --- | --- |
| 1. Migración — tabla `rate_limits` + función RPC | 45 min |
| 2. Edit `index.ts` — invocar el check tras auth | 30 min |
| 3. Test — lógica de mapeo `allowed → 429` | 20 min |
| ***Total**** | ****1h 35m*** |

***Story points******:*** 2 (tech-debt de alcance acotado, un único endpoint, sin dependencias externas nuevas)

---

## Definition of Done Checklist

- [ ] Código implementado según este plan
- [ ] Los 4 Acceptance Criteria (Gherkin) pasando
- [ ] Migración aplicada vía Supabase MCP (o SQL manual si el MCP no está disponible) — NO incluir SQL estático en este plan, ya cumplido
- [ ] Tests unitarios escritos para `assertRateLimitAllowed` (o equivalente), siguiendo el estilo de `menu-selector.test.ts`
- [ ] Verificación manual en staging: 6 invocaciones seguidas del endpoint real confirman 429 en la 6ª
- [ ] Verificación manual en staging: tras esperar (o resetear manualmente la fila), la ventana se resetea y el request vuelve a pasar
- [ ] Code review aprobado
- [ ] Sin errores de linting/TypeScript
- [ ] Deployed to staging
- [ ] Decisión sobre ADR-NNNN (proposed) tomada por el orquestador/usuario tras revisar este plan

---

## Review Workload Forecast

Estimated: 229 additions + 0 deletions = 229 total lines
400-line budget risk: Medium
Chain strategy: pending
Decision needed before apply: No

***Desglose******:***

- Migración nueva (`~70` líneas base × 1.5 nuevo archivo) = 105
- `index.ts` modificado (`~18` líneas base × 1.0) = 18
- Test nuevo `rate-limit.test.ts` + helper `assertRateLimitAllowed` (`~45` líneas base × 1.5 nuevo archivo) = 67.5
- Suma: 190.5 × 1.2 (buffer tests/docs) = 228.6 → 229

***Notes******:*** Medium risk — no se requiere decisión de chain antes de Stage 2 (el gate solo bloquea en High). Se recomienda una única PR: migración + edit + test son una unidad atómica (el edit de `index.ts` no tiene sentido sin la migración, y el test cubre la lógica que introduce el edit) — partirla en PRs encadenadas no reduciría carga cognitiva real del reviewer.

---


_Synced from Jira by sync-jira-issues_
