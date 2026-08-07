# qa/bitacora-tests.md — Compilación de escenarios de prueba lista para AgileTest

> **Fichero vivo, append-only.** Cada sesión que añade o cambia comportamiento
> de usuario amplía este documento con escenarios nuevos. **Nunca se reescribe
> ni se borra una entrada anterior** — solo se añade debajo, exactamente igual
> que `.context/bitacora.md` y que el propio `.context/qa/regression.feature`
> son append-only. Ver la sección **"Cómo actualizar este fichero"** al final
> antes de tocar este documento.

## Qué es esto

Este fichero es la **vista compilada, lista para pegar/importar en Jira vía
la app AgileTest** (test-management tipo Xray que importa nativamente sintaxis
Cucumber/Gherkin `.feature` como issues de tipo Test), de todos los escenarios
de prueba de Fresco — Gherkin en español + su estado real de automatización
con Playwright.

**Fuente de la verdad:** `.context/qa/regression.feature`. Este fichero es una
**derivada**, no un original — compila ese `.feature` (texto Gherkin) junto
con `tests/steps/*.steps.ts` (qué está realmente automatizado y cómo). Si
alguna vez este fichero y `regression.feature` divergen, **`regression.feature`
gana** y este fichero debe re-sincronizarse a partir de él.

**Cómo importar a AgileTest:** cada bloque ` ```gherkin ` de este documento es
el cuerpo de un `Escenario` Cucumber válido, copiable tal cual dentro de un
Test issue de AgileTest (o de un `.feature` que agrupe varios, usando la
misma cabecera `# language: es` / `Característica:` que ya declara
`regression.feature`). Los encabezados `##` de cada área se corresponden con
los grupos de sección (`# ====...====`) del `.feature` origen — útil como
criterio de carpeta/folder en AgileTest si la herramienta lo soporta.

**Última actualización:** 2026-08-07.

## Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Escenarios totales | 93 |
| `@automatizado` (tienen test Playwright real) | 21 |
| `@pendiente` (escritos, sin verificar ni automatizar) | 4 |
| `@no-implementado` (comportamiento deseado, aún sin construir) | 0 — todo lo que estaba `@no-implementado` ya ha enviado (ver Nota) |
| `@edge-case` (causística no-camino-feliz) | 48 |
| `@verificado-manual-YYYY-MM-DD` (probado en vivo, pasó) | 90 |
| Ficheros de step definitions (`tests/steps/*.steps.ts`) | 12 |
| Áreas / secciones | 12 |

> **Nota sobre `@no-implementado`:** ahora mismo ningún escenario de
> `regression.feature` lleva ese tag — todo lo que en su momento se documentó
> como comportamiento deseado y no construido ya se implementó (el tag se
> retira cuando el escenario pasa a `@pendiente` o `@verificado-manual-*`, la
> Gherkin nunca se borra). Si una sesión futura documenta una nueva feature
> antes de que exista código, esta fila del resumen debe volver a subir de 0.

## Índice de áreas

1. Autenticación (5 escenarios)
2. Onboarding y generación de menú — EPIC-FRESCO-4 / EPIC-FRESCO-6 (11 escenarios)
3. Modo Invitado y Registro Progresivo — EPIC-FRESCO-16 / EPIC-FRESCO-18 (8 escenarios)
4. Panel de Inicio — saludo personalizado — EPIC-FRESCO-54 / STORY-FRESCO-55 (12 escenarios)
5. Control del Menú Semanal — EPIC-FRESCO-60 / STORY-FRESCO-61/62/63 (9 escenarios)
6. Calendario editable — EPIC-FRESCO-10 / STORY-FRESCO-11 (6 escenarios)
7. Aprendizaje Cocinado/Descartado — EPIC-FRESCO-14 / STORY-FRESCO-15 (6 escenarios)
8. Lista de la compra — EPIC-FRESCO-12 / STORY-FRESCO-13 (4 escenarios)
9. Guía de testeabilidad para QA (/qa) (1 escenario)
10. Seguridad — aislamiento de datos entre usuarios (3 escenarios)
11. Biblioteca de Recetas — EPIC-FRESCO-64 / STORY-FRESCO-65 (22 escenarios)
12. Perfil (6 escenarios)

---

## 1. Autenticación

### 1.1 Inicio de sesión correcto con credenciales válidas

**Tags:** `@login` `@verificado-manual-2026-07-29` `@automatizado`

```gherkin
Escenario: Inicio de sesión correcto con credenciales válidas
  Dado que existe un usuario registrado con email y contraseña válidos
  Cuando introduce esas credenciales en /login y confirma el formulario
  Entonces el sistema le redirige a /menu
  Y la sesión queda activa
```

**Automatización:** `tests/steps/login.steps.ts` — login real contra el formulario con `LOCAL_USER_EMAIL`/`LOCAL_USER_PASSWORD` de `.env`, sin mock; verifica el redirect a `/menu` y la cookie real `sb-*-auth-token` que usa `@supabase/ssr`.

### 1.2 Inicio de sesión falla con credenciales incorrectas

**Tags:** `@login` `@edge-case` `@verificado-manual-2026-07-31`

```gherkin
Escenario: Inicio de sesión falla con credenciales incorrectas
  Dado que un usuario introduce un email o contraseña incorrectos
  Cuando confirma el formulario de /login
  Entonces ve un mensaje de error claro
  Y permanece en /login sin sesión activa
```

**Automatización:** Manual, no automatizado aún.

### 1.3 Alta de nuevo usuario desde /signup

**Tags:** `@registro` `@verificado-manual-2026-07-29` `@automatizado`

```gherkin
Escenario: Alta de nuevo usuario desde /signup
  Dado que un visitante sin cuenta rellena email y contraseña en /signup
  Cuando confirma el formulario
  Entonces se crea la cuenta en Supabase Auth
  Y el sistema le redirige a /onboarding
```

**Automatización:** `tests/steps/signup.steps.ts` — el formulario real y el código real de `app/signup/page.tsx` corren tal cual en el navegador, pero la llamada de red a `auth/v1/signup` se intercepta con `page.route()` y se responde con un JSON simulado de alta exitosa (`identities` no vacío) — evita crear una cuenta real y disparar un email de confirmación real contra el rate-limit muy bajo de este proyecto en el tier gratuito, y evita el problema de no tener `service_role` key para limpiar filas de `auth.users` después.

### 1.4 Alta falla porque el email ya está registrado

**Tags:** `@registro` `@edge-case` `@verificado-manual-2026-07-31`

```gherkin
Escenario: Alta falla porque el email ya está registrado
  Dado que un visitante intenta darse de alta con un email ya existente
  Cuando confirma el formulario de /signup
  Entonces ve el mensaje de error que devuelve Supabase Auth
  Y no se crea una cuenta duplicada
  # Bug real encontrado y corregido en esta pasada: Supabase's signUp()
  # devuelve 200 sin error para un email ya registrado (comportamiento
  # anti-enumeración, `identities: []`) — el código lo trataba como éxito
  # y mandaba a /onboarding SIN sesión (dead-end silencioso, 401 después).
  # Fix: app/signup/page.tsx ahora detecta `identities.length === 0` y
  # muestra el error real.
```

**Automatización:** Manual, no automatizado aún.

### 1.5 Doble-click rápido en "Iniciar sesión" no dispara dos intentos de autenticación

**Tags:** `@login` `@edge-case` `@verificado-manual-2026-08-07`

```gherkin
Escenario: Doble-click rápido en "Iniciar sesión" no dispara dos intentos de autenticación
  Dado que un usuario completa email y contraseña válidos en /login
  Cuando hace dos clicks sincrónicos sobre "Iniciar sesión" sin esperar entre ambos
  Entonces solo se dispara una llamada de autenticación
  # FRESCO-114 (arreglado 2026-08-07): guard síncrono (useRef) en los 4
  # formularios con el mismo patrón. Verificado en vivo: 3 clicks
  # sincrónicos producen 1 solo POST.
```

**Automatización:** Manual, no automatizado aún.

> **Nota sobre 1.2:** el bug real detrás del mensaje de error crudo en
> inglés ("Invalid login credentials") se corrigió el 2026-08-06
> (FRESCO-106) — `lib/auth-errors.ts` traduce por `error.code`, con
> fallback genérico en español. Re-verificado en vivo: "Email o
> contraseña incorrectos." Mismo fix cubre 1.4 (signup).

---

## 2. Onboarding y generación de menú (EPIC-FRESCO-4 / EPIC-FRESCO-6)

### 2.1 Un usuario logueado completa el onboarding y genera su menú semanal

**Tags:** `@onboarding` `@generacion-menu` `@verificado-manual-2026-07-29`

```gherkin
Escenario: Un usuario logueado completa el onboarding y genera su menú semanal
  Dado que el usuario tiene sesión iniciada
  Y no tiene todavía un menú generado para la semana actual
  Cuando completa los 3 pasos del onboarding (dieta/alérgenos, cocinas favoritas, hogar)
  Y pulsa "Generar mi menú"
  Entonces la IA genera un menú de 21 huecos (7 días x desayuno/comida/cena)
  Y el menú queda persistido en base de datos
  Y es redirigido a /menu, donde ve el menú completo
```

**Automatización:** Manual, no automatizado aún.

### 2.2 El catálogo filtrado no tiene recetas específicas para todos los huecos

**Tags:** `@generacion-menu` `@edge-case` `@verificado-manual-2026-07-29`

```gherkin
Escenario: El catálogo filtrado no tiene recetas específicas para todos los huecos
  Dado que las restricciones del usuario dejan un catálogo con recetas insuficientes para desayuno o cena
  Cuando se genera el menú
  Entonces la IA rellena esos huecos con recetas de tipo "comida" como sustituto
  Y el sistema muestra un aviso explícito ("Antes de continuar…") explicando qué se sustituyó y por qué
```

**Automatización:** Manual, no automatizado aún.

### 2.3 El catálogo filtrado no llega al mínimo de 21 recetas para el perfil declarado (ADR-0005)

**Tags:** `@generacion-menu` `@edge-case` `@verificado-manual-2026-08-01`

