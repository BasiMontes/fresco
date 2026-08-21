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

**Última actualización:** 2026-08-19 (barrido QA en vivo de pantallas sin cobertura sistemática — recuperación de contraseña, Favoritos, Notificaciones, Landing pública).

## Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Escenarios totales | 136 |
| `@automatizado` (tienen test Playwright real) | 21 |
| `@pendiente` (escritos, sin verificar ni automatizar) | 10 |
| `@no-implementado` (comportamiento deseado, aún sin construir) | 0 — todo lo que estaba `@no-implementado` ya ha enviado (ver Nota) |
| `@edge-case` (causística no-camino-feliz) | 69 |
| `@verificado-manual-YYYY-MM-DD` (probado en vivo, pasó) | 126 |
| Ficheros de step definitions (`tests/steps/*.steps.ts`) | 12 |
| Áreas / secciones | 17 |

> **Nota sobre `@no-implementado`:** ahora mismo ningún escenario de
> `regression.feature` lleva ese tag — todo lo que en su momento se documentó
> como comportamiento deseado y no construido ya se implementó (el tag se
> retira cuando el escenario pasa a `@pendiente` o `@verificado-manual-*`, la
> Gherkin nunca se borra). Si una sesión futura documenta una nueva feature
> antes de que exista código, esta fila del resumen debe volver a subir de 0.

## Índice de áreas

1. Autenticación (11 escenarios)
2. Onboarding y generación de menú — EPIC-FRESCO-4 / EPIC-FRESCO-6 (11 escenarios)
3. Modo Invitado y Registro Progresivo — EPIC-FRESCO-16 / EPIC-FRESCO-18 (10 escenarios)
4. Panel de Inicio — saludo personalizado — EPIC-FRESCO-54 / STORY-FRESCO-55 (12 escenarios)
5. Control del Menú Semanal — EPIC-FRESCO-60 / STORY-FRESCO-61/62/63 (9 escenarios)
6. Calendario editable — EPIC-FRESCO-10 / STORY-FRESCO-11 (7 escenarios)
7. Aprendizaje Cocinado/Descartado — EPIC-FRESCO-14 / STORY-FRESCO-15 (6 escenarios)
8. Lista de la compra — EPIC-FRESCO-12 / STORY-FRESCO-13 (7 escenarios)
9. Guía de testeabilidad para QA (/qa) (2 escenarios)
10. Seguridad — aislamiento de datos entre usuarios (3 escenarios)
11. Biblioteca de Recetas — EPIC-FRESCO-64 / STORY-FRESCO-65 (24 escenarios)
12. Perfil (7 escenarios)
13. App Shell — metadatos globales (1 escenario)
14. Suscripción Pro / Stripe — EPIC-FRESCO-227 / STORY-FRESCO-228/230/231/232 (12 escenarios)
15. Favoritos (/favorites) (6 escenarios)
16. Centro de Avisos (/notifications) (4 escenarios)
17. Landing pública (/) (4 escenarios)

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

### 1.6 Solicitar el enlace de recuperación de contraseña

**Tags:** `@login` `@recuperar-password` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Solicitar el enlace de recuperación de contraseña
  Dado que un usuario visita /forgot-password
  Cuando introduce su email registrado y confirma el formulario
  Entonces ve un mensaje genérico confirmando que si la cuenta existe, recibirá un enlace
```

**Automatización:** Manual, no automatizado aún.

### 1.7 El mensaje de recuperación de contraseña no revela si el email existe (anti-enumeración)

**Tags:** `@login` `@recuperar-password` `@edge-case` `@verificado-manual-2026-08-19`

```gherkin
Escenario: El mensaje de recuperación de contraseña no revela si el email existe (anti-enumeración)
  Dado que un visitante introduce un email que no está registrado en /forgot-password
  Cuando confirma el formulario
  Entonces ve exactamente el mismo mensaje genérico que con un email real
  # Mismo patrón anti-enumeración que signUp() (ver 1.4), aplicado también
  # aquí por diseño de Supabase Auth. Verificado en vivo comparando ambos
  # mensajes carácter a carácter.
```

**Automatización:** Manual, no automatizado aún.

### 1.8 El campo de email en /forgot-password exige un formato válido antes de enviar

**Tags:** `@login` `@recuperar-password` `@edge-case` `@verificado-manual-2026-08-19`

```gherkin
Escenario: El campo de email en /forgot-password exige un formato válido antes de enviar
  Dado que un usuario deja vacío el campo de email en /forgot-password
  Cuando intenta confirmar el formulario
  Entonces el navegador bloquea el envío con la validación nativa del campo (required + type=email), sin llamar al backend
```

**Automatización:** Manual, no automatizado aún.

### 1.9 Confirmar la nueva contraseña detecta que no coincide con la anterior

**Tags:** `@login` `@recuperar-password` `@edge-case` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Confirmar la nueva contraseña detecta que no coincide con la anterior
  Dado que un usuario está en /update-password
  Cuando escribe una contraseña y una confirmación distintas y confirma
  Entonces ve el mensaje "Las contraseñas no coinciden."
```

**Automatización:** Manual, no automatizado aún.

### 1.10 Un mensaje de error obsoleto puede confundir sobre el problema real de la contraseña

