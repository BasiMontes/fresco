# Comments for FRESCO-55

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-55)

---

### Basi Montes - 8/2/2026, 9:30:13 PM

## Scope

- Saludo con el nombre real cuando el perfil del usuario lo tiene cargado
- Iconos de favoritos y de notificaciones visibles en la cabecera de Inicio (sin funcionalidad todavía — ver Out of Scope)

---

### Basi Montes - 8/2/2026, 9:30:14 PM

## Out Of Scope

- Persistencia real de favoritos (funcionalidad completa queda para una épica futura)
- Sistema de notificaciones real (funcionalidad completa queda para una épica futura)
- Edición del nombre desde esta pantalla (se hace en Perfil, fuera de esta historia)

---

### Basi Montes - 8/2/2026, 9:30:15 PM

## Acceptance Criteria

```gherkin
Scenario: Nombre cargado
Given Laura completó su perfil con su nombre
When abre la pantalla de Inicio
Then ve el saludo con su nombre real

Scenario: Nombre no cargado todavía
Given Laura no cargó su nombre en su perfil
When abre la pantalla de Inicio
Then ve un saludo genérico, sin mostrar un espacio en blanco ni un error

Scenario: Botones de favoritos y notificaciones son solo visuales
Given Laura está en la pantalla de Inicio
When toca el icono de favoritos o el de notificaciones
Then no ocurre ninguna acción funcional todavía, ya que en esta versión son solo visuales
```

---

### Basi Montes - 8/2/2026, 9:47:40 PM

## Spec Implementation Plan (Dev)

# Implementation Plan: STORY-FRESCO-55 - Inicio: saludar al usuario por su nombre

## Overview

Implementar el saludo personalizado en la cabecera de `/menu` (pantalla "Inicio"), con fallback genérico cuando el nombre no está cargado, más dos iconos de cabecera (favoritos, notificaciones) solo visuales. Como infraestructura técnica necesaria para que el saludo pueda mostrar un nombre real (ninguna historia previa de EPIC-FRESCO-54 captura el nombre del usuario), esta historia también añade la columna `nombre` a `user_profiles` y un campo mínimo de edición en `/profile`. Esta ampliación de alcance técnico fue decidida y aprobada explícitamente por el Product Owner — no se reflejará como nuevo AC en Jira, solo como necesidad de ingeniería documentada aquí.

***Acceptance Criteria a cumplir******:***

- Nombre cargado: Laura ve el saludo con su nombre real.
- Nombre no cargado todavía: Laura ve un saludo genérico, sin espacio en blanco ni error.
- Los iconos de favoritos y notificaciones son solo visuales (sin `onClick` funcional).

---

## Technical Approach

***Chosen approach******:*** Columna nullable `nombre text` en `public.user*profiles` (sin RLS propia — la tabla ya está protegida `auth.uid()`-scoped por las policies existentes `profiles*select*own` / `profiles*insert*own` / `profiles*update_own`, que cubren todas las columnas de la fila, incluida la nueva). `/menu` (Server Component) lee `nombre` junto al resto del perfil y renderiza `¡Hola, {nombre}!` o un saludo genérico si es `null`/vacío. `/profile` gana un input de texto mínimo (trim + no-vacío) que persiste vía una función nueva y estrecha en `lib/api/user-profile.ts`, sin re-usar `upsertUserProfile` (que exige el payload completo de onboarding) ni introducir react-hook-form/zod (no usados en ningún formulario existente del repo — el patrón real del proyecto es `useState` + validación manual, visto en `app/onboarding/page.tsx`).

***Alternatives considered******:***