```gherkin
Escenario: El catálogo filtrado no llega al mínimo de 21 recetas para el perfil declarado (ADR-0005)
  Dado que las restricciones combinadas del usuario dejan menos de 21 recetas disponibles tras el filtro SQL
  Cuando intenta generar el menú
  Entonces el sistema responde 422 "Catálogo insuficiente" antes de intentar seleccionar ninguna franja
  Y el frontend muestra el mismo mensaje amigable de restricciones demasiado estrictas
  # Reemplaza el escenario "la IA no devuelve un menú válido tras los
  # reintentos": ese loop de reintentos ya no existe (ADR-0005, selección
  # determinista — index.ts nunca vuelve a llamar a Gemini para elegir
  # franjas, no puede fallar así). Este es el único 422 de generación que
  # sigue siendo real hoy. Encontrado en vivo, no hipotético: un perfil
  # real vegano + sin gluten + alérgico a pescado dejó el catálogo en 20
  # recetas (uno menos del mínimo) el 2026-08-01, antes de ampliar el
  # catálogo a 314 recetas con margen por restricción individual. No
  # automatizado por combinatoria frágil (depende de una intersección
  # exacta que el catálogo puede dejar de reproducir según crezca) — se
  # verificó directamente contra `get_filtered_recipes()` vía SQL con el
  # perfil real que lo disparó.
```

**Automatización:** Manual, no automatizado aún (combinatoria frágil — verificado directo por SQL, no candidato a automatización estable).

### 2.4 La generación de menú es rápida y no depende de una llamada de IA por franja (ADR-0005)

**Tags:** `@generacion-menu` `@verificado-manual-2026-08-01` `@automatizado`

```gherkin
Escenario: La generación de menú es rápida y no depende de una llamada de IA por franja (ADR-0005)
  Dado que un usuario Pro con historial real completa el onboarding
  Cuando pulsa "Generar mi menú"
  Entonces el menú completo queda listo en menos de 10 segundos
  # Antes de ADR-0005 (selección vía Gemini para las 21 franjas), la
  # generación tardaba entre 20 y 110 segundos de forma variable — el
  # modelo de razonamiento gastaba cientos de tokens "pensando" antes de
  # devolver nada, sin importar el tamaño del catálogo. El umbral de 10s
  # deja margen real sobre los ~2-3s observados en vivo (incluyendo, para
  # un usuario Pro, la llamada real a Gemini para la explicación de
  # aprendizaje — la única IA que queda en el flujo).
```

**Automatización:** `tests/steps/generacion-determinista.steps.ts` — usa la cuenta dedicada `PRO_TEST_USER_EMAIL` (con historial cocinado/descartado real) para ejercer el peor caso post-ADR-0005 (la única llamada a Gemini que queda, la explicación de aprendizaje, además de la selección determinista de 21 franjas); borra solo el plan de la semana actual antes de generar y mide el tiempo real hasta `/menu` contra un umbral de 10s.

### 2.5 Ya existe un plan para la semana solicitada

**Tags:** `@generacion-menu` `@edge-case` `@verificado-manual-2026-07-31`

```gherkin
Escenario: Ya existe un plan para la semana solicitada
  Dado que el usuario ya generó un menú para la semana actual
  Cuando intenta generar de nuevo sin eliminar el plan existente
  Entonces el sistema responde 409 y no crea un plan duplicado
```

**Automatización:** Manual, no automatizado aún.

### 2.6 El perfil de usuario no existe todavía

**Tags:** `@generacion-menu` `@edge-case` `@verificado-manual-2026-07-31`

```gherkin
Escenario: El perfil de usuario no existe todavía
  Dado que un usuario autenticado nunca completó el onboarding
  Cuando se intenta generar un menú para él
  Entonces el sistema responde 404 "Perfil de usuario no encontrado"
```

**Automatización:** Manual, no automatizado aún.

### 2.7 Ninguna receta del catálogo es segura para una franja concreta (AC-4, FR-8.2)

**Tags:** `@generacion-menu` `@edge-case` `@verificado-manual-2026-07-31`

```gherkin
Escenario: Ninguna receta del catálogo es segura para una franja concreta (AC-4, FR-8.2)
  Dado que ningún ítem del catálogo filtrado cumple una regla absoluta para un día/tipo concreto
  Cuando se genera el menú
  Entonces esa franja se persiste sin receta (recipe_id null), nunca inventada ni forzada
  Y el resto de las 20 franjas se entrega con normalidad
  Y el sistema NUNCA falla la generación completa por esta causa
  # Verificado dos veces: (1) fixture real de DB con recipe_id null + join
  # exacto que usa el frontend; (2) ocurrió naturalmente en una generación
  # real con Gemini durante la verificación del escenario 409 (misma
  # sesión) — el modelo devolvió el sentinel + advertencia sin que se le
  # pidiera a propósito.
```

**Automatización:** Manual, no automatizado aún.

### 2.8 El frontend muestra la franja sin receta segura

**Tags:** `@generacion-menu` `@edge-case` `@verificado-manual-2026-07-31` `@automatizado`

```gherkin
Escenario: El frontend muestra la franja sin receta segura
  Dado que un menú persistido tiene una franja con recipe_id null
  Cuando el usuario visita /menu o /calendar
  Entonces ve esa franja marcada como "Sin receta segura", sin crashear
  Y no puede arrastrarla ni marcarla como cocinada/descartada
```

**Automatización:** `tests/steps/entrega-parcial.steps.ts` — siembra directamente por REST (sin mock) una franja `recipe_id null` en el plan de la cuenta dedicada `PRO_TEST_USER_EMAIL` (no la compartida `LOCAL_USER_EMAIL`, para no colisionar con el fixture pendiente de `@aprendizaje`); comprueba en `/menu` y `/calendar` que la franja se ve marcada "Sin receta segura", sin botones de marcar cocinada/descartada y con el drag handle deshabilitado.

### 2.9 El 409 de "ya existe un menú" muestra un mensaje accionable en /onboarding

**Tags:** `@onboarding` `@edge-case` `@verificado-manual-2026-08-06`

```gherkin
Escenario: El 409 de "ya existe un menú" muestra un mensaje accionable en /onboarding
  Dado que el usuario ya generó un menú para la semana actual
  Cuando repite el flujo de onboarding completo para la misma semana
  Entonces ve un mensaje específico ("ya tienes un menú esta semana") con una salida clara a /menu o /calendar
  # FRESCO-104 (MAJOR, sin fix todavía): app/onboarding/page.tsx
  # (handleGenerate) solo distingue el caso 422 — el 409 real cae al
  # mensaje genérico "No pudimos guardar tu perfil... Intenta de nuevo.",
  # engañoso (reintentar nunca funciona) y sin salida. El equivalente en
  # components/calendar/generate-week-button.tsx SÍ maneja el 409
  # correctamente — confirma que es un gap, no una limitación técnica.
```

**Automatización:** Manual, no automatizado aún.

### 2.10 Recargar la página a mitad del onboarding no borra el progreso ya completado

**Tags:** `@onboarding` `@edge-case` `@verificado-manual-2026-08-07`

```gherkin
Escenario: Recargar la página a mitad del onboarding no borra el progreso ya completado
  Dado que el usuario completó el paso 1 o 2 del onboarding
  Cuando recarga la página antes de llegar al paso 3
  Entonces sus respuestas ya dadas siguen ahí, no vuelve al paso 1 en blanco
  # FRESCO-94 (arreglado 2026-08-07): lib/store/onboarding-store.ts ahora
  # persiste a sessionStorage vía zustand persist; verificado en vivo con
  # Playwright — tras F5 los chips de dieta/alérgenos siguen `pressed`.
  # El store se resetea al generar el menú con éxito para no filtrar
  # respuestas viejas a una futura visita en la misma pestaña.
```

**Automatización:** Manual, no automatizado aún.

### 2.11 El campo "Adultos" del hogar respeta un tope superior razonable

**Tags:** `@onboarding` `@edge-case` `@verificado-manual-2026-08-07`

```gherkin
Escenario: El campo "Adultos" del hogar respeta un tope superior razonable
  Dado que el usuario está en el paso 3 del onboarding (hogar)
  Cuando escribe un valor muy grande (ej. 999) en "Adultos"
  Entonces el sistema lo rechaza o lo acota a un máximo razonable antes de permitir generar el menú
  # FRESCO-110 (arreglado 2026-08-07): validateHousehold() valida contra
  # HOUSEHOLD_FIELD_MAX=10 (adultos y niños), igual al max=10 visual.
```

**Automatización:** Manual, no automatizado aún.

---

## 3. Modo Invitado y Registro Progresivo (EPIC-FRESCO-16 / EPIC-FRESCO-18)

### 3.1 Una visitante nueva genera un menú sin crear cuenta

**Tags:** `@invitado` `@verificado-manual-2026-07-31`

```gherkin
Escenario: Una visitante nueva genera un menú sin crear cuenta
  Dado que una visitante sin cuenta ni sesión visita la landing
  Cuando completa el onboarding de 3 pasos y genera su menú
  Entonces se crea una sesión anónima real (ADR-0003) sin que ella lo note
  Y ve su menú completo de 21 comidas en /menu, sin ningún prompt de registro
  # Confirmado en vivo: JWT decodificado con is_anonymous: true.
```

**Automatización:** Manual, no automatizado aún.

### 3.2 La invitada ve una invitación a guardar su menú

**Tags:** `@registro-progresivo` `@verificado-manual-2026-07-31` `@automatizado`

```gherkin
Escenario: La invitada ve una invitación a guardar su menú
  Dado que una invitada con sesión anónima tiene un menú ya generado
  Cuando permanece en /menu
  Entonces ve un banner "Crea una cuenta para no perder este menú"
  Y un enlace a /signup
```

**Automatización:** `tests/steps/registro-progresivo-edge.steps.ts` — genera una sesión anónima real (FRESCO-17, ADR-0003) y un menú real vía Gemini (sin mock), luego asserta el banner de guardado y su enlace a `/signup`.

### 3.3 La invitada convierte su sesión anónima en una cuenta real ⚠️ DESACTUALIZADO

**Tags:** `@registro-progresivo` `@verificado-manual-2026-07-31` `@automatizado`