**Tags:** `@login` `@recuperar-password` `@edge-case` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Un mensaje de error obsoleto puede confundir sobre el problema real de la contraseña
  Dado que un usuario en /update-password ya vio "Las contraseñas no coinciden." por un intento anterior
  Cuando corrige la confirmación para que ambas coincidan, pero deja una contraseña de menos de 6 caracteres, y reenvía
  Entonces el envío se bloquea por la validación nativa de longitud mínima (minLength=6)
  Y el mensaje "Las contraseñas no coinciden." sigue visible en pantalla, describiendo un problema que ya no es real
  # Bug real encontrado en vivo (barrido QA 2026-08-19), sin ticket todavía:
  # el segundo intento nunca llega al handler de JS que limpia/actualiza el
  # mensaje de error, porque minLength=6 bloquea el submit de forma
  # silenciosa (sin popup visible en este navegador/CLI) antes de que se
  # revalide el mismatch. Severidad: menor (edge-case de doble error, no
  # bloquea el flujo feliz).
```

**Automatización:** Manual, no automatizado aún.

### 1.11 Completar la recuperación de contraseña de punta a punta con el enlace real del correo

**Tags:** `@login` `@recuperar-password` `@pendiente`

```gherkin
Escenario: Completar la recuperación de contraseña de punta a punta con el enlace real del correo
  Dado que un usuario solicitó recuperar su contraseña y recibió el email real
  Cuando sigue el enlace, cae en /update-password con una sesión de recuperación válida, y confirma una contraseña nueva válida
  Entonces su contraseña queda actualizada y puede volver a loguearse con la nueva
  # No ejecutado de punta a punta -- requiere leer un inbox real (sin
  # fixture en tests/) y es una acción irreversible sobre la cuenta QA
  # compartida (cambiaría su contraseña real). Verificado en cambio: el
  # formulario valida coincidencia + longitud mínima correctamente sin
  # llegar a enviar nada al backend.
```

**Automatización:** Manual, no automatizado aún — `@pendiente`, bloqueado por falta de fixture de inbox real.

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

### 3.3 La invitada convierte su sesión anónima en una cuenta real

**Tags:** `@registro-progresivo` `@verificado-manual-2026-08-07`

> FRESCO-89 (arreglado 2026-08-07): el flujo real de dos pasos (email →
> verificación OTP → password) reemplaza al escenario mockeado que ocultaba
> el bug. Ver 3.7 para el detalle del fix.

```gherkin
Escenario: La invitada convierte su sesión anónima en una cuenta real
  Dado que una invitada con sesión anónima y un email nuevo rellena email y contraseña en /signup
  Cuando confirma el formulario y verifica el código de 6 dígitos enviado a su correo
  Entonces su sesión anónima se actualiza a una cuenta real (mismo user_id)
  Y conserva el menú que ya había generado como invitada
```

**Automatización:** ninguna — `tests/steps/registro-progresivo.steps.ts` quedó desconectada de `regression.feature` (ya no tiene `@automatizado`, el proyecto solo compila escenarios con ese tag). Su mock de `updateUser({ email, password })` es precisamente lo que ocultó FRESCO-89 — verificado en vivo con Playwright contra el proyecto real de Supabase en su lugar (pantalla "Revisa tu correo" tras el paso 1, error traducido con un código erróneo). El tramo final del camino feliz (código real → password → login sobrevive a perder la sesión anónima) queda pendiente de QA manual — no hay fixture de lectura de inbox real en `tests/`.

### 3.4 El email de conversión ya pertenece a una cuenta real distinta

**Tags:** `@registro-progresivo` `@edge-case` `@pendiente`

```gherkin
Escenario: El email de conversión ya pertenece a una cuenta real distinta
  Dado que una invitada intenta convertir su sesión con un email ya registrado
  Cuando confirma el formulario de /signup y verifica el código de 6 dígitos
  Entonces ve un mensaje claro explicando el conflicto
  Y se le ofrece continuar con la cuenta existente ingresando su contraseña
```

**Automatización:** `tests/steps/registro-progresivo-edge.steps.ts` — `test.skip()`'d desde FRESCO-89 (arreglado 2026-08-07), con el motivo documentado en el header del archivo. Verificado en vivo (dos veces, con `USER_EMAIL_PRE` y con la llamada `updateUser({email, password})` original combinada) que Supabase encola el cambio con 200 sin error incluso cuando el email de destino ya pertenece a otra cuenta confirmada — mismo comportamiento anti-enumeración que este archivo ya documenta para `signUp()`. `email_exists` ahora solo puede surgir dentro de `handleVerifyOtp` (`app/signup/page.tsx`), que lo captura y muestra esta misma pantalla — pero confirmarlo de punta a punta requiere el código de 6 dígitos real de `PRO_TEST_USER_EMAIL`, y no hay fixture de lectura de inbox en `tests/`. Pendiente de QA manual.

### 3.5 La invitada resuelve el conflicto con la contraseña correcta de la cuenta existente

**Tags:** `@registro-progresivo` `@edge-case` `@pendiente`

```gherkin
Escenario: La invitada resuelve el conflicto con la contraseña correcta de la cuenta existente
  Dado que la invitada ve el conflicto de email y conoce la contraseña de esa cuenta
  Cuando la ingresa y confirma
  Entonces sus datos de invitada (menú, perfil) se reasignan a la cuenta real
  Y su sesión anónima y perfil huérfano se eliminan
  Y la cuenta real conserva exactamente su plan original, sin duplicarse
  Y es redirigida a /menu como la cuenta real
  # Verificado de punta a punta con casos reales el 2026-07-31, cuando
  # todavía se llegaba a esta pantalla sin pasar por OTP (ver 3.4).
```

**Automatización:** `tests/steps/registro-progresivo-edge.steps.ts` — `test.skip()`'d, mismo bloqueo que 3.4 (depende de llegar a la pantalla de conflicto). El mecanismo de reasignación en sí (`handleReassign`, `reassign_guest_data()`) no se tocó en FRESCO-89 y sigue siendo el mismo verificado de punta a punta el 2026-07-31 — lo que cambió es solo cómo se llega a esta pantalla.

### 3.6 La invitada ingresa una contraseña incorrecta al intentar reasignar

**Tags:** `@registro-progresivo` `@edge-case` `@pendiente`

```gherkin
Escenario: La invitada ingresa una contraseña incorrecta al intentar reasignar
  Dado que la invitada ve el conflicto de email
  Cuando ingresa una contraseña incorrecta para esa cuenta
  Entonces ve un error claro
  Y no se mueve ni se modifica ningún dato