- Reusar `upsertUserProfile` pasándole solo `nombre`: descartado — su firma exige `OnboardingProfilePayload` completo (13 campos requeridos), forzaría a leer y reenviar todo el perfil solo para cambiar un campo.
- Introducir react-hook-form + zod para el input de nombre: descartado — ninguna pantalla del repo usa esa librería hoy; añadirla para un input de un solo campo sería una abstracción no solicitada (CLAUDE.md — Simplicity First).
- Guardar `nombre` como parte de `auth.users.user*metadata` (Supabase Auth) en vez de columna en `user*profiles`: descartado — rompe el patrón ya establecido de "todo el perfil vive en `user*profiles`" (onboarding, plan, dieta, etc.), y `user*profiles` ya es lo que se lee server-side en `/menu` y `/profile`.

***Why this approach******:***

- ✅ Reutiliza el mismo patrón RLS/upsert por-fila que ya protege el resto de `user_profiles` — cero policies nuevas.
- ✅ Mantiene `/menu` como Server Component puro (ya lee `supabase.auth.getUser()`; añade una lectura de perfil sin introducir client-side data fetching).
- ✅ Función de escritura estrecha y con un solo propósito, en vez de sobrecargar `upsertUserProfile`.
- ❌ Trade-off: una función más en `lib/api/user-profile.ts` (`updateNombre`) en vez de generalizar `upsertUserProfile` a payloads parciales — aceptado porque generalizar esa función es refactor fuera de alcance de esta historia (CLAUDE.md — Surgical Changes).

---

## UI/UX Design

***Design System disponible******:**** `DESIGN.md` (repo root). No existe `master-design-plan.md` para este proyecto — esta historia degrada a fidelidad ****DESIGN.md-only*** (conformidad de tokens/componentes, sin mockup de pantalla de referencia), per CLAUDE.md Regla 14.

### Componentes del Design System a usar:

- ✅ `Button` variant `icon` size `sm` — patrón ya vivo en `components/recipe/recipe-card.tsx` (toggle de favorito circular 36×36, DESIGN.md `components.recipe-card` / token `n`). Se reutiliza tal cual para los dos botones de cabecera (favoritos, notificaciones) — mismo variant, mismo tamaño, sin `onClick` funcional (AC Scenario 3).
- ✅ `Input` (`components/ui/input.tsx`) — mismo componente usado en `app/onboarding/page.tsx` (Step 3, `adultos*input`/`ninos*input`) para el campo de nombre en `/profile`.
- ✅ `Button` variant `default` — botón "Guardar" del formulario de nombre en `/profile`.
- ✅ `Card` / `CardHeader` / `CardTitle` / `CardContent` — el input de nombre se aloja en una nueva `Card` en `/profile`, mismo patrón visual que la card de cuenta ya existente (`user?.email` / plan).
- Tipografía: heading font (Caprasimo) vía clases `text-h1`…`text-h6` ya usadas en toda la app; el saludo usa el mismo nivel `h1` que hoy ocupa "Hoy" (ver Wireframe).

### Componentes custom a crear:

Ninguno. Esta historia no requiere componentes de dominio nuevos — solo composición de `Button`/`Input`/`Card` ya existentes directamente en `menu/page.tsx` y `profile/page.tsx`.

### Wireframes/Layout:

`/menu`*** — cabecera actual vs. nueva******:***

```
ANTES:
┌──────────────────────────────────────┐
│ h1: "Hoy"                             │
│ p:  "Tu menú de lunes, listo."        │
├──────────────────────────────────────┤
│ [guest banner] [advertencias] ...     │

DESPUÉS:
┌──────────────────────────────────────┐
│ h1: "¡Hola, {nombre}!" / "¡Hola!"     │   [♡ icon] [🔔 icon]
│ p:  "Tu menú de hoy, listo."          │
├──────────────────────────────────────┤
│ [guest banner] [advertencias] ...     │   (sin cambios, AC fuera de esta historia)
```

La cabecera pasa de un bloque de texto simple a una fila (`flex justify-between items-start`): saludo + subtítulo a la izquierda, los dos `button-icon` a la derecha. Un único `h1` por página se mantiene (accesibilidad) — el saludo REEMPLAZA al `h1` "Hoy" existente en vez de coexistir con él; el texto "Hoy"/día de la semana se conserva fusionado en el `<p>` subtítulo ("Tu menú de hoy, listo.") en vez de duplicarse como heading propio.