> **Ver 3.7 para el comportamiento real verificado en producción.** Este
> escenario está automatizado con `updateUser()` mockeado — nunca se
> verificó de punta a punta contra el proyecto real de Supabase con un
> logout real intermedio. Con datos reales la conversión NO se completa
> (FRESCO-89, barrido QA 2026-08-06).

```gherkin
Escenario: La invitada convierte su sesión anónima en una cuenta real
  Dado que una invitada con sesión anónima y un email nuevo rellena email y contraseña en /signup
  Cuando confirma el formulario
  Entonces su sesión anónima se actualiza a una cuenta real (mismo user_id)
  Y conserva el menú que ya había generado como invitada
```

**Automatización:** `tests/steps/registro-progresivo.steps.ts` — sesión anónima real + generación real de menú (sin mock, espera explícitamente la cookie de sesión antes de avanzar el onboarding, porque un script puede ganarle la carrera al `mount effect` que crea la sesión anónima); solo la llamada final `updateUser({ email, password })` se mockea, mismo criterio que `@registro` para no quemar un envío de email real. Verifica que el menú generado como invitada sigue presente tras la conversión. **Este mock es precisamente lo que ocultó FRESCO-89** — nunca ejercitó la respuesta real de Supabase.

### 3.4 El email de conversión ya pertenece a una cuenta real distinta

**Tags:** `@registro-progresivo` `@edge-case` `@verificado-manual-2026-07-31` `@automatizado`

```gherkin
Escenario: El email de conversión ya pertenece a una cuenta real distinta
  Dado que una invitada intenta convertir su sesión con un email ya registrado
  Cuando confirma el formulario de /signup
  Entonces ve un mensaje claro explicando el conflicto
  Y se le ofrece continuar con la cuenta existente ingresando su contraseña
  # Disparado en vivo contra el email real ya registrado del usuario de
  # test — 422 email_exists real, mensaje correcto.
```

**Automatización:** `tests/steps/registro-progresivo-edge.steps.ts` — dispara el conflicto real contra `PRO_TEST_USER_EMAIL` (la cuenta "ya existente"), sin mock; verifica el mensaje de conflicto y el formulario de contraseña/reasignación.

### 3.5 La invitada resuelve el conflicto con la contraseña correcta de la cuenta existente

**Tags:** `@registro-progresivo` `@edge-case` `@verificado-manual-2026-07-31` `@automatizado`

```gherkin
Escenario: La invitada resuelve el conflicto con la contraseña correcta de la cuenta existente
  Dado que la invitada ve el conflicto de email y conoce la contraseña de esa cuenta
  Cuando la ingresa y confirma
  Entonces sus datos de invitada (menú, perfil) se reasignan a la cuenta real
  Y su sesión anónima y perfil huérfano se eliminan
  Y la cuenta real conserva exactamente su plan original, sin duplicarse
  Y es redirigida a /menu como la cuenta real
  # Verificado de punta a punta con casos reales: forzado el conflicto a
  # propósito (misma semana que la cuenta real ya tenía un plan),
  # confirmado por SQL directo (perfil/usuario anónimo borrados, plan
  # conflictivo descartado, cuenta real intacta). También clickeado en
  # navegador real en una pasada posterior.
```

**Automatización:** `tests/steps/registro-progresivo-edge.steps.ts` — siembra un plan real en `PRO_TEST_USER_EMAIL` para la semana actual, genera un menú real de invitada para la misma semana (conflicto genuino), resuelve con la contraseña real y confirma vía la API real (`reassign-guest-data`) que la cuenta real conserva exactamente 1 plan para esa semana, nada mockeado; el borrado de sesión anónima/perfil huérfano no es verificable desde el navegador y queda cubierto por la propia migración transaccional de `reassign_guest_data()`.

### 3.6 La invitada ingresa una contraseña incorrecta al intentar reasignar

**Tags:** `@registro-progresivo` `@edge-case` `@verificado-manual-2026-07-31` `@automatizado`

```gherkin
Escenario: La invitada ingresa una contraseña incorrecta al intentar reasignar
  Dado que la invitada ve el conflicto de email
  Cuando ingresa una contraseña incorrecta para esa cuenta
  Entonces ve un error claro
  Y no se mueve ni se modifica ningún dato
```

**Automatización:** `tests/steps/registro-progresivo-edge.steps.ts` — reproduce el conflicto real, envía una contraseña deliberadamente incorrecta y comprueba el mensaje de error y que sigue en `/signup` con el formulario de conflicto intacto.

### 3.7 La conversión de invitada a cuenta real no sobrevive a perder la sesión anónima original

**Tags:** `@registro-progresivo` `@edge-case` `@verificado-manual-2026-08-06`