```

**Automatización:** `tests/steps/registro-progresivo-edge.steps.ts` — `test.skip()`'d, mismo bloqueo que 3.4/3.5.

### 3.7 La conversión de invitada a cuenta real no sobrevive a perder la sesión anónima original

**Tags:** `@registro-progresivo` `@edge-case` `@verificado-manual-2026-08-07`

```gherkin
Escenario: La conversión de invitada a cuenta real no sobrevive a perder la sesión anónima original
  Dado que una invitada generó un menú y "creó su cuenta" en /signup con un email nuevo
  Cuando limpia cookies/localStorage (simula cerrar el navegador o cambiar de dispositivo) e intenta loguearse con esas mismas credenciales
  Entonces el login debería funcionar siempre, porque "crear cuenta" implica que quedó guardada de verdad
  # FRESCO-89 (arreglado 2026-08-07): root cause era `client.auth.
  # updateUser({email, password})` en una sola llamada — con secure email
  # change activado, Supabase solo encola el cambio (doble opt-in) y nunca
  # lo aplica sin verificación. Fix: `app/signup/page.tsx` ahora separa
  # `updateUser({ email })` del `updateUser({ password })`, con una
  # pantalla intermedia de verificación por OTP (`handleVerifyOtp`) entre
  # ambos — el patrón que los docs oficiales de Supabase documentan para
  # "Convert an anonymous user to a permanent user". Ver 3.3 para el
  # detalle de lo verificado en vivo y lo pendiente de QA manual.
```

**Automatización:** Manual — ver 3.3 para lo verificado en vivo.

### 3.8 Cerrar sesión como invitada advierte antes de borrar el menú generado

**Tags:** `@invitado` `@edge-case` `@verificado-manual-2026-08-07`

```gherkin
Escenario: Cerrar sesión como invitada advierte antes de borrar el menú generado
  Dado que una invitada generó un menú y tiene sesión anónima activa
  Cuando toca "Cerrar sesión" en el sidebar
  Entonces se le advierte específicamente que va a perder el menú generado, distinto del logout normal de una cuenta real
  # FRESCO-90 (arreglado 2026-08-07): nuevo guest-logout-dialog.tsx,
  # gateado por user.is_anonymous. Verificado en vivo: invitada → diálogo
  # antes de salir; cuenta real → logout directo, sin cambio.
```

**Automatización:** Manual, no automatizado aún.

### 3.9 Una password débil se rechaza antes de gastar el roundtrip de OTP

**Tags:** `@registro-progresivo` `@edge-case` `@verificado-manual-2026-08-08`

```gherkin
Escenario: Una password débil se rechaza antes de gastar el roundtrip de OTP
  Dado que una invitada rellena /signup con un email nuevo y una password de menos de 6 caracteres
  Cuando confirma el formulario
  Entonces se rechaza de inmediato, sin llegar a la pantalla de OTP
  # FRESCO-123 (arreglado 2026-08-08): minLength=6 + chequeo JS con el
  # mismo mensaje de weak_password. Verificado en vivo.
```

**Automatización:** Manual, no automatizado aún.

### 3.10 El botón de confirmar código OTP solo se habilita con los 6 dígitos completos

**Tags:** `@registro-progresivo` `@edge-case` `@verificado-manual-2026-08-08`

```gherkin
Escenario: El botón de confirmar código OTP solo se habilita con los 6 dígitos completos
  Dado que la invitada está en la pantalla de OTP
  Cuando escribe menos de 6 dígitos
  Entonces el botón "Confirmar código" permanece deshabilitado
  # FRESCO-126 (arreglado 2026-08-08): gate cambiado de !otpCode a
  # otpCode.length === 6. Verificado en vivo.
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

### 6.7 El grid del calendario responde a scroll táctil horizontal en mobile

**Tags:** `@calendario` `@verificado-manual-2026-08-14` `@automatizado`

```gherkin
Escenario: El grid del calendario responde a scroll táctil horizontal en mobile
  Dado que el usuario tiene un menú semanal generado con los 21 huecos llenos, en un viewport mobile con touch
  Cuando desliza el dedo horizontalmente sobre el grid
  Entonces el grid se desplaza y muestra días más allá del lunes
  # FRESCO-170 -- BLOCKER encontrado DOS veces (QA sweep 2026-08-10,
  # re-confirmado 2026-08-11 tras un primer "fix" que solo tocó el label
  # sticky, no el scroll táctil en sí, que seguía completamente muerto).
  # Causa real: touch-action: none incondicional en el handle de arrastre +
  # un PointerSensor compartido sin distinguir mouse de touch.
```

**Automatización:** `tests/steps/calendario.steps.ts` — contexto mobile-emulado dedicado, dispatch de eventos touch reales vía CDP (mouse-wheel/dragTo no detectan este bug, hace falta touch real).

> **Nota de sincronización 2026-08-19:** este escenario y los 3 de la sección
> 8 (8.5-8.7) ya existían en `regression.feature` desde una sesión previa
> (2026-08-14) pero nunca se habían sincronizado a este fichero — drift
> encontrado y corregido durante el barrido QA sistemático de esta sesión.

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

**Tags:** `@aprendizaje` `@verificado-manual-2026-08-08`