`/profile`*** — nueva sección******:***

```
┌──────────────────────────────────────┐
│ h1: "Perfil"                          │
├──────────────────────────────────────┤
│ Card: cuenta (sin cambios)            │
├──────────────────────────────────────┤
│ Card: "Tu nombre" (NUEVA)             │
│   Input [placeholder: "Tu nombre"]    │
│   Button "Guardar"                    │
├──────────────────────────────────────┤
│ Card: upsell Pro (sin cambios)        │
```

Nueva `Card` insertada entre la card de cuenta y la card de upsell (misma posición relativa que tendría cualquier sección de "editar perfil" futura).

### Estados de UI:

- ***Nombre cargado (AC Scenario 1)******:*** `h1` muestra `¡Hola, {nombre}!`.
- ***Nombre no cargado (AC Scenario 2)******:*** `h1` muestra un saludo genérico fijo (p.ej. `¡Hola!`) — nunca un `{nombre}` vacío ni un error. Mismo patrón defensivo que `/profile` ya usa para `plan` (`?? 'free'`) y `/menu` ya usa para `plan` de lectura fallida (fallback silencioso + `console.error`).
- ***Botones favoritos/notificaciones (AC Scenario 3)******:*** siempre visibles, sin estado de loading/disabled — son decorativos hasta que una épica futura los active.
- ***Guardado de nombre en ****`/profile`**** — validación******:*** vacío/solo-espacios → botón "Guardar" deshabilitado o mensaje de error inline (mismo patrón `role="alert" aria-live="polite"` visto en `household*validation*message` de onboarding), no un mensaje de éxito genérico tipo "¡Guardado!" con relleno.
- ***Guardado de nombre — error de escritura******:*** mensaje de error inline con `role="alert"`, mismo patrón que `generate*error*message` en onboarding.

### Validaciones visuales (Formulario `/profile`):

- ***Campo nombre******:*** no vacío tras `trim()` → mensaje: "Escribe tu nombre para que podamos saludarte." Sin reglas adicionales (longitud máxima, caracteres permitidos) — se mantiene trivial per alcance de esta historia.
- ***Submit******:*** deshabilitado mientras el valor (tras trim) esté vacío, igual que `generate*menu*button` se deshabilita con `!household.valid`.

### Responsividad:

- ***Mobile (< 768px)******:*** la fila saludo + iconos se mantiene en una sola línea (`flex`); los `button-icon` (36×36) no requieren colapso especial, ya se usan en contexto de card estrecha (`recipe-card`) hoy.
- ***Desktop (> 1024px)******:*** sin cambios de layout adicionales — `mx-auto max-w-3xl` ya constriñe el ancho como en el resto de `/menu`.

### Personalidad UI/UX aplicada:

Estilo "warm and rounded" ya vigente en toda la app (Caprasimo display font, `rounded.full` en botones, `button-icon` circular) — esta historia no introduce ningún token, forma o sombra nueva, solo reutiliza los existentes.

---

## Types & Type Safety

- Añadir `nombre: string | null` a `UserProfile` en `api/schemas/user-profile.types.ts` (facade type hand-mantenido, no autogenerado).
- Correr `bun run db:types` tras aplicar la migración para regenerar `lib/supabase/types.ts` (Row/Insert/Update de `user_profiles` reflejará la nueva columna automáticamente).
- Nueva función `updateNombre(client: SupabaseClient<Database>, nombre: string): Promise<void>` en `lib/api/user-profile.ts`, mismo patrón de `UserProfileError`/fail-fast que `upsertUserProfile`/`getUserPlan`.
- Nueva función de lectura `getUserNombre(client: SupabaseClient<Database>): Promise<string | null>` (o extender la query ya existente que lee `plan` en `getMealPlanForWeek`/`/menu`, a evaluar en implementación cuál es más quirúrgico — ambas opciones son válidas, la decisión final se toma en Step 3 abajo sin bloquear el resto del plan).