```gherkin
Escenario: La conversión de invitada a cuenta real no sobrevive a perder la sesión anónima original
  Dado que una invitada generó un menú y "creó su cuenta" en /signup con un email nuevo
  Cuando limpia cookies/localStorage (simula cerrar el navegador o cambiar de dispositivo) e intenta loguearse con esas mismas credenciales
  Entonces el login debería funcionar siempre, porque "crear cuenta" implica que quedó guardada de verdad
  # FRESCO-89 (CRITICAL, sin fix todavía): `client.auth.updateUser({email,
  # password})` sobre un usuario anónimo en este proyecto de Supabase solo
  # encola un cambio de email pendiente (doble opt-in) — NO lo aplica de
  # inmediato. Verificado en DB: email:"", new_email seteado,
  # is_anonymous:true. app/signup/page.tsx no contempla este caso: si
  # updateUser() no devuelve error, asume éxito y redirige a /menu sin
  # ningún "revisa tu correo". Login posterior con esas credenciales →
  # 400 Invalid login credentials. Si la invitada pierde la sesión
  # anónima original, la cuenta y el menú son irrecuperables. Mismo root
  # cause rompe también 3.4/3.5 (reasignación de cuenta) — probado contra
  # el email real de PRO_TEST_USER_EMAIL, la UI de reasignación nunca se
  # dispara.
```

**Automatización:** Manual, no automatizado aún — el fix requiere primero una decisión de arquitectura (desactivar el doble opt-in de email change para este caso vs. rediseñar el flujo con confirmación explícita).

### 3.8 Cerrar sesión como invitada advierte antes de borrar el menú generado

**Tags:** `@invitado` `@edge-case` `@verificado-manual-2026-08-06`

```gherkin
Escenario: Cerrar sesión como invitada advierte antes de borrar el menú generado
  Dado que una invitada generó un menú y tiene sesión anónima activa
  Cuando toca "Cerrar sesión" en el sidebar
  Entonces se le advierte específicamente que va a perder el menú generado, distinto del logout normal de una cuenta real
  # FRESCO-90 (CRITICAL, sin fix todavía): mismo botón y copy que el
  # logout de una cuenta real (donde es 100% seguro y reversible) — para
  # una invitada es, en la práctica, un borrado irreversible de datos
  # reales (meal_plans). Verificado: tras el logout, /menu vuelve a
  # "Todavía no tienes un menú para esta semana", sin ningún aviso previo
  # diferenciado.
```

**Automatización:** Manual, no automatizado aún.

---

## 4. Panel de Inicio — saludo personalizado (EPIC-FRESCO-54 / STORY-FRESCO-55)

### 4.1 El saludo de Inicio muestra el nombre real cuando el perfil lo tiene guardado

**Tags:** `@panel-inicio` `@verificado-manual-2026-08-02`

```gherkin
Escenario: El saludo de Inicio muestra el nombre real cuando el perfil lo tiene guardado
  Dado que el usuario guardó su nombre en /profile
  Cuando abre /menu (Inicio)
  Entonces ve el saludo con su nombre real ("¡Hola, <nombre>!")
```

**Automatización:** Manual, no automatizado aún.

### 4.2 El saludo de Inicio cae a un mensaje genérico cuando el nombre no está cargado

**Tags:** `@panel-inicio` `@edge-case` `@verificado-manual-2026-08-02`

```gherkin
Escenario: El saludo de Inicio cae a un mensaje genérico cuando el nombre no está cargado
  Dado que el usuario no tiene un nombre guardado en su perfil
  Cuando abre /menu (Inicio)
  Entonces ve un saludo genérico ("¡Hola!"), sin espacio en blanco ni error
  # Verificado en vivo por la vía de sesión invitada/anónima (ADR-0003):
  # sin nombre guardado, /menu renderiza el saludo genérico sin fallo.
```

**Automatización:** Manual, no automatizado aún.

### 4.3 Los iconos de favoritos y notificaciones de Inicio navegan a sus pantallas reales ⚠️ ACTUALIZADO 2026-08-06

**Tags:** `@panel-inicio` `@verificado-manual-2026-08-06`

> Este escenario decía "son solo decorativos" — ya no es cierto, ambos
> son `<Link>` reales.

```gherkin
Escenario: Los iconos de favoritos y notificaciones de Inicio navegan a sus pantallas reales
  Dado que el usuario está en /menu (Inicio)
  Cuando toca el icono de favoritos o el de notificaciones de la cabecera
  Entonces es llevado a /favorites o /notifications respectivamente
```

**Automatización:** Manual, no automatizado aún. Mismos iconos también corregidos de tamaño/grosor el 2026-08-06 (FRESCO-85/86/87: 22px + `stroke-width` 3, antes 17.6px/20px con trazo de 2px que leía "pálido"). El fix real necesitó un `safelist: ['lucide']` en `tailwind.config.ts` porque Tailwind purgaba la clase `.lucide` — inyectada en runtime por `lucide-react`, invisible al escaneo estático de `content`.

### 4.4 La sugerencia de Calendario en Inicio lleva directo al plan semanal

**Tags:** `@panel-inicio` `@verificado-manual-2026-08-03`

```gherkin
Escenario: La sugerencia de Calendario en Inicio lleva directo al plan semanal
  Dado que el usuario está en /menu (Inicio) y ve el banner de sugerencia
  Cuando toca el botón "Ver mi plan semanal"
  Entonces es llevado directamente a /calendar
```

**Automatización:** Manual, no automatizado aún.

### 4.5 El banner de sugerencia de Calendario se muestra aunque no exista un menú generado todavía

**Tags:** `@panel-inicio` `@edge-case` `@verificado-manual-2026-08-03`

```gherkin
Escenario: El banner de sugerencia de Calendario se muestra aunque no exista un menú generado todavía
  Dado que el usuario no tiene un menú generado para esta semana
  Cuando abre /menu (Inicio)
  Entonces ve el banner de sugerencia de todas formas, junto al estado vacío
```

**Automatización:** Manual, no automatizado aún.

### 4.6 Inicio muestra el número real de recetas disponibles para el perfil del usuario

**Tags:** `@panel-inicio` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Inicio muestra el número real de recetas disponibles para el perfil del usuario
  Dado que el usuario tiene alérgenos e ingredientes marcados en su perfil
  Cuando abre /menu (Inicio)
  Entonces ve el número de recetas disponibles que respetan esas restricciones
```

**Automatización:** Manual, no automatizado aún.

### 4.7 Tocar la card de recetas disponibles lleva al catálogo

**Tags:** `@panel-inicio` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Tocar la card de recetas disponibles lleva al catálogo
  Dado que el usuario ve la card de recetas disponibles en Inicio
  Cuando toca la card
  Entonces es llevado a la pantalla de Recetas
```

**Automatización:** Manual, no automatizado aún.

### 4.8 Inicio muestra las tres estimaciones orientativas

**Tags:** `@panel-inicio` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Inicio muestra las tres estimaciones orientativas
  Dado que Laura abre Inicio
  Cuando mira las cards de estimación
  Entonces ve una estimación de gasto semanal, una de ahorro y una de tiempo recuperado, cada una indicando que es un valor orientativo
  # Cifras placeholder genéricas (no calculadas por usuario, per Business
  # Rule de FRESCO-58) — pendientes de validación real de negocio, marcadas
  # en la propia UI ("Cifras de referencia general, pendientes de validar
  # con datos reales de mercado").
```

**Automatización:** Manual, no automatizado aún.

### 4.9 Inicio muestra las últimas recetas añadidas al catálogo, dentro del perfil del usuario

**Tags:** `@panel-inicio` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Inicio muestra las últimas recetas añadidas al catálogo, dentro del perfil del usuario
  Dado que Laura abre Inicio
  Cuando mira la sección de últimas recetas
  Entonces ve las recetas agregadas más recientemente al catálogo, dentro de las que puede comer según su perfil
```

**Automatización:** Manual, no automatizado aún.

### 4.10 Tocar "Ver todas" en últimas recetas lleva al catálogo

**Tags:** `@panel-inicio` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Tocar "Ver todas" en últimas recetas lleva al catálogo
  Dado que Laura ve la sección de últimas recetas en Inicio
  Cuando toca "Ver todas"
  Entonces es llevada a la pantalla de Recetas
```

**Automatización:** Manual, no automatizado aún.

### 4.11 El sidebar muestra un placeholder de email para invitadas, no una línea en blanco

**Tags:** `@panel-inicio` `@edge-case` `@verificado-manual-2026-08-07`

```gherkin
Escenario: El sidebar muestra un placeholder de email para invitadas, no una línea en blanco
  Dado que una invitada con sesión anónima genera un menú
  Cuando mira el pie de la barra lateral (desktop)
  Entonces ve algún indicador tipo "Invitada" en vez de un espacio vacío bajo el nombre
  # FRESCO-111 (arreglado 2026-08-07): sidebar-account.tsx usa
  # {email || 'Invitada'}. Verificado en vivo.
```

**Automatización:** Manual, no automatizado aún.

### 4.12 "Ver más recetas" del scroll horizontal y "cargar más" de la lista tienen nombres accesibles distintos

**Tags:** `@panel-inicio` `@edge-case` `@verificado-manual-2026-08-07`

```gherkin
Escenario: "Ver más recetas" del scroll horizontal y "cargar más" de la lista tienen nombres accesibles distintos
  Dado que Laura está en la sección "Últimas recetas añadidas" de Inicio
  Cuando un lector de pantalla anuncia la flecha de scroll y el botón de cargar más
  Entonces cada control anuncia una acción distinta y reconocible
  # FRESCO-112 (arreglado 2026-08-07): el "botón de cargar más" descrito no
  # existe en el código actual — solo la flecha derecha del carrusel tenía
  # "Ver más recetas", renombrada a "Ver recetas siguientes".
```

**Automatización:** Manual, no automatizado aún.

---

## 5. Control del Menú Semanal (EPIC-FRESCO-60 / STORY-FRESCO-61/62/63)

### 5.1 Ver la semana siguiente desde el Calendario

**Tags:** `@calendario` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Ver la semana siguiente desde el Calendario
  Dado que el usuario está en /calendar viendo la semana actual
  Cuando toca el control de semana siguiente
  Entonces ve el menú de la semana siguiente si existe, o el estado vacío si todavía no se generó ninguno
```

**Automatización:** Manual, no automatizado aún.

### 5.2 Ver la semana anterior desde el Calendario

**Tags:** `@calendario` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Ver la semana anterior desde el Calendario
  Dado que el usuario está en /calendar viendo la semana actual
  Cuando toca el control de semana anterior
  Entonces ve el menú de la semana anterior si existe, o el estado vacío si nunca se generó uno para esa semana
```

**Automatización:** Manual, no automatizado aún.

### 5.3 Un parámetro de semana inválido en la URL cae a la semana actual

**Tags:** `@calendario` `@edge-case` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Un parámetro de semana inválido en la URL cae a la semana actual
  Dado que el usuario visita /calendar con un valor de semana mal formado en la URL
  Cuando la página carga
  Entonces ve la semana actual, sin ningún error
```

**Automatización:** Manual, no automatizado aún.

### 5.4 El usuario elimina el menú de la semana que está viendo

**Tags:** `@calendario` `@verificado-manual-2026-08-03`

```gherkin
Escenario: El usuario elimina el menú de la semana que está viendo
  Dado que el usuario ve un menú generado para la semana actual
  Cuando toca el botón de eliminar
  Entonces el menú completo de esa semana desaparece y ve el mismo estado vacío que si nunca hubiera generado uno
```

**Automatización:** Manual, no automatizado aún.

### 5.5 No hay opción de eliminar cuando no hay menú generado

**Tags:** `@calendario` `@edge-case` `@verificado-manual-2026-08-03`

```gherkin
Escenario: No hay opción de eliminar cuando no hay menú generado
  Dado que el usuario ve el estado vacío de una semana sin menú generado
  Cuando mira los controles disponibles
  Entonces no se le ofrece la opción de eliminar
```

**Automatización:** Manual, no automatizado aún.

### 5.6 Generar un menú nuevo directamente desde el Calendario

**Tags:** `@calendario` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Generar un menú nuevo directamente desde el Calendario
  Dado que el usuario está viendo una semana sin menú generado todavía
  Cuando toca "Generar mi menú"
  Entonces recibe un menú semanal completo para esa semana sin salir de /calendar
```

**Automatización:** Manual, no automatizado aún.

### 5.7 No se puede generar sobre una semana que ya tiene menú

**Tags:** `@calendario` `@edge-case` `@pendiente`

```gherkin
Escenario: No se puede generar sobre una semana que ya tiene menú
  Dado que el usuario está viendo una semana que ya tiene un menú generado
  Cuando mira los controles disponibles
  Entonces no puede generar uno nuevo directamente — primero tiene que eliminar el existente
  # Verificado estructuralmente (el botón nunca se renderiza en esa rama),
  # no como acción bloqueada explícita — @pendiente hasta un intento real
  # de re-generar sobre una semana con plan (caso defensivo 409).
```

**Automatización:** Manual, no automatizado aún — `@pendiente`, sin verificación en vivo del intento real (409 defensivo).

### 5.8 La etiqueta de semana distingue los meses cuando la semana cruza de mes

**Tags:** `@calendario` `@edge-case` `@verificado-manual-2026-08-07`

```gherkin
Escenario: La etiqueta de semana distingue los meses cuando la semana cruza de mes
  Dado que el usuario navega a una semana que empieza en un mes y termina en el siguiente (ej. 27 jul – 2 ago)
  Cuando mira la etiqueta de semana
  Entonces queda claro a qué mes pertenece cada extremo
  # FRESCO-109 (arreglado 2026-08-07): nueva formatWeekRangeLabel() en
  # lib/date/iso-week.ts. Verificado en vivo: "27 jul – 2 ago".
```

**Automatización:** Manual, no automatizado aún.

### 5.9 El botón de eliminar semana es alcanzable en mobile

**Tags:** `@calendario` `@edge-case` `@verificado-manual-2026-08-06`

```gherkin
Escenario: El botón de eliminar semana es alcanzable en mobile
  Dado que el usuario tiene un menú generado, viewport 375px
  Cuando busca el botón de eliminar semana en el header de /calendar
  Entonces está visible y alcanzable sin scroll horizontal accidental
  # FRESCO-105 (MAJOR, sin fix todavía): el botón de papelera queda casi
  # totalmente fuera del viewport (x: 374.6 sobre 375px de ancho), y
  # document.body.scrollWidth (411px) supera window.innerWidth (375px) —
  # la página gana 36px de scroll horizontal no deseado.
```

**Automatización:** Manual, no automatizado aún.

---

## 6. Calendario editable (EPIC-FRESCO-10 / STORY-FRESCO-11)

### 6.1 El usuario reordena su menú arrastrando un plato a otro hueco

**Tags:** `@calendario` `@verificado-manual-2026-07-29`

```gherkin
Escenario: El usuario reordena su menú arrastrando un plato a otro hueco
  Dado que el usuario tiene un menú generado con los 21 huecos llenos
  Cuando arrastra el plato de un día/tipo a otro hueco distinto
  Entonces ambos huecos intercambian su receta inmediatamente en pantalla
  Y el cambio queda persistido en base de datos sin acción adicional
```

**Automatización:** Manual, no automatizado aún.

### 6.2 El orden reordenado sobrevive a recargar la página

**Tags:** `@calendario` `@verificado-manual-2026-07-29`

```gherkin
Escenario: El orden reordenado sobrevive a recargar la página
  Dado que el usuario reordenó su menú previamente
  Cuando recarga /calendar
  Entonces ve el menú en el orden que dejó, no el orden original generado
```

**Automatización:** Manual, no automatizado aún.

### 6.3 El intercambio falla por error de red o de base de datos

**Tags:** `@calendario` `@edge-case` `@verificado-manual-2026-07-31`

```gherkin
Escenario: El intercambio falla por error de red o de base de datos
  Dado que el usuario arrastra un plato a otro hueco
  Cuando el guardado del nuevo orden falla
  Entonces el plato vuelve visualmente a su posición original
  Y ve un mensaje claro de que el cambio no se guardó
```

**Automatización:** Manual, no automatizado aún.

### 6.4 Un usuario autenticado puede leer de vuelta su propio menú generado

**Tags:** `@calendario` `@edge-case` `@verificado-manual-2026-07-29`

```gherkin
Escenario: Un usuario autenticado puede leer de vuelta su propio menú generado
  Dado que un usuario generó un menú y tiene su propia sesión (no admin)
  Cuando visita /menu o /calendar
  Entonces puede leer sus propias recetas asociadas sin error de permisos
  # Regresión real: la policy RLS de "recipes" solo permitía rol anon;
  # corregida 2026-07-29 (migración allow_authenticated_read_recipes).
```

**Automatización:** Manual, no automatizado aún.

### 6.5 El sistema rechaza un intercambio entre franjas de tipo distinto

**Tags:** `@calendario` `@edge-case` `@verificado-manual-2026-08-01` `@automatizado`

```gherkin
Escenario: El sistema rechaza un intercambio entre franjas de tipo distinto
  Dado que el usuario tiene un menú semanal generado con los 21 huecos llenos
  Cuando arrastra el plato de un desayuno sobre el hueco de una cena
  Entonces el intercambio no se realiza
  Y ambos huecos conservan su receta y su franja originales
  # Bug real encontrado por el usuario en vivo (screenshot, 2026-08-01):
  # arrastrar un desayuno a la franja de cena lo dejaba ahí, relabeled
  # "cena", sin ningún chequeo de tipo_plato ni en el cliente ni en
  # swap_meal_plan_slots() (SQL). Corregido en ambas capas: la función SQL
  # ahora rechaza (`raise exception`) un swap entre tipos distintos
  # (migración 20260801000000), y el cliente deshabilita como drop target
  # cualquier franja de tipo distinto — el drag inválido ni siquiera
  # arranca.
```

**Automatización:** `tests/steps/calendario.steps.ts` — siembra por REST una semana completa de 21 huecos con una receta real distinta por `tipo_plato` en la cuenta dedicada `PRO_TEST_USER_EMAIL`, arrastra en la UI real un desayuno sobre una franja de cena y comprueba que ambas franjas conservan su receta original (nombre exacto) tras el intento de swap inválido.

### 6.6 Dos arrastres simultáneos sobre huecos que se solapan

**Tags:** `@calendario` `@edge-case` `@verificado-manual-2026-07-31`

```gherkin
Escenario: Dos arrastres simultáneos sobre huecos que se solapan
  Dado que un primer intercambio todavía no ha terminado de guardarse
  Cuando el usuario arrastra de nuevo uno de esos dos huecos
  Entonces el segundo arrastre se bloquea hasta que el primero resuelve
  # Verificado con RPC mockeada con delay artificial + dos arrastres
  # solapados: solo 1 llamada de red disparada, el segundo arrastre nunca
  # llegó a la red (bloqueado por pendingSlots antes del fetch).
```

**Automatización:** Manual, no automatizado aún.

---

## 7. Aprendizaje Cocinado/Descartado (EPIC-FRESCO-14 / STORY-FRESCO-15)

### 7.1 Marcar un plato como cocinado

**Tags:** `@aprendizaje` `@verificado-manual-2026-07-31` `@automatizado`

```gherkin
Escenario: Marcar un plato como cocinado
  Dado que el usuario tiene un menú semanal generado con un plato en estado pendiente
  Cuando marca ese plato como cocinado
  Entonces el plato se muestra como cocinado
  Y no puede volver a cambiar el estado de ese mismo plato
```

**Automatización:** `tests/steps/aprendizaje.steps.ts` — backend real, sin mock, contra la cuenta compartida `LOCAL_USER_EMAIL`. El paso "Dado" no fija un hueco concreto: elige dinámicamente el primer slot que todavía muestra su botón de marcar (`[data-testid$="_mark_cocinada"]`), porque marcar es una escritura terminal e irreversible en DB — cada corrida automatizada consume permanentemente un hueco `pendiente` de los 21 de la semana real.

### 7.2 Marcar un plato como descartado

**Tags:** `@aprendizaje` `@verificado-manual-2026-07-31` `@automatizado`

```gherkin
Escenario: Marcar un plato como descartado
  Dado que el usuario tiene un menú semanal generado con un plato en estado pendiente
  Cuando marca ese plato como descartado
  Entonces el plato se muestra como descartado
  Y no puede volver a cambiar el estado de ese mismo plato
```

**Automatización:** `tests/steps/aprendizaje.steps.ts` — mismo patrón que 7.1 (backend real, hueco `pendiente` autoseleccionado dinámicamente, cuenta compartida `LOCAL_USER_EMAIL`).

### 7.3 Intentar cambiar el estado de un plato ya marcado

**Tags:** `@aprendizaje` `@edge-case` `@verificado-manual-2026-07-31` `@automatizado`

```gherkin
Escenario: Intentar cambiar el estado de un plato ya marcado
  Dado que el usuario ya marcó un plato como cocinado o descartado
  Cuando recarga la página y observa ese mismo plato
  Entonces no ve ningún control para volver a marcarlo
  Y el plato queda fijado en su estado actual
```

**Automatización:** `tests/steps/aprendizaje.steps.ts` — marca un slot real, recarga la página (lectura real desde el Server Component, no estado optimista de cliente) y confirma que sigue fijado y sin controles para volver a marcarlo.

### 7.4 Usuaria de nivel gratuito ve el aviso de marcado en Free

**Tags:** `@aprendizaje` `@edge-case` `@verificado-manual-2026-08-07` `@automatizado`

```gherkin
Escenario: Usuaria de nivel gratuito ve el aviso de marcado en Free
  Dado que el usuario es de nivel gratuito (Free)
  Cuando visita /calendar
  Entonces ve un aviso sobre marcar cocinado/descartado en el plan Free
  Y ese aviso aclara que el marcado se guarda igual, y que lo exclusivo de Pro es el aprendizaje
  # FRESCO-103 (arreglado 2026-08-07, decisión del user con recomendación):
  # el aviso original decía "es función Pro... tu menú actual no se ve
  # afectado", pero el marcado siempre persistía igual en Free (sin check
  # de userPlan en handleMarkEstado) — una usuaria Free que confiara en el
  # aviso terminaba con un cambio irreversible que creía sin efecto. Se
  # corrigió el aviso en vez de bloquear el marcado: ya persiste para
  # usuarias Free reales en producción (bloquearlo ahora sería regresión),
  # y el aprendizaje real (Pro) no está implementado todavía.
```

**Automatización:** `tests/steps/aprendizaje.steps.ts` — asume el plan `free` por defecto del perfil de `LOCAL_USER_EMAIL` (precondición asertada, no fijada por el test) y verifica el texto del aviso corregido en `/calendar`. Step + regex actualizados junto con el fix.

### 7.5 Marcar cocinado/descartado en plan Free coincide con lo que dice el aviso

Resuelto y plegado dentro de 7.4 el 2026-08-07 (FRESCO-103) — mismo hallazgo, misma fix, sin Tags/Gherkin propios ya (no cuenta como escenario aparte en el resumen ejecutivo). Ver la nota de 7.4.

### 7.5 La generación pesa el historial real de un usuario Pro y produce una explicación (FR-5.4/5.5)

**Tags:** `@aprendizaje` `@verificado-manual-2026-07-31`

```gherkin
Escenario: La generación pesa el historial real de un usuario Pro y produce una explicación (FR-5.4/5.5)
  Dado que un usuario Pro tiene al menos 2 semanas de historial cocinado/descartado real
  Cuando se genera su menú de la semana siguiente
  Entonces la IA evita repetir recetas descartadas y prioriza las bien valoradas
  Y genera una explicación cálida en "explicacion_aprendizaje", separada de "advertencias"
  Y queda persistida en su propio campo, no mezclada con las advertencias de seguridad
  # Verificado en vivo: usuario de test flippeado temporalmente a plan
  # 'pro', historial real ya existente, llamada directa al Edge Function
  # para la semana siguiente → explicación real, cálida, en primera
  # persona plural, separada limpiamente. Confirmado persistida y que el
  # select() del cliente la devuelve. Plan revertido a free después.
```

**Automatización:** Manual, no automatizado aún.

### 7.6 El usuario Pro ve la tarjeta de explicación en /menu

**Tags:** `@aprendizaje` `@verificado-manual-2026-07-31` `@automatizado`

```gherkin
Escenario: El usuario Pro ve la tarjeta de explicación en /menu
  Dado que un usuario Pro tiene explicacion_aprendizaje no nula en su menú
  Cuando visita /menu
  Entonces ve una tarjeta "card-insight" con esa explicación
  Y nunca se mezcla visualmente con el banner de advertencias
```

**Automatización:** `tests/steps/aprendizaje-pro.steps.ts` — usa `PRO_TEST_USER_EMAIL`, fuerza `plan='pro'` vía REST, siembra una semana anterior real con estado `cocinada` y dispara una llamada real (sin mock) a `generate-meal-plan` con Gemini real, para poder asertar contra una tarjeta `card-insight` real y confirmar que su texto nunca aparece dentro del banner de advertencias.

---

## 8. Lista de la compra (EPIC-FRESCO-12 / STORY-FRESCO-13)

### 8.1 Generar la lista de la compra a partir de un menú

**Tags:** `@lista-compra` `@verificado-manual-2026-07-31` `@automatizado`

```gherkin
Escenario: Generar la lista de la compra a partir de un menú
  Dado que el usuario tiene un menú semanal generado
  Cuando solicita generar la lista de la compra
  Entonces el sistema consolida los ingredientes y los clasifica por pasillo
  Y ve un resumen con el total de productos y el coste estimado
```

**Automatización:** `tests/steps/shopping-list.steps.ts` — sin mock de red (`ShoppingListGenerator` hace `router.refresh()` y siempre re-lee del servidor, por lo que mockear la llamada dejaría a esa recarga sin nada real que encontrar); llamada real a Gemini + escritura real en Supabase contra `LOCAL_USER_EMAIL`, con reset previo del fixture `shopping_lists` de esa cuenta vía REST.

### 8.2 Marcar un producto de la lista como comprado

**Tags:** `@lista-compra` `@verificado-manual-2026-07-31` `@automatizado`

```gherkin
Escenario: Marcar un producto de la lista como comprado
  Dado que el usuario tiene una lista de la compra generada
  Cuando marca un producto como comprado
  Entonces el producto se muestra visualmente como comprado
  Y el estado se conserva la próxima vez que abre la lista
```

**Automatización:** `tests/steps/shopping-list.steps.ts` — misma cuenta y patrón de reset que 8.1; genera una lista real, marca un ítem, recarga la página y confirma que el estado "comprado" persiste desde el servidor.

### 8.3 Ya existe una lista de la compra para ese menú

**Tags:** `@lista-compra` `@edge-case` `@verificado-manual-2026-07-31`

```gherkin
Escenario: Ya existe una lista de la compra para ese menú
  Dado que el usuario ya generó una lista de la compra para su menú semanal actual
  Cuando intenta generar la lista de nuevo
  Entonces ve la lista ya existente en lugar de una segunda lista duplicada
  # El propio flujo de /shopping-list ya previene esto en la práctica (solo
  # ofrece "Generar" cuando no hay lista todavía) — verificado el backstop
  # de backend directamente por API: segunda llamada → 409.
```

**Automatización:** Manual, no automatizado aún.

### 8.4 La consolidación de ingredientes no produce ningún resultado

**Tags:** `@lista-compra` `@edge-case` `@verificado-manual-2026-07-31`

```gherkin
Escenario: La consolidación de ingredientes no produce ningún resultado
  Dado que el menú semanal del usuario no tiene ingredientes que se puedan consolidar
  Cuando solicita la lista de la compra
  Entonces ve un mensaje claro de que la lista no se pudo generar, nunca una lista vacía presentada como válida
```

**Automatización:** Manual, no automatizado aún.

---

## 9. Guía de testeabilidad para QA (/qa)

### 9.1 La guía de testeabilidad en /qa es pública y muestra las 4 Edge Functions reales

**Tags:** `@qa` `@verificado-manual-2026-08-01` `@automatizado`

```gherkin
Escenario: La guía de testeabilidad en /qa es pública y muestra las 4 Edge Functions reales
  Dado que un visitante sin sesión visita /qa
  Entonces ve la arquitectura, los usuarios demo y las secciones de testing DB/API/UI
  Y ve una tarjeta por cada una de las 4 Edge Functions reales con su método y ruta
  Y no ve ningún valor real de credencial, solo nombres de variables de entorno
```

**Automatización:** `tests/steps/qa-page.steps.ts` — sin auth ni fixture (`/qa` es una página pública, estática, prerenderizada); verifica las 5 secciones (Arquitectura, Usuarios demo, Testing DB/API/UI), las 4 tarjetas de Edge Function (`generate-meal-plan`, `generate-shopping-list`, `reassign-guest-data`, `update-recipe-status`) y que solo aparecen NOMBRES de variables de entorno (`LOCAL_USER_EMAIL`, `PRO_TEST_USER_EMAIL`), nunca un valor real de credencial.

---

## 10. Seguridad — aislamiento de datos entre usuarios

### 10.1 Un usuario no puede leer el historial ni el perfil de otro pasando su UUID

**Tags:** `@seguridad` `@edge-case` `@verificado-manual-2026-08-01` `@automatizado`

```gherkin
# Cubre el fix de FRESCO-27: get_filtered_recipes/get_recent_recipe_ids son
# SECURITY DEFINER (bypassan RLS) — antes del fix confiaban ciegamente en
# p_user_id, dejando leer perfil/historial de cualquier otra cuenta real.
Escenario: Un usuario no puede leer el historial ni el perfil de otro pasando su UUID
  Dado que dos cuentas reales y distintas existen, cada una con su propio perfil e historial de comidas
  Cuando una de las cuentas llama a get_recent_recipe_ids con el UUID de la otra
  Entonces no recibe el historial real de la otra cuenta
  Cuando la misma cuenta llama a get_filtered_recipes con el UUID de la otra
  Entonces la llamada es rechazada, no se filtra el catálogo con el perfil ajeno
```

**Automatización:** `tests/steps/aislamiento-datos.steps.ts` — puro REST, sin navegador ni llamada a Gemini; con el token real de `LOCAL_USER_EMAIL` intenta leer el historial y el catálogo filtrado de `PRO_TEST_USER_EMAIL` pasando su UUID, y confirma que `get_recent_recipe_ids` devuelve `null` (silencioso) y que `get_filtered_recipes` rechaza con 400 ("caller does not own profile").

### 10.2 Un usuario no puede intercambiar franjas del menú de otra cuenta

**Tags:** `@seguridad` `@edge-case` `@verificado-manual-2026-08-01` `@automatizado`

```gherkin
Escenario: Un usuario no puede intercambiar franjas del menú de otra cuenta
  Dado que otra cuenta real tiene un menú con dos franjas propias
  Cuando intento intercambiar esas dos franjas ajenas desde mi propia sesión
  Entonces la llamada es rechazada por no ser el dueño del plan
```

**Automatización:** `tests/steps/aislamiento-datos.steps.ts` — siembra un plan/2 franjas reales en `PRO_TEST_USER_EMAIL`, intenta `swap_meal_plan_slots` con el token de `LOCAL_USER_EMAIL` y confirma 400 ("caller does not own meal plan").

### 10.3 Un usuario no puede marcar como comprado un ítem de la lista de la compra de otra cuenta

**Tags:** `@seguridad` `@edge-case` `@verificado-manual-2026-08-01` `@automatizado`

```gherkin
Escenario: Un usuario no puede marcar como comprado un ítem de la lista de la compra de otra cuenta
  Dado que otra cuenta real tiene una lista de la compra con un ítem sin comprar
  Cuando intento marcar ese ítem ajeno como comprado desde mi propia sesión
  Entonces la llamada no da error pero el ítem de la otra cuenta sigue sin comprar
```

**Automatización:** `tests/steps/aislamiento-datos.steps.ts` — siembra una lista real en `PRO_TEST_USER_EMAIL`, llama a `jsonb_set_comprado` con el token de `LOCAL_USER_EMAIL` (falla silenciosamente, 204, sin excepción) y verifica leyendo de vuelta con el token real del dueño que el ítem sigue `comprado: false` — la aserción real es sobre el dato, no solo el status HTTP.

---

## 11. Biblioteca de Recetas (EPIC-FRESCO-64 / STORY-FRESCO-65)

### 11.1 Buscar una receta por nombre en la Biblioteca

**Tags:** `@biblioteca` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Buscar una receta por nombre en la Biblioteca
  Dado que Laura está en la Biblioteca de recetas
  Cuando escribe el nombre de una receta en el buscador
  Entonces ve solo las recetas del catálogo que coinciden con ese nombre
```

**Automatización:** Manual, no automatizado aún.

### 11.2 Buscar una receta por ingrediente en la Biblioteca

**Tags:** `@biblioteca` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Buscar una receta por ingrediente en la Biblioteca
  Dado que Laura está en la Biblioteca de recetas
  Cuando escribe un ingrediente en el buscador
  Entonces ve las recetas del catálogo que contienen ese ingrediente
  # Nota real verificada en vivo: la coincidencia es por subcadena simple,
  # sin límite de palabra — buscar "pollo" también trae "Repollo
  # salteado..." porque "pollo" es subcadena literal de "repollo". No es
  # un bug contra el AC tal como está escrito, pero es una causística real
  # a tener en cuenta.
```

**Automatización:** Manual, no automatizado aún.

### 11.3 El buscador de la Biblioteca no encuentra resultados

**Tags:** `@biblioteca` `@edge-case` `@verificado-manual-2026-08-03`

```gherkin
Escenario: El buscador de la Biblioteca no encuentra resultados
  Dado que Laura busca algo que ninguna receta contiene
  Cuando mira los resultados
  Entonces ve un estado vacío claro y distinto al de "sin recetas en el catálogo"
```

**Automatización:** Manual, no automatizado aún.

### 11.4 El catálogo de la Biblioteca está vacío para el perfil de Laura

**Tags:** `@biblioteca` `@edge-case` `@pendiente`

```gherkin
Escenario: El catálogo de la Biblioteca está vacío para el perfil de Laura
  Dado que el perfil de Laura excluye todas las recetas del catálogo
  Cuando abre la Biblioteca
  Entonces ve un estado vacío que la orienta a revisar su perfil, no su búsqueda
  # No verificado en vivo — requeriría un perfil de prueba artificialmente
  # restrictivo; revisado solo en código (misma rama `length === 0` que el
  # resto de estados vacíos de esta familia de páginas).
```

**Automatización:** Manual, no automatizado aún — `@pendiente`, solo revisado en código, no en vivo.

### 11.5 Filtrar la Biblioteca por tipo de comida

**Tags:** `@biblioteca` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Filtrar la Biblioteca por tipo de comida
  Dado que Laura está en la Biblioteca
  Cuando toca la pestaña "Cena"
  Entonces ve solo recetas de cena del catálogo
```

**Automatización:** Manual, no automatizado aún.

### 11.6 Volver a ver todo el catálogo en la Biblioteca

**Tags:** `@biblioteca` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Volver a ver todo el catálogo en la Biblioteca
  Dado que Laura tiene una pestaña de tipo de comida activa
  Cuando toca "Todo"
  Entonces vuelve a ver el catálogo completo
```

**Automatización:** Manual, no automatizado aún.

### 11.7 Buscador y pestaña de tipo de comida combinados en la Biblioteca

**Tags:** `@biblioteca` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Buscador y pestaña de tipo de comida combinados en la Biblioteca
  Dado que Laura tiene la pestaña "Cena" activa
  Cuando escribe algo en el buscador
  Entonces los resultados respetan ambos filtros a la vez
```

**Automatización:** Manual, no automatizado aún.

### 11.8 Filtrar la Biblioteca por cocina

**Tags:** `@biblioteca` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Filtrar la Biblioteca por cocina
  Dado que Laura está en la Biblioteca
  Cuando selecciona un filtro de cocina, por ejemplo "Italiana"
  Entonces ve solo recetas de esa cocina
```

**Automatización:** Manual, no automatizado aún.

### 11.9 Filtrar la Biblioteca por dieta

**Tags:** `@biblioteca` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Filtrar la Biblioteca por dieta
  Dado que Laura está en la Biblioteca
  Cuando selecciona un filtro de dieta, por ejemplo "Vegano"
  Entonces ve solo recetas que cumplen esa restricción
```

**Automatización:** Manual, no automatizado aún.

### 11.10 Filtrar la Biblioteca por un alérgeno puntual

**Tags:** `@biblioteca` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Filtrar la Biblioteca por un alérgeno puntual
  Dado que Laura quiere evitar un ingrediente puntual que no tiene declarado en su perfil
  Cuando activa ese filtro de alérgeno en la Biblioteca
  Entonces no ve ninguna receta que lo contenga, sin que cambie su perfil permanente
```

**Automatización:** Manual, no automatizado aún.

### 11.11 Crear una receta propia

**Tags:** `@biblioteca` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Crear una receta propia
  Dado que Laura está en la Biblioteca
  Cuando completa el formulario "Crear propia" con nombre, ingredientes y pasos, y confirma
  Entonces su receta aparece en la sección "Tus recetas", distinguible del catálogo
```

**Automatización:** Manual, no automatizado aún.

### 11.12 Campos obligatorios al crear una receta propia

**Tags:** `@biblioteca` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Campos obligatorios al crear una receta propia
  Dado que Laura abre el formulario de "Crear propia" sin completar el nombre
  Cuando intenta guardar
  Entonces ve un mensaje claro pidiéndole completar el nombre antes de guardar
```

**Automatización:** Manual, no automatizado aún.

### 11.13 Receta propia no participa en la generación de menú

**Tags:** `@biblioteca` `@pendiente`

```gherkin
Escenario: Receta propia no participa en la generación de menú
  Dado que Laura tiene una receta propia guardada
  Cuando genera un menú semanal nuevo
  Entonces esa receta propia nunca aparece en el menú generado por la IA
  # No verificado con un ciclo de generación real -- garantía estructural
  # confirmada por code review (get_filtered_recipes()/generate-meal-plan
  # nunca referencian recetas_propias), no por prueba en vivo.
```

**Automatización:** Manual, no automatizado aún — `@pendiente`, solo garantía estructural por code review.

### 11.14 Ver detalle de una receta del catálogo

**Tags:** `@biblioteca` `@verificado-manual-2026-08-07`

```gherkin
Escenario: Ver detalle de una receta del catálogo
  Dado que Laura está en la Biblioteca
  Cuando abre una receta del catálogo
  Entonces ve su nombre, ingredientes, pasos, tiempo, dificultad y tags de dieta/alérgeno/cocina
  # Corrección 2026-08-07: los tags de dieta NUNCA se mostraban aquí desde
  # que se escribió este escenario (2026-08-03) — DIETA_LABELS vivía en un
  # módulo 'use client', invisible para este Server Component. No detectado
  # en su momento porque la verificación manual no separó "tags de dieta"
  # de "tags de alérgeno/cocina" en la evidencia. Arreglado junto con
  # FRESCO-117.
```

**Automatización:** Manual, no automatizado aún.

### 11.15 Ver detalle de una receta propia

**Tags:** `@biblioteca` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Ver detalle de una receta propia
  Dado que Laura tiene una receta propia en su Biblioteca
  Cuando la abre
  Entonces ve su nombre, ingredientes y pasos, distinguible como receta propia
```

**Automatización:** Manual, no automatizado aún.

### 11.16 Volver a la Biblioteca desde el detalle

**Tags:** `@biblioteca` `@verificado-manual-2026-08-03`

```gherkin
Escenario: Volver a la Biblioteca desde el detalle
  Dado que Laura está viendo el detalle de una receta
  Cuando elige volver
  Entonces regresa a la Biblioteca
```

**Automatización:** Manual, no automatizado aún.

### 11.17 El mensaje de "No encontramos nada" deja claro que solo aplica al catálogo

**Tags:** `@biblioteca` `@edge-case` `@verificado-manual-2026-08-07`

```gherkin
Escenario: El mensaje de "No encontramos nada" deja claro que solo aplica al catálogo
  Dado que Laura tiene una receta propia guardada y busca algo que ninguna receta del catálogo contiene
  Cuando mira la sección "Tus recetas" y el mensaje de "No encontramos nada"
  Entonces el mensaje aclara que la búsqueda/filtros no aplican a "Tus recetas", que sigue visible arriba
  # FRESCO-115 (arreglado 2026-08-07, decisión del user): RecetaPropia no
  # soporta filtros de dieta/cocina/alérgeno — se aclaró el copy del
  # EmptyState en vez de inventar lógica no soportada por el modelo de
  # datos. "Tus recetas" sigue sin filtrarse, por diseño.
```

**Automatización:** Manual, no automatizado aún.

### 11.18 Un nombre de receta propia extremadamente largo no rompe el layout de la grilla

**Tags:** `@biblioteca` `@edge-case` `@verificado-manual-2026-08-07`

```gherkin
Escenario: Un nombre de receta propia extremadamente largo no rompe el layout de la grilla
  Dado que Laura pega un nombre de ~1000 caracteres en el formulario "Crear propia"
  Cuando guarda la receta
  Entonces la tarjeta se trunca visualmente, sin desalinear el resto de la grilla "Tus recetas"
  # FRESCO-107 (arreglado 2026-08-07): maxLength={100} en el input +
  # line-clamp-2 en la card. Verificado en vivo.
```

**Automatización:** Manual, no automatizado aún.

### 11.19 El botón "Guardar receta" se deshabilita mientras el nombre esté vacío

**Tags:** `@biblioteca` `@edge-case` `@verificado-manual-2026-08-07`

```gherkin
Escenario: El botón "Guardar receta" se deshabilita mientras el nombre esté vacío
  Dado que Laura abre "Crear propia" y deja el nombre vacío o solo con espacios
  Cuando mira el botón "Guardar receta"
  Entonces está deshabilitado, no solo mostrando un error tras el click
  # FRESCO-118 (arreglado 2026-08-07): disabled={!isValid || isSaving},
  # igual que components/profile/nombre-form.tsx. Verificado en vivo con
  # Playwright: deshabilitado con nombre vacío/solo espacios, habilitado
  # al escribir un nombre real.
```

**Automatización:** Manual, no automatizado aún.

### 11.20 El texto de dificultad y coste estimado se muestra humanizado, no en snake_case crudo

**Tags:** `@biblioteca` `@edge-case` `@verificado-manual-2026-08-07`

```gherkin
Escenario: El texto de dificultad y coste estimado se muestra humanizado, no en snake_case crudo
  Dado que Laura ve una receta cuya dificultad es "muy_facil" o cuyo coste es "muy_bajo"
  Cuando mira la tarjeta o el detalle de esa receta
  Entonces ve un texto humanizado ("muy fácil"), no el valor crudo del enum con guion bajo
  # FRESCO-117 (arreglado 2026-08-07): nuevo lib/recipes/labels.ts
  # (COSTE_ESTIMADO_LABELS/DIFICULTAD_LABELS, junto a DIETA_LABELS movido
  # ahí también) consumido por recipe-card.tsx y recipe-detail.tsx.
  # Bug de arrastre encontrado en vivo: los maps vivían en recipe-card.tsx
  # ('use client') — un Server Component (recipe-detail.tsx) importando un
  # export de datos plano desde un módulo 'use client' recibe un stub de
  # client-reference, no el objeto real. Esto ya afectaba a DIETA_LABELS —
  # ver corrección en el escenario 11.14. FRESCO-116 (espacio faltante en
  # el meta de la tarjeta, "30 min ·alto") arreglado por separado el mismo
  # día (2026-08-07): faltaba un {' '} explícito en recipe-card.tsx.
  # Verificado en vivo: "30 min · alto" con espacio correcto.
```

**Automatización:** Manual, no automatizado aún.

### 11.21 Se puede marcar/desmarcar favorito desde el detalle de una receta del catálogo

**Tags:** `@biblioteca` `@edge-case` `@verificado-manual-2026-08-07`

```gherkin
Escenario: Se puede marcar/desmarcar favorito desde el detalle de una receta del catálogo
  Dado que Laura abre el detalle de una receta de catálogo
  Cuando busca el control de favorito en esa pantalla
  Entonces puede alternar el favorito ahí mismo, sin volver a la Biblioteca o Favoritos
  # FRESCO-108 (arreglado 2026-08-07): nuevo favorite-toggle-button.tsx en
  # CatalogRecipeDetail. Verificado en vivo: toggle funciona y persiste
  # tras reload.
```

**Automatización:** Manual, no automatizado aún.

### 11.22 El filtro de tipo de comida soporta navegación por flechas de teclado (patrón radiogroup)

**Tags:** `@biblioteca` `@edge-case` `@verificado-manual-2026-08-07`

```gherkin
Escenario: El filtro de tipo de comida soporta navegación por flechas de teclado (patrón radiogroup)
  Dado que Laura tabula hasta el grupo "Filtrar por tipo de comida" en la Biblioteca
  Cuando usa las flechas izquierda/derecha
  Entonces la selección se mueve entre las opciones, con Tab deteniéndose solo en la opción activa
  # FRESCO-119 (arreglado 2026-08-07): components/ui/segmented-control.tsx
  # ahora implementa roving tabindex + flechas izquierda/derecha (con
  # wrap). Verificado en vivo con Playwright sobre /recipes: solo la
  # opción marcada tiene tabindex="0", ArrowRight/ArrowLeft mueven foco y
  # selección, wrap correcto en ambos extremos.
```

**Automatización:** Manual, no automatizado aún.

---

## 12. Perfil

### 12.1 Editar preferencias de dieta y alérgenos desde el perfil

**Tags:** `@perfil` `@verificado-manual-2026-08-04`

```gherkin
Escenario: Editar preferencias de dieta y alérgenos desde el perfil
  Dado que Laura está en /profile
  Cuando activa un chip de dieta y confirma "Actualizar Preferencias"
  Entonces la preferencia queda guardada y sigue activa tras recargar la página
```

**Automatización:** Manual, no automatizado aún. Verificado en vivo con Playwright CLI contra `localhost:3000` (cuenta QA `qa.fresco@local.test`): toggle "Vegetariano" → guardar → `POST .../rest/v1/user_profiles` real (200) → reload → chip queda `[pressed]`, confirmando persistencia real en DB, no solo estado de UI. Revertido tras la prueba.

### 12.2 Descargar un backup de los propios datos en JSON

**Tags:** `@perfil` `@verificado-manual-2026-08-04`

```gherkin
Escenario: Descargar un backup de los propios datos en JSON
  Dado que Laura está en /profile
  Cuando pulsa "Descargar" en Backup JSON
  Entonces recibe un fichero con su perfil, menús, listas de la compra y recetas propias reales
```

**Automatización:** Manual, no automatizado aún. Verificado en vivo: `GET /api/profile/export` sin sesión → `401` correcto (no hay fuga sin auth); con sesión real vía navegador → descarga real `fresco-datos-<fecha>.json` con `user_profile`, `meal_plans`, `shopping_lists`, `recetas_propias` poblados con datos reales de la cuenta QA.

### 12.3 Cerrar sesión desde el perfil

**Tags:** `@perfil` `@verificado-manual-2026-08-04`

```gherkin
Escenario: Cerrar sesión desde el perfil
  Dado que Laura está en /profile con sesión activa
  Cuando pulsa "Salir"
  Entonces la cookie de sesión se elimina y vuelve a /login
```

**Automatización:** Manual, no automatizado aún. Verificado en vivo en `fresco-pro.vercel.app`: tras "Salir", `cookie-list --domain=fresco-pro.vercel.app` devuelve cero cookies (sesión realmente eliminada, no solo redirect visual). Revisitar `/menu` sin sesión después no filtra datos de nadie — muestra el estado genérico "sin plan aún" (comportamiento de invitado, ADR-0003), no un crash ni una fuga.

### 12.4 Borrar cuenta exige escribir el email exacto para habilitarse

**Tags:** `@perfil` `@edge-case` `@verificado-manual-2026-08-04`

```gherkin
Escenario: Borrar cuenta exige escribir el email exacto para habilitarse
  Dado que Laura abre el diálogo "Borrar cuenta definitivamente"
  Cuando escribe un email distinto al suyo
  Entonces el botón de confirmación sigue deshabilitado
  Cuando escribe su propio email exacto
  Entonces el botón de confirmación se habilita
```

**Automatización:** Manual, no automatizado aún. Verificado en vivo: email incorrecto → botón `[disabled]`; email exacto (`qa.fresco@local.test`) → botón habilitado. Cancelado sin confirmar (ver 12.5 — no se ejecutó el borrado real).

### 12.5 Borrar cuenta definitivamente elimina la cuenta y todos sus datos

**Tags:** `@perfil` `@pendiente`

```gherkin
Escenario: Borrar cuenta definitivamente elimina la cuenta y todos sus datos
  Dado que Laura confirma el borrado con su email exacto
  Cuando el sistema ejecuta la Edge Function delete-account
  Entonces su auth.users se elimina y el cascade de FK limpia user_profiles/meal_plans/shopping_lists/recetas_propias
  Y la sesión se cierra y es redirigida a /login con un mensaje de despedida
```

**Automatización:** Manual, no automatizado aún. **No verificado con una ejecución real de punta a punta** — destructivo e irreversible, no ejecutado contra ninguna cuenta sin confirmación explícita separada del usuario (la cuenta QA local la usan los tests automatizados de `tests/steps/*.steps.ts`, borrarla los rompería). Lo que sí está verificado: el gating del diálogo (12.4), que `delete-account` está deployada y `ACTIVE` en Supabase (`supabase functions list`), y que el cascade de FK (`user_profiles`/`meal_plans`/`shopping_lists`/`recetas_propias` → `auth.users`, todos `ON DELETE CASCADE`) está confirmado por migración — no por ejecución.

### 12.6 El input "Tu nombre" no muestra borde de error en el primer render

**Tags:** `@perfil` `@edge-case` `@verificado-manual-2026-08-07`

```gherkin
Escenario: El input "Tu nombre" no muestra borde de error en el primer render
  Dado que Laura entra a /profile con una cuenta que todavía no tiene nombre guardado
  Cuando la página carga por primera vez, sin que ella haya tocado el campo
  Entonces el input "Tu nombre" se ve neutral, sin borde de error
  # FRESCO-113 (arreglado 2026-08-07): className gateado por
  # touched && !isValid. Verificado en vivo.
```

**Automatización:** Manual, no automatizado aún.

---

## Notas de infraestructura

No son Gherkin ejecutable, pero son causística real encontrada en pruebas en vivo — checklist de regresión para no repetir el mismo hallazgo dos veces. Copiadas verbatim de la sección final de `regression.feature`:

- Toda migración nueva en `supabase/migrations/` debe aplicarse contra la DB real (`list_migrations` vía MCP) — el repo puede tener `.sql` sin aplicar.
- Toda Edge Function nueva debe deployarse (`list_edge_functions` vía MCP) — el código puede existir sin estar nunca desplegado.
- Toda tabla nueva con RLS necesita, además de las policies, el GRANT de tabla para el rol `authenticated` (y `anon` si aplica) — RLS sin GRANT bloquea todo; GRANT sin política de rol correcto también bloquea todo.
- El modelo de Gemini pineado en `supabase/functions/_shared/gemini.ts` puede quedar deprecado por Google sin aviso — verificar contra `ListModels` si un 404/"no longer available" aparece en vivo.
- Un componente con handler de evento (`onClick`) SIN `'use client'`, renderizado directo desde una página Server Component, crashea toda la página ("Event handlers cannot be passed to Client Component props") — no basta con que compile/typecheck limpio, solo se ve en vivo en el navegador. Encontrado en `RecipeCard` (bug real desde FRESCO-69, 2026-08-03, sin detectar hasta esta sesión de pruebas en vivo).

---

## Arquitectura de automatización con Playwright

No existe un `.spec.ts` escrito a mano en este repo. `playwright.config.ts` usa `defineBddConfig` de `playwright-bdd` para **generar** ficheros de test reales de Playwright directamente desde `.context/qa/regression.feature` en el momento de cargar la config, casando cada `Escenario` con sus `Given`/`When`/`Then` definidos en `tests/steps/*.steps.ts` (matching por texto/regex, no por orden ni por fichero). El propio `.feature` sigue siendo la única fuente de verdad — no hay una copia traducida a mano que pueda divergir.

- **Filtro de ejecución:** solo se generan/ejecutan los escenarios con el tag `@automatizado` (`tags: '@automatizado'` en la config) — es autosuficiente: un escenario nuevo con step definitions solo necesita el tag, sin tocar `playwright.config.ts`.
- **Un solo worker (`workers: 1`, `fullyParallel: false`):** las escenas de `@aprendizaje` mutan el mismo plan real y finito compartido (cada una toma "el primer hueco aún pendiente") — en paralelo, dos escenarios pueden pisarse el mismo hueco (encontrado en vivo). El suite es pequeño, así que el coste de velocidad es aceptable.
- **Timeout generoso (`90_000` ms):** varios flujos hacen round-trips de red reales (incluyendo llamadas reales a Gemini en algunos casos) que pueden tardar más que el default de Playwright.
- **`tests/fixtures.ts`:** exporta una única instancia `test` compartida (`base.extend()`) para todo step file que necesite estado por escenario — necesaria porque `bddgen` exige una sola instancia de test sin ambigüedad para todo el `.feature`, y dos `base.extend()` independientes en ficheros distintos rompen esa resolución.
- **`tests/test-helpers.ts`:** helpers REST/fecha compartidos (`getAccessToken`, `restHeaders`, `currentUserId`, `isoWeekOf`, `mondayOfWeekContaining`, `currentWeekMonday`) — extraídos tras acumularse copias casi idénticas en varios step files.

---

## Cómo actualizar este fichero

Este documento crece por sesión, igual que `.context/bitacora.md` y que el propio `regression.feature`. Al enviar una nueva historia con un flujo/pantalla nueva de cara al usuario:

1. **`regression.feature` primero, sigue siendo canónico.** Añade o actualiza el `Escenario` allí (con su tag correcto) antes de tocar este fichero — nunca al revés.
2. **Añade aquí la entrada correspondiente** en la sección de área que corresponda (`## N. <Área>`), al final de esa sección — nunca insertes en medio ni renumeres las entradas existentes. Si la historia abre un área completamente nueva, añade una nueva sección `## N. <Área>` **al final del documento** (después de la última área existente), igual que `regression.feature` añade sus bloques `# ====...====` nuevos al final del fichero, no ordenados alfabéticamente ni por número de épica — el orden refleja cuándo se escribió/probó, no la taxonomía.
3. **Nunca reescribas ni borres una entrada anterior.** Si un escenario cambia de comportamiento, se documenta como lo hace `regression.feature`: el escenario se actualiza in situ solo si el comportamiento real cambió (no reescritura retroactiva de historia), y los comentarios de contexto/bugs encontrados se conservan.
4. **Cuando un escenario se automatice** (o se re-automatice tras un cambio de step file), actualiza EN AMBOS SITIOS: el tag `@automatizado` + el comentario `# Automatizado: tests/steps/<fichero>.steps.ts` en `regression.feature`, y la línea **Automatización** de la entrada correspondiente aquí.
5. **Refresca el resumen ejecutivo** (sección "Resumen ejecutivo" arriba) — recalcula los conteos por tag y la fecha de "Última actualización".
6. **Actualiza el índice de áreas** si se añadió una sección nueva o cambió el conteo de escenarios de una existente.

Si en algún momento este fichero y `regression.feature` divergen (por ejemplo, alguien edita uno sin el otro), **`regression.feature` es la fuente de verdad** — este fichero se regenera/resincroniza a partir de él, nunca al revés.