```gherkin
Escenario: La generación pesa el historial real de un usuario Pro y produce una explicación (FR-5.4/5.5)
  Dado que un usuario Pro tiene al menos 2 semanas de historial cocinado/descartado real
  Cuando se genera su menú de la semana siguiente
  Entonces el algoritmo determinista evita repetir recetas marcadas cocinada o descartada, sin tocar las pendientes
  Y genera una explicación cálida en "explicacion_aprendizaje", separada de "advertencias", que menciona cocinadas y descartadas por separado
  Y queda persistida en su propio campo, no mezclada con las advertencias de seguridad
  # FRESCO-120 (arreglado 2026-08-08, ADR-0006): ver detalle completo en
  # regression.feature — root cause era que get_recent_recipe_ids()
  # excluía TODO lo reciente sin mirar estado (un Pro que nunca marcaba
  # nada recibía la misma exclusión que uno que marcaba todo) y
  # "destacadas" leía columnas globales compartidas entre todos los
  # usuarios, no historial personal. Nuevas get_recent_recipe_marks() +
  # get_user_cooked_recipe_ids() (ambas con el mismo check auth.uid() de
  # ownership que la función que reemplazan). Verificado en vivo contra
  # PRO_TEST_USER_EMAIL.
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

**Automatización:** `tests/steps/aprendizaje-pro.steps.ts` — usa `PRO_TEST_USER_EMAIL`, fuerza `plan='pro'` vía REST, siembra una semana anterior real con estado `cocinada` y dispara una llamada real (sin mock, determinista desde ADR-0005/ADR-0006 — sin Gemini) a `generate-meal-plan`, para poder asertar contra una tarjeta `card-insight` real y confirmar que su texto nunca aparece dentro del banner de advertencias. Re-verificado en vivo el 2026-08-08 tras FRESCO-120: sigue en verde.

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

### 8.5 Cada producto de la lista muestra su precio estimado

**Tags:** `@lista-compra` `@verificado-manual-2026-08-14` `@automatizado`

```gherkin
Escenario: Cada producto de la lista muestra su precio estimado
  Dado que el usuario tiene una lista de la compra generada
  Entonces cada producto muestra su cantidad, unidad y precio estimado
  Y el precio se conserva la próxima vez que abre la lista
  # FRESCO-191 (segunda vuelta): aisle-pricing.ts ya calculaba un precio real
  # por ingrediente para armar el total -- precio_estimado lo expone por
  # producto en vez de perderlo en la suma.
```

**Automatización:** `tests/steps/shopping-list.steps.ts` — mismo patrón que 8.1/8.2, backend real sin mock.

### 8.6 Compra realizada desmarca todos los productos marcados

**Tags:** `@lista-compra` `@verificado-manual-2026-08-14` `@automatizado`

```gherkin
Escenario: Compra realizada desmarca todos los productos marcados
  Dado que el usuario tiene una lista de la compra generada con un producto marcado como comprado
  Cuando pulsa "Compra realizada"
  Entonces todos los productos quedan desmarcados
  Y el botón "Compra realizada" desaparece
  # FRESCO-191 (QA rework): repurpose real del CTA "Completar compra" del
  # mockup -- sin acción de "completar lista" en el backend, así que se
  # convirtió en un desmarcado en bloque real vía toggleShoppingListItem.
  # FRESCO-215: copy renombrada de "Vaciar comprados" a "Compra realizada"
  # para comunicar la intención (fin de la compra) en vez de la mecánica.
```

**Automatización:** `tests/steps/shopping-list.steps.ts` — backend real sin mock.

### 8.7 Sugerencias basadas en favoritos permiten añadir un producto a la lista

**Tags:** `@lista-compra` `@verificado-manual-2026-08-14` `@automatizado`

```gherkin
Escenario: Sugerencias basadas en favoritos permiten añadir un producto a la lista
  Dado que el usuario tiene una lista de la compra generada y una receta favorita con un ingrediente que no está en la lista
  Cuando pulsa "Añadir" en esa sugerencia
  Entonces el producto aparece en la lista, en su pasillo correspondiente
  Y la sugerencia desaparece del carrusel
  Y el producto se conserva la próxima vez que abre la lista
  # FRESCO-194: única fuente de datos real disponible para "sugerencias"
  # (favoritos -> ingredientes no presentes en la lista actual). "Nuevo"
  # queda fuera -- sin tracking de recencia en shopping_lists.
```

**Automatización:** `tests/steps/shopping-list.steps.ts` — backend real sin mock.

> **Nota de sincronización 2026-08-19:** 8.5-8.7 (y 6.7) ya existían en
> `regression.feature` desde una sesión previa (2026-08-14) pero nunca se
> habían sincronizado a este fichero — drift encontrado y corregido durante
> el barrido QA sistemático de esta sesión.

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

### 9.2 La página /qa no se autocontradice sobre la arquitectura de generación

**Tags:** `@qa` `@edge-case` `@verificado-manual-2026-08-08`

```gherkin
Escenario: La página /qa no se autocontradice sobre la arquitectura de generación
  Dado que un evaluador externo abre /qa
  Cuando lee la cabecera y la sección "Arquitectura"
  Entonces ambas describen el mismo mecanismo, sin mencionar "IA" en una y "100% determinista, sin IA" en la otra
  # FRESCO-127 (arreglado 2026-08-08): la cabecera decía "generación
  # asistida por IA", la sección Arquitectura dos párrafos después decía
  # "100% deterministas — sin llamadas a modelos de IA en producción".
  # Se corrigió la cabecera para que coincida.