---

## Content Writing

- Saludo con nombre: `¡Hola, {nombre}!` (vocabulario cálido y directo, coherente con el resto de copy de la app — "Tu menú de lunes, listo.", "Cocinar ya").
- Saludo genérico (fallback): `¡Hola!` — deliberadamente corto y neutro, nunca "Bienvenida" (evita sonar a landing/marketing en una pantalla ya autenticada).
- Subtítulo bajo el saludo: `Tu menú de hoy, listo.` (fusiona el "Hoy" del `h1` anterior con el subtítulo existente, sin perder la información).
- Label del campo en `/profile`: `Tu nombre`, placeholder `¿Cómo te llamamos?` (coherente con el tono directo de "¿Qué dieta y restricciones sigue tu hogar?" del onboarding).
- `aria-label` de los iconos: `Favoritos` y `Notificaciones` (sustantivo simple, igual que `Quitar de favoritos`/`Guardar en favoritos` ya usados en `recipe-card.tsx`).

---

## Implementation Steps

### Step 1: Migración — columna `nombre` en `user_profiles`

***Task******:*** Nueva migración Supabase que añade `nombre text` (nullable, sin default) a `public.user_profiles`.

***Details******:***

- Nombre de columna en español, siguiendo la convención literal del resto de la tabla (`.context/business/domain-glossary.md` §0) — `nombre`, no `display_name`/`name`.
- Nullable, sin `default`, sin `check` — cualquier string no vacío es válido; la validación de "no vacío" vive en el cliente (formulario), no en el schema, siguiendo el mismo criterio que el resto de campos de texto libre de la tabla (`alergenos`, `ingredientes_odiados` son arrays sin constraint de contenido).
- No requiere policy RLS propia: las tres policies existentes (`profiles*select*own`, `profiles*insert*own`, `profiles*update*own`) ya son `for select/insert/update ... using (auth.uid() = id)` a nivel de fila completa, cubren automáticamente cualquier columna nueva.
- No requiere trigger nuevo — `user*profiles*updated_at` ya cubre cualquier `update`.
- Ejecutar vía Supabase MCP (`apply*migration`) en implementación; si no disponible, SQL para ejecución manual (`alter table public.user*profiles add column nombre text;`).

***Testing******:***

- Verificación manual: `select nombre from public.user_profiles limit 1;` tras aplicar, confirma columna nullable presente.
- `mcp_*supabase**get*advisors` (security) tras aplicar — confirmar que no se dispara ningún advisory RLS nuevo (esperado: ninguno, la tabla ya tiene RLS habilitada).

***Estimated time******:*** 15 min

---

### Step 2: Regenerar tipos + actualizar facade type

***Task******:*** Sincronizar tipos TypeScript tras la migración.

***Details******:***

- Correr `bun run db:types` → regenera `lib/supabase/types.ts` (Row/Insert/Update de `user_profiles` incluye `nombre: string | null`).
- Añadir `nombre: string | null` a `UserProfile` en `api/schemas/user-profile.types.ts`.

***Testing******:***

- `bun run types:check` — cero errores nuevos.

***Estimated time******:*** 10 min

---

### Step 3: `lib/api/user-profile.ts` — leer y escribir `nombre`

***Task******:*** Añadir las dos funciones estrechas descritas en "Types & Type Safety".

***File******:*** `lib/api/user-profile.ts`

***Structure/Logic******:***

- `updateNombre(client, nombre)`: valida sesión (mismo patrón `client.auth.getUser()` + `UserProfileError` que las funciones existentes), rechaza `nombre.trim() === ''` con `UserProfileError` (defensa en profundidad — la UI ya lo previene, pero la función pública falla rápido igual que `upsertUserProfile` valida alérgenos), hace `.update({ nombre: nombre.trim() }).eq('id', user.id)`.
- `getUserNombre(client)`: mismo patrón de `getUserPlan` — `select('nombre').eq('id', user.id).maybeSingle()`, devuelve `data?.nombre ?? null` (perfil inexistente o campo null → `null`, nunca throw, igual criterio que `getUserPlan` devuelve `'free'` por defecto en vez de fallar la página).