```

**Automatización:** Manual, no automatizado aún.

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
  # FRESCO-122 (arreglado 2026-08-08): 228/1000 recetas (22.8%) tenían
  # meta.dificultad = "alta" en el dato real, valor que nunca fue parte
  # del enum DificultadReceta — invisible a TS porque meta es jsonb.
  # Renderizaba "30 min ·  · muy bajo" (dificultad en blanco). Fix: pura
  # migración de datos ("alta"→"avanzada"), cero cambio de código.
  # Verificado en vivo: "30 min · avanzada · muy bajo".
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

### 11.23 Receta propia con 1 solo ingrediente usa singular "1 ingrediente"

**Tags:** `@biblioteca` `@edge-case` `@verificado-manual-2026-08-08`

```gherkin
Escenario: Receta propia con 1 solo ingrediente usa singular "1 ingrediente"
  Dado que Laura tiene una receta propia con exactamente 1 ingrediente
  Cuando ve su tarjeta en Recetas
  Entonces lee "1 ingrediente", no "1 ingredientes"
  # FRESCO-125 (arreglado 2026-08-08): pluralización naive en
  # personal-recipe-card.tsx, siempre añadía "s". Verificado en vivo.
```

**Automatización:** Manual, no automatizado aún.

### 11.24 Receta propia con nombre vacío — investigado, constraint server-side ya existía

**Tags:** `@biblioteca` `@edge-case` `@verificado-manual-2026-08-08`

```gherkin
Escenario: Receta propia con nombre vacío — investigado, constraint server-side ya existía
  Dado que se intenta insertar una receta propia con nombre vacío o solo espacios
  Cuando la escritura llega a Postgres
  Entonces se rechaza por un CHECK constraint
  # FRESCO-124: el QA sweep del 2026-08-08 encontró una fila real con
  # nombre vacío en producción — investigado, el CHECK
  # (char_length(trim(nombre)) > 0) YA EXISTÍA desde la creación de la
  # tabla (20260803000000_create_recetas_propias_table.sql). Verificado
  # en vivo que rechaza un INSERT directo con nombre en blanco. La fila
  # reportada era debris transitorio de un test concurrente (varios
  # agentes de QA en paralelo contra la misma DB), no un gap real —
  # eliminada como limpieza. Ticket cerrado como no-reproducible. Nota
  # aparte: el límite de 100 caracteres (FRESCO-107) sí sigue siendo solo
  # client-side, sin backstop en DB.
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

### 12.7 El FAQ de Ayuda describe correctamente cómo se genera el menú, sin mencionar Gemini

**Tags:** `@perfil` `@edge-case` `@verificado-manual-2026-08-08`

```gherkin
Escenario: El FAQ de Ayuda describe correctamente cómo se genera el menú, sin mencionar Gemini
  Dado que Laura abre /profile → Ayuda → FAQ
  Cuando lee "¿Cómo genera Fresco mi menú semanal?"
  Entonces el texto describe un proceso 100% determinista, sin ninguna mención a Gemini ni IA
  # FRESCO-121 (arreglado 2026-08-08): el FAQ decía "Gemini solo entra en
  # juego en Plan Pro, para redactar la explicación" — falso desde el
  # 2026-08-01 (ADR-0005 + commit ae3b560), confirmado independientemente
  # por los 3 agentes del QA sweep del 2026-08-08. Reescrito.
```

**Automatización:** Manual, no automatizado aún.

---

## 13. App Shell — metadatos globales

### 13.1 El title tag global no reclama un mecanismo de "IA" que ya no existe

**Tags:** `@app-shell` `@edge-case` `@verificado-manual-2026-08-08`

```gherkin
Escenario: El title tag global no reclama un mecanismo de "IA" que ya no existe
  Dado que cualquier página de la app carga
  Cuando se inspecciona el <title> del documento
  Entonces no menciona "IA" como el mecanismo del producto
  # FRESCO-128 (arreglado 2026-08-08): "Fresco — Menús semanales con IA
  # que aprende de lo que realmente cocinas" → "Fresco — Menús semanales
  # que aprenden de lo que realmente cocinas". Mismo tema que
  # FRESCO-121/127.
```

**Automatización:** Manual, no automatizado aún.

---

---

## 14. Suscripción Pro / Stripe — EPIC-FRESCO-227 / STORY-FRESCO-228/230/231/232

**STORY-FRESCO-228 — actualizar a Pro desde el perfil**

### 14.1 Iniciar checkout desde el perfil

**Tags:** `@suscripcion` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Iniciar checkout desde el perfil
  Dado que Laura está en su perfil con plan Free
  Cuando toca el botón de actualizar a Pro
  Entonces es llevada a completar el pago de la suscripción Pro en Stripe Checkout real
  # FRESCO-228. Verificado en producción real (fresco-pro.vercel.app),
  # no simulado. Confirmado junto con el resto de la épica el
  # 2026-08-19 tras encontrar y arreglar 2 bugs de infra que dejaban el
  # webhook fallando en silencio desde que se shippeó.
```

**Automatización:** Manual, no automatizado aún.

### 14.2 Trial sin tarjeta

**Tags:** `@suscripcion` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Trial sin tarjeta
  Dado que Laura empieza el proceso de actualizar a Pro
  Cuando llega a la pantalla de pago de Stripe Checkout
  Entonces se le ofrece un periodo de prueba de 7 días sin necesidad de tarjeta
  # FRESCO-228. Verificado en producción real: Checkout Session con
  # trial_period_days: 7 y payment_method_collection: 'if_required'.
```

**Automatización:** Manual, no automatizado aún.

### 14.3 Pago completado activa Pro

**Tags:** `@suscripcion` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Pago completado activa Pro
  Dado que Laura completó el pago de la suscripción Pro
  Cuando vuelve a la app
  Entonces su perfil muestra el plan Pro activo
  # FRESCO-228. Verificado en producción real vía checkout.session.completed.
```

**Automatización:** Manual, no automatizado aún.

**STORY-FRESCO-230 — reflejar el estado real de la suscripción**

### 14.4 Pago exitoso activa Pro automáticamente

**Tags:** `@suscripcion` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Pago exitoso activa Pro automáticamente
  Dado que Laura completó el pago de su suscripción
  Cuando el pago se confirma
  Entonces su cuenta pasa a plan Pro sin que tenga que hacer nada más
  # FRESCO-230. Mismo evento (checkout.session.completed) que el
  # escenario "Pago completado activa Pro" de FRESCO-228 -- ya cubierto
  # por ese handler, sin código nuevo. Verificado en el mismo pase en
  # vivo del 2026-08-19.
```

**Automatización:** Manual, no automatizado aún.

### 14.5 Renovación mensual mantiene Pro

**Tags:** `@suscripcion` `@edge-case` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Renovación mensual mantiene Pro
  Dado que Laura tiene una suscripción Pro activa
  Cuando se renueva el cobro mensual
  Entonces sigue teniendo plan Pro sin interrupción
  # FRESCO-230. Confirmado indirecto: no se pudo forzar un ciclo de
  # renovación real vía Stripe MCP (sin operación expuesta para
  # invoice pay/retry), pero el mismo code path (customer.subscription.updated
  # con status=active) se ejercitó de verdad al probar la cancelación
  # de FRESCO-231 y al recuperar la suscripción tras el pago fallido de
  # FRESCO-232. Cubierto también por tests unitarios del webhook.
```

**Automatización:** Manual, no automatizado aún.

### 14.6 Cancelación revierte a Free al fin del periodo pagado

**Tags:** `@suscripcion` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Cancelación revierte a Free al fin del periodo pagado
  Dado que Laura canceló su suscripción Pro
  Cuando termina el periodo que ya pagó (customer.subscription.deleted)
  Entonces su cuenta pasa a plan Free
  # FRESCO-230. Verificado con evento real de Stripe en producción.
```

**Automatización:** Manual, no automatizado aún.

**STORY-FRESCO-231 — gestionar o cancelar la suscripción**

### 14.7 Acceder a gestión de suscripción

**Tags:** `@suscripcion` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Acceder a gestión de suscripción
  Dado que Laura tiene una suscripción Pro activa
  Cuando entra a su perfil y pulsa "Gestionar suscripción"
  Entonces puede abrir la gestión de su suscripción en el Billing Portal real de Stripe
  # FRESCO-231. Verificado en producción real, portal hospedado por
  # Stripe (ADR-0007: superficie hospedada de Stripe en vez de UI
  # custom).
```

**Automatización:** Manual, no automatizado aún.

### 14.8 Cancelar la suscripción

**Tags:** `@suscripcion` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Cancelar la suscripción
  Dado que Laura está en la gestión de su suscripción (Billing Portal)
  Cuando elige cancelarla
  Entonces ve confirmado que seguirá teniendo Pro hasta el fin del periodo ya pagado
  # FRESCO-231. Verificado en producción real: configuración de
  # cancelación del portal en modo at_period_end.
```

**Automatización:** Manual, no automatizado aún.

### 14.9 Ver mi próximo cobro

**Tags:** `@suscripcion` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Ver mi próximo cobro
  Dado que Laura tiene una suscripción Pro activa
  Cuando abre la gestión de su suscripción
  Entonces ve la fecha y el monto de su próximo cobro
  # FRESCO-231. Verificado en producción real, UI nativa del Billing
  # Portal (invoice_history habilitado en la configuración del portal).
```

**Automatización:** Manual, no automatizado aún.

**STORY-FRESCO-232 — saber si mi pago falló**

### 14.10 Pago fallido me avisa

**Tags:** `@suscripcion` `@edge-case` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Pago fallido me avisa
  Dado que la suscripción Pro de Laura intenta renovarse
  Cuando el cobro falla (customer.subscription.updated con status past_due)
  Entonces ve un aviso en su perfil explicando que el pago falló
  # FRESCO-232. Verificado con tarjeta de prueba real de Stripe
  # 4000000000000341 (se adjunta con éxito, decline en cada intento de
  # cobro) vía el iframe real del Billing Portal, forzando
  # trial_end=now para disparar el intento de cobro inmediato. Cierra
  # el hueco que había quedado de la sesión de QA de la épica (antes
  # solo sembrado en DB, no con tarjeta real).
```

**Automatización:** Manual, no automatizado aún.

### 14.11 Reintento exitoso restaura Pro sin fricción

**Tags:** `@suscripcion` `@edge-case` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Reintento exitoso restaura Pro sin fricción
  Dado que Laura tuvo un pago fallido (payment_failed_at con valor)
  Cuando actualiza su método de pago y el reintento funciona (status vuelve a active)
  Entonces su cuenta sigue en plan Pro sin interrupción visible
  Y el aviso de pago fallido desaparece de su perfil
  # FRESCO-232. Verificado en producción real: tarjeta reemplazada por
  # una válida (4242424242424242) y la factura fallida se marcó
  # incobrable vía PostInvoicesInvoiceMarkUncollectible, lo que forzó
  # la transición real a active y disparó la rama "recuperado" del
  # webhook.