***Edge cases handled******:***

- Perfil de invitada/anónima sin fila en `user_profiles` todavía (previo a onboarding): `getUserNombre` devuelve `null` en vez de lanzar — mismo criterio que `getUserPlan`.
- Nombre con solo espacios: rechazado por `updateNombre` (trim vacío), aunque la UI ya debería prevenir el submit.

***Testing******:***

- Unit test (`lib/api/user-profile.test.ts`, ya existe): `updateNombre` persiste el valor trimeado; rechaza vacío/espacios; `getUserNombre` devuelve `null` sin sesión de perfil y el valor real cuando existe.

***Estimated time******:*** 45 min

---

### Step 4: `/profile` — input de nombre

***Task******:*** Nueva `Card` con input + botón "Guardar" entre la card de cuenta y la card de upsell Pro.

***File******:*** `app/(app)/profile/page.tsx`

***Structure/Logic******:***

- La página sigue siendo un Server Component en su lectura inicial (`getUserNombre` server-side, igual patrón que `getUserPlan`), pero el formulario en sí necesita interactividad → se extrae un client component nuevo, p.ej. `components/profile/nombre-form.tsx` (`'use client'`), recibiendo `nombreInicial: string | null` como prop desde la page.
- Dentro del client component: `useState` para el input (mismo patrón que `adultos`/`ninos` en onboarding, sin store global — este valor no necesita persistir entre pasos), validación `trim()`, llamada a `updateNombre(createClient(), valor)` al submit, mensaje de error inline en fallo (`role="alert"`).
- Tras guardar con éxito: sin redirect ni mensaje de éxito ostentoso — el input simplemente refleja el valor guardado (igual de discreto que el resto de `/profile`, que no tiene ninguna otra acción de "guardar" hoy).

***Edge cases handled******:***

- Guardar vacío/espacios: botón deshabilitado (mismo patrón `disabled={...}` que `generate*menu*button`).
- Fallo de escritura (red/RLS): mensaje de error inline, el valor del input no se pierde (no se resetea al valor previo).

***Testing******:***

- Component/integration test: submit con nombre válido llama `updateNombre` con el valor trimeado; submit vacío no llama a la función y muestra el mensaje de validación; fallo de `updateNombre` muestra el mensaje de error.

***Estimated time******:*** 1h

---

### Step 5: `/menu` — saludo + iconos de cabecera

***Task******:*** Reemplazar el bloque `<h1>Hoy</h1>` + `<p>` actual por la cabecera con saludo + botones.

***File******:*** `app/(app)/menu/page.tsx`

***Structure/Logic******:***

- `getUserNombre(supabase)` junto a la lectura de `plan`/`getMealPlanForWeek` ya existentes, mismo `try/catch` defensivo (fallo de lectura → `null`, log a `console.error`, cae al saludo genérico — igual criterio que el resto de la página).
- `h1` con `¡Hola, {nombre}!` si `nombre` es truthy tras trim, o `¡Hola!` si no.
- Nueva fila `flex justify-between items-start` envolviendo el bloque saludo+subtítulo a la izquierda y los dos `Button variant="icon" size="sm"` (favoritos, notificaciones) a la derecha — sin `onClick` (o `onClick={() => {}}` no-op si el linter exige un handler; a confirmar en implementación cuál pasa `lint:check` sin warning).
- Iconos: `Heart` (ya importado en `recipe-card.tsx`, mismo ícono de `lucide-react`) para favoritos; `Bell` (`lucide-react`, no usado aún en el repo pero coherente con el resto del set de iconos ya en uso) para notificaciones.

***Edge cases handled******:***