```

**Automatización:** Manual, no automatizado aún.

### 14.12 Pago sigue fallando revierte a Free

**Tags:** `@suscripcion` `@edge-case` `@pendiente`

```gherkin
Escenario: Pago sigue fallando revierte a Free
  Dado que el pago de Laura falló y no se resolvió
  Cuando Stripe agota los reintentos y emite customer.subscription.updated con status unpaid
  Entonces su cuenta pasa a plan Free
  # FRESCO-232. Implementado en el webhook (rama `unpaid` -> downgrade
  # directo a free, sin esperar customer.subscription.deleted que puede
  # no llegar a disparar nunca en ese caso), pero NO verificado en vivo
  # -- la sesión de QA del 2026-08-19 solo llegó hasta past_due y su
  # recuperación (escenarios 14.10/14.11), sin agotar los reintentos
  # hasta unpaid. Cubierto por tests unitarios del webhook únicamente.
```

**Automatización:** Manual, no automatizado aún — y sin verificar en vivo (ver comentario arriba).

---

## 15. Favoritos (/favorites)

### 15.1 Ver la lista de recetas favoritas guardadas

**Tags:** `@favoritos` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Ver la lista de recetas favoritas guardadas
  Dado que Laura tiene al menos una receta marcada como favorita
  Cuando abre /favorites
  Entonces ve una tarjeta por cada receta favorita, con imagen, nombre, categoría y tiempo/coste
```

**Automatización:** Manual, no automatizado aún.

### 15.2 La lista de favoritos vacía muestra un estado vacío claro

**Tags:** `@favoritos` `@edge-case` `@verificado-manual-2026-08-19`

```gherkin
Escenario: La lista de favoritos vacía muestra un estado vacío claro
  Dado que Laura no tiene ninguna receta marcada como favorita
  Cuando abre /favorites
  Entonces ve un estado vacío ("Lista vacía... Guarda recetas para verlas aquí"), no una lista en blanco ni un error
```

**Automatización:** Manual, no automatizado aún.

### 15.3 Quitar una receta de favoritos desde la propia pantalla de Favoritos

**Tags:** `@favoritos` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Quitar una receta de favoritos desde la propia pantalla de Favoritos
  Dado que Laura está en /favorites con al menos una receta guardada
  Cuando pulsa "Quitar de favoritos" en una de las tarjetas
  Entonces la tarjeta desaparece inmediatamente de la lista
  Y el cambio persiste tras recargar la página
```

**Automatización:** Manual, no automatizado aún.

### 15.4 Marcar/desmarcar favorito se refleja en cualquier pantalla donde aparezca la misma receta

**Tags:** `@favoritos` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Marcar/desmarcar favorito se refleja en cualquier pantalla donde aparezca la misma receta
  Dado que Laura marca una receta como favorita desde /menu o /notifications
  Cuando visita /favorites, o el detalle de esa misma receta, o vuelve a la pantalla de origen
  Entonces el estado de favorito (marcado o no) es el mismo en todas ellas
  # Verificado en vivo cruzando /menu -> /favorites -> detalle de receta ->
  # /notifications: el toggle optimista se refleja de inmediato y persiste
  # tras recargar en las 4 pantallas.
```

**Automatización:** Manual, no automatizado aún.

### 15.5 Abrir el detalle de una receta desde Favoritos

**Tags:** `@favoritos` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Abrir el detalle de una receta desde Favoritos
  Dado que Laura está en /favorites
  Cuando toca una tarjeta de receta favorita
  Entonces ve el detalle completo de esa receta, con el botón de favorito ya marcado
```

**Automatización:** Manual, no automatizado aún.

### 15.6 El enlace "Volver a la Biblioteca" del detalle de receta no vuelve a Favoritos aunque se haya llegado desde ahí

**Tags:** `@favoritos` `@edge-case` `@verificado-manual-2026-08-19`

```gherkin
Escenario: El enlace "Volver a la Biblioteca" del detalle de receta no vuelve a Favoritos aunque se haya llegado desde ahí
  Dado que Laura abre el detalle de una receta navegando desde /favorites
  Cuando pulsa "Volver a la Biblioteca"
  Entonces vuelve a /recipes (la Biblioteca), no a /favorites
  # Causística real, no necesariamente un bug -- la pantalla de detalle es
  # la misma para Biblioteca y Favoritos, y el enlace de vuelta siempre
  # apunta a /recipes independientemente de la pantalla de origen.
```

**Automatización:** Manual, no automatizado aún.

---

## 16. Centro de Avisos (/notifications)

### 16.1 El "Centro de Avisos" no contiene avisos reales, solo recomendaciones de recetas

**Tags:** `@notificaciones` `@edge-case` `@verificado-manual-2026-08-19`

```gherkin
Escenario: El "Centro de Avisos" no contiene avisos reales, solo recomendaciones de recetas
  Dado que Laura abre /notifications
  Entonces ve una sección "Recetas que te pueden gustar" con tarjetas de receta
  Y no ve ningún aviso de sistema, recordatorio, ni notificación real (pago, semana sin menú, etc.)
  # Causística real encontrada en el barrido QA 2026-08-19, sin ticket
  # todavía: la pantalla se titula "Centro de Avisos" / "Tus notificaciones"
  # pero el único contenido real es un carrusel de recomendaciones de
  # recetas -- el mismo tipo de tarjeta que "Últimas recetas añadidas" de
  # Inicio. No hay ningún aviso real (pago fallido, menú sin generar, etc.)
  # enrutado aquí pese a que ya existen esos eventos en el sistema (ver 14.10,
  # aviso de pago fallido en /profile). Gap de producto, no bug de código.
```

**Automatización:** Manual, no automatizado aún.

### 16.2 El icono de Notificaciones no muestra ningún contador de no leídos

**Tags:** `@notificaciones` `@edge-case` `@verificado-manual-2026-08-19`

```gherkin
Escenario: El icono de Notificaciones no muestra ningún contador de no leídos
  Dado que Laura está en /menu
  Cuando mira el icono de Notificaciones en la cabecera
  Entonces no ve ningún badge ni contador, incluso si hay recomendaciones nuevas sin ver
  # Consistente con 16.1 -- no existe concepto de "leído/no leído" todavía.
```

**Automatización:** Manual, no automatizado aún.

### 16.3 Se puede marcar como favorita una receta recomendada directamente desde Notificaciones

**Tags:** `@notificaciones` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Se puede marcar como favorita una receta recomendada directamente desde Notificaciones
  Dado que Laura ve una receta recomendada en /notifications
  Cuando pulsa "Guardar en favoritos" en esa tarjeta
  Entonces la receta se añade a sus favoritos, visible en /favorites
  # Mismo componente de tarjeta de receta reutilizado que en
  # Inicio/Biblioteca -- el toggle de favorito funciona igual aquí.
```

**Automatización:** Manual, no automatizado aún.

### 16.4 Las recomendaciones de Notificaciones no excluyen recetas ya marcadas como favoritas

**Tags:** `@notificaciones` `@edge-case` `@pendiente`

```gherkin
Escenario: Las recomendaciones de Notificaciones no excluyen recetas ya marcadas como favoritas
  Dado que Laura ya tiene una receta marcada como favorita
  Cuando abre /notifications
  Entonces esa misma receta puede seguir apareciendo en "Recetas que te pueden gustar"
  # Observado en vivo: tras marcar "Arroz con verduras..." como favorita,
  # siguió apareciendo en la misma lista de recomendaciones al recargar.
  # @pendiente porque no se confirmó si es el comportamiento pretendido
  # (recomendaciones fijas/deterministas) o un gap real -- requiere decisión
  # de producto, no solo verificación técnica.
```

**Automatización:** Manual, no automatizado aún — `@pendiente`, requiere decisión de producto.

---

## 17. Landing pública (/)

### 17.1 La landing pública muestra el value proposition, precios y FAQ sin necesidad de sesión

**Tags:** `@landing` `@verificado-manual-2026-08-19`

```gherkin
Escenario: La landing pública muestra el value proposition, precios y FAQ sin necesidad de sesión
  Dado que un visitante sin cuenta ni sesión visita /
  Entonces ve la propuesta de valor, cómo funciona en 3 pasos, precios (Free y Pro) y FAQ
  Y ambos CTA principales ("Generar mi primer menú", "Empezar gratis") llevan a /onboarding
```

**Automatización:** Manual, no automatizado aún.

### 17.2 El acordeón de FAQ de la landing expande y colapsa cada pregunta de forma independiente

**Tags:** `@landing` `@verificado-manual-2026-08-19`

```gherkin
Escenario: El acordeón de FAQ de la landing expande y colapsa cada pregunta de forma independiente
  Dado que un visitante está en la sección FAQ de /
  Cuando toca una pregunta
  Entonces se expande mostrando su respuesta, sin afectar al resto de preguntas
```

**Automatización:** Manual, no automatizado aún.

### 17.3 Un usuario con sesión activa que visita / sigue viendo la landing pública, no su panel

**Tags:** `@landing` `@edge-case` `@verificado-manual-2026-08-19`

```gherkin
Escenario: Un usuario con sesión activa que visita / sigue viendo la landing pública, no su panel
  Dado que Laura tiene sesión iniciada y un menú ya generado
  Cuando visita / directamente
  Entonces sigue viendo la landing de marketing (con "Ya tengo cuenta"/"Empezar gratis"), no es redirigida a /menu
  # Causística real, no necesariamente un bug -- puede ser intencional (la
  # landing sirve también de página de marketing pública para SEO/compartir).
  # Los CTA de esa pantalla siguen apuntando a /onboarding incluso con sesión
  # activa -- si Laura los pulsa con un menú ya generado, cae en el 409 ya
  # cubierto por el escenario 2.5.
```

**Automatización:** Manual, no automatizado aún.

### 17.4 El copyright del footer muestra un año desactualizado

**Tags:** `@landing` `@edge-case` `@verificado-manual-2026-08-19`

```gherkin
Escenario: El copyright del footer muestra un año desactualizado
  Dado que cualquier visitante llega al final de /
  Cuando lee el texto del footer
  Entonces ve "© 2025 Fresco..." aunque el año real ya avanzó a 2026
  # Bug cosmético real, menor severidad, sin ticket todavía -- el footer usa
  # un año hardcodeado en vez de calcularlo dinámicamente.
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
- Variables de entorno añadidas a Vercel vía CLI/dashboard DESPUÉS de un build no se aplican a deploys ya corriendo — hace falta un redeploy explícito. Encontrado en 2026-08-19: `STRIPE_WEBHOOK_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` se añadieron a prod y staging pero el webhook de Stripe siguió fallando hasta redesplegar ambos entornos.
- El rol `service_role` de Postgres NO tiene privilegios de tabla por defecto — necesita su propio GRANT (además de cualquier policy RLS), igual que `authenticated`/`anon`. Encontrado en 2026-08-19: `service_role` nunca tuvo GRANT SELECT/UPDATE sobre `user_profiles`, así que el webhook de Stripe devolvía 200 a Stripe pero el UPDATE a Supabase fallaba en silencio — la épica EPIC-FRESCO-227 entera nunca funcionó de punta a punta en producción hasta arreglar esto (migración `20260819124500_grant_service_role_user_profiles_privileges.sql`).
- `stripe_api_search` (Stripe MCP) no encuentra operaciones poco comunes (attach de payment method, pay/retry de invoice, mark uncollectible) — hay que adivinar el operation id y llamar `stripe_api_details`/`stripe_api_write` directo. El formulario de tarjeta hospedado por Stripe (Checkout y Billing Portal) es un iframe anidado, accesible con refs normales de playwright-cli sin tratamiento especial.

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