- Nombre `null`/`undefined`/string vacía tras `trim()` → saludo genérico (AC Scenario 2) — nunca interpola `{null}` ni deja un hueco visual.
- Fallo de lectura de `nombre` (error de red/RLS) → mismo fallback genérico, no rompe la página (coherente con cómo ya se maneja el fallo de `getMealPlanForWeek` unas líneas más abajo en el mismo archivo).

***Testing******:***

- Component/integration test: con `nombre` cargado, el saludo muestra el nombre; con `nombre` `null`, muestra el saludo genérico sin espacio en blanco; los dos botones están presentes y un click no dispara ninguna llamada de red ni cambia estado visible.

***Estimated time******:*** 45 min

---

### Step 6: Integration

***Task******:*** Verificar el flujo completo end-to-end.

***Flow completo******:***

1. Usuaria sin `nombre` cargado abre `/menu` → ve saludo genérico `¡Hola!` (AC Scenario 2).
2. Usuaria va a `/profile`, escribe su nombre, guarda.
3. Usuaria vuelve a `/menu` → ve `¡Hola, {nombre}!` (AC Scenario 1).
4. Usuaria toca el icono de favoritos o notificaciones en `/menu` → no ocurre ninguna acción funcional (AC Scenario 3).

***Testing******:***

- E2E test (Playwright, si el proyecto ya corre suite E2E — confirmar en implementación si aplica a este flujo dado que requiere sesión real): cubre los 3 escenarios Gherkin de arriba en una sola pasada de usuaria.

***Estimated time******:*** 30 min

---

## Technical Decisions (Story-specific)

### Decision 1: Ampliar el alcance técnico de FRESCO-55 para incluir captura de nombre (no reflejado en AC de Jira)

***Chosen******:*** La migración + input de `/profile` se implementan como parte de esta historia, aprobado explícitamente por el Product Owner en sesión de planning — el Scope/AC de Jira no se modifica (queda como está: solo mostrar el saludo), esta decisión vive únicamente en este plan técnico.

***Reasoning******:***

- ✅ Sin esta ampliación, el AC Scenario 1 ("Nombre cargado") sería imposible de demostrar en ningún entorno real — ninguna otra historia de EPIC-FRESCO-54 captura el nombre.
- ✅ Alcance mínimo: un solo campo nullable, sin política RLS nueva, sin formulario complejo.
- ❌ Trade-off: el AC de Jira no menciona la edición de nombre (de hecho la lista explícitamente como Out of Scope de FRESCO-55 — "Edición del nombre desde esta pantalla [de Inicio]"), lo cual es coherente (la edición vive en `/profile`, no en `/menu`, tal como el Out of Scope indica) pero puede generar la pregunta "¿por qué esta historia toca `/profile`?" en review — se documenta aquí explícitamente para que no se lea como scope creep no autorizado.

Este es un trade-off story-local (no arquitectónico ni difícil de revertir — una columna nullable y un input), no amerita promoción a ADR.

### Decision 2: Función de escritura separada (`updateNombre`) en vez de generalizar `upsertUserProfile`

***Chosen******:*** Nueva función `updateNombre` de propósito único, en vez de convertir `upsertUserProfile` en una función de payload parcial genérica.

***Reasoning******:***

- ✅ `upsertUserProfile` es explícitamente "Onboarding-owned subset" per su propio doc comment — generalizarla mezclaría dos responsabilidades (completar onboarding vs. editar un campo puntual).
- ❌ Trade-off: dos funciones de escritura en el mismo archivo en vez de una sola — aceptado, cada una tiene un contrato claro y estrecho (CLAUDE.md — Utilities: agnostic only / no abstracciones no solicitadas).

---

## Dependencies

***Pre-requisitos técnicos******:***

- [x] Tabla `user*profiles` y sus policies RLS ya existen (migración `20260725120100*create*fresco*core_tables.sql`) — no bloqueante.
- [x] `Button variant="icon"` y `Input` ya existen en `components/ui/` — no bloqueante.
- [ ] Ninguno bloqueante identificado.

---

## Risks & Mitigations

***Risk 1******:*** El campo `nombre` queda huérfano si una usuaria nunca visita `/profile` — el saludo genérico se vuelve el estado permanente para la mayoría de usuarias en el corto plazo (nadie "descubre" el campo).

- ***Impact******:*** Low
- ***Mitigation******:*** Aceptado explícitamente en el scope decision — no forma parte del AC de esta historia impulsar el descubrimiento del campo (p.ej. un prompt en onboarding); queda fuera de alcance, candidato a una historia futura si el founder lo prioriza.

***Risk 2******:*** Restructurar el `h1` de `/menu` (de "Hoy" a saludo) podría chocar con algún test E2E o `data-testid` existente que dependa del texto "Hoy".

- ***Impact******:*** Medium
- ***Mitigation******:*** Verificar en implementación (`rg -n "Hoy" app tests` o equivalente) antes de tocar el heading; si existe un test que ancla en el texto literal "Hoy", actualizarlo como parte del mismo PR, no como seguimiento separado.

---

## Estimated Effort

| Step | Time |
| --- | --- |
| 1. Migración — columna `nombre` | 15 min |
| 2. Regenerar tipos + facade type | 10 min |
| 3. `lib/api/user-profile.ts` — leer/escribir | 45 min |
| 4. `/profile` — input de nombre | 1h |
| 5. `/menu` — saludo + iconos de cabecera | 45 min |
| 6. Integration (flujo completo) | 30 min |
| ***Total**** | ****~******3h25m*** |

***Story points******:*** - (sin estimar en Jira; historia pequeña, single-sprint)

---

## Definition of Done Checklist

- [ ] Código implementado según este plan
- [ ] Los 3 Acceptance Criteria (Gherkin) pasando
- [ ] ***Tipos del backend usados correctamente***
- [ ] ***Personalidad UI/UX aplicada consistentemente***
- [ ] ***Content Writing contextual***
- [ ] Tests unitarios escritos
- [ ] Tests E2E pasando (referencia: AC de Jira, `comments.md`)
- [ ] Code review aprobado
- [ ] Sin errores de linting/TypeScript (`bun run lint:check`, `bun run types:check`)
- [ ] Deployed to staging
- [ ] Manual smoke test en staging (desktop + mobile)

---

## Review Workload Forecast

- ***Estimated diff size******:*** ~120–180 líneas añadidas (1 migración SQL corta, 2 funciones nuevas en `lib/api/user-profile.ts`, 1 componente cliente nuevo `nombre-form.tsx`, ediciones en `menu/page.tsx` y `profile/page.tsx`, tests unitarios) / ~20–30 líneas eliminadas (bloque `h1`/`p` actual de `/menu`).
- ***Files touched******:*** 7 (1 migración nueva, `api/schemas/user-profile.types.ts`, `lib/supabase/types.ts` regenerado, `lib/api/user-profile.ts`, `components/profile/nombre-form.tsx` nuevo, `app/(app)/profile/page.tsx`, `app/(app)/menu/page.tsx`) + archivos de test.
- ***Risk tier******:**** ****Low*** — sin cambios de auth/seguridad más allá de una columna cubierta por RLS ya existente, sin refactors cruzados, alcance acotado a 2 pantallas + 1 tabla.
- ***Review lens******:*** `review-readability` (dominante — naming, composición de componentes reutilizados, claridad del nuevo client component) según la matriz de selección de lens del proyecto; no aplica el set 4R completo (no es hot path de auth/pagos/seguridad, y el diff estimado queda muy por debajo de 400 líneas).
- ***Chain strategy******:*** `solo-main` (`.agents/project.yaml` — `git_strategy.strategy: solo-main`) — commit + push directo, sin PR encadenado; el tamaño estimado del diff no amerita chained-PR splitting.

---


_Synced from Jira by sync-jira-issues_
