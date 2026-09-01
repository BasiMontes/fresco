# language: es
#
# Registro único de todos los escenarios de prueba de Fresco — manuales hoy,
# candidatos a automatizar con Playwright (playwright-bdd/cucumber-js) mañana.
# Complementa, no duplica, las AC de cada tarjeta de Jira (esas viven en
# .context/PBI/epics/.../stories/STORY-*/comments.md, una por historia). Este
# fichero cruza historias: el recorrido completo del usuario real.
#
# Convención de tags:
#   @verificado-manual-YYYY-MM-DD  → probado en vivo (Playwright CLI) esa fecha, pasó
#   @pendiente                     → escrito, todavía no verificado ni automatizado
#   @edge-case                     → causística además del camino feliz
#   @smoke                         → subconjunto mínimo de happy paths ya
#                                    @automatizado que corre tras cada deploy de
#                                    producción, contra la URL del propio deploy
#                                    (.github/workflows/post-deploy-smoke.yml).
#                                    Solo escenarios rápidos, self-contained y
#                                    de baja flakiness: check de VIDA del deploy,
#                                    no de rendimiento ni de flujos con IA. Hoy:
#                                    @login, @qa, @suscripcion. FRESCO-322,
#                                    FRESCO-329 (se sacó @aprendizaje: la cadena
#                                    reseed + marca + render tardaba >20s contra
#                                    infra recién publicada, falló 2/2 en prod).
#
# Al automatizar un escenario, añadir @automatizado y el fichero de test que lo cubre.
#
# @mode:parallel (playwright-bdd, FRESCO-356 / ADR-0018): los escenarios
# @automatizado corren en paralelo. Todos los step files usan testUserFactory
# (FRESCO-308) — cada escenario provisiona su propio usuario throwaway y
# siembra SUS datos, así que no hay estado compartido entre escenarios. Al
# añadir un escenario nuevo, seguir ese patrón; nunca reutilizar una cuenta
# fija compartida (DEV_USER/PRO_USER) para un escenario que escribe.

@mode:parallel
Característica: Flujo completo de usuario en Fresco
  Como equipo de producto, queremos un registro único de todos los escenarios
  de prueba y sus posibles causísticas, para tener trazabilidad end-to-end del
  producto más allá de las AC sueltas de cada tarjeta.

  # ==========================================================================
  # Autenticación
  # ==========================================================================

  @login @verificado-manual-2026-07-29 @automatizado @smoke
  # Automatizado: tests/steps/login.steps.ts (playwright-bdd)
  # @smoke: canario post-deploy — auth + conectividad con Supabase.
  Escenario: Inicio de sesión correcto con credenciales válidas
    Dado que existe un usuario registrado con email y contraseña válidos
    Cuando introduce esas credenciales en /login y confirma el formulario
    Entonces el sistema le redirige a /menu
    Y la sesión queda activa

  @login @edge-case @verificado-manual-2026-07-31
  Escenario: Inicio de sesión falla con credenciales incorrectas
    Dado que un usuario introduce un email o contraseña incorrectos
    Cuando confirma el formulario de /login
    Entonces ve un mensaje de error claro
    Y permanece en /login sin sesión activa
    # Bug real encontrado en barrido QA 2026-08-06 (FRESCO-106): el mensaje
    # se mostraba literal en inglés (`error.message` de Supabase sin
    # traducir — "Invalid login credentials"), en una app 100% en español.
    # Mismo patrón replicado en /signup. Corregido: lib/auth-errors.ts
    # traduce por error.code (no por .message), con fallback genérico en
    # español para cualquier error no mapeado (red, CORS, rate-limit).
    # Re-verificado en vivo tras el fix: mensaje "Email o contraseña
    # incorrectos." en español.

  @login @edge-case @verificado-manual-2026-08-07
  Escenario: Doble-click rápido en "Iniciar sesión" no dispara dos intentos de autenticación
    Dado que un usuario completa email y contraseña válidos en /login
    Cuando hace dos clicks sincrónicos sobre "Iniciar sesión" sin esperar entre ambos
    Entonces solo se dispara una llamada de autenticación
    # FRESCO-114 (arreglado 2026-08-07): guard síncrono (useRef) agregado en
    # los 4 formularios con el mismo patrón (login, signup, forgot-password,
    # update-password) — `disabled={isSubmitting}` solo actúa tras
    # re-render, no alcanza a bloquear el mismo tick. Verificado en vivo: 3
    # clicks sincrónicos ahora producen 1 solo POST.

  @registro @verificado-manual-2026-07-29 @automatizado
  # Automatizado: tests/steps/signup.steps.ts (playwright-bdd, mock de red — ver comentario en el step file)
  Escenario: Alta de nuevo usuario desde /signup
    Dado que un visitante sin cuenta rellena email y contraseña en /signup
    Cuando confirma el formulario
    Entonces se crea la cuenta en Supabase Auth
    Y el sistema le redirige a /onboarding

  @registro @edge-case @automatizado
  # Automatizado: tests/steps/signup.steps.ts (route-mock de api.pwnedpasswords.com
  # + guard que falla si se llega a signUp). FRESCO-32.
  Escenario: El alta rechaza una contraseña que aparece en filtraciones conocidas
    Dado que un visitante introduce una contraseña filtrada conocida en /signup
    Cuando confirma el formulario
    Entonces ve un aviso de que esa contraseña apareció en filtraciones y la cuenta no se crea
    # Supabase capa esta protección al plan Pro; la org está en Free, así que
    # se hace client-side contra la API pública de Pwned Passwords (k-anonymity,
    # solo salen 5 chars del hash SHA-1). Fail-open: si HIBP no responde, no
    # bloquea el alta.

  @registro @edge-case @verificado-manual-2026-07-31
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

  @login @recuperar-password @verificado-manual-2026-08-19 @automatizado
  # Automatizado: tests/steps/recuperar-password.steps.ts (FRESCO-352)
  Escenario: Solicitar el enlace de recuperación de contraseña
    Dado que un usuario visita /forgot-password
    Cuando introduce su email registrado y confirma el formulario
    Entonces ve un mensaje genérico confirmando que si la cuenta existe, recibirá un enlace

  @login @recuperar-password @edge-case @verificado-manual-2026-08-19
  Escenario: El mensaje de recuperación de contraseña no revela si el email existe (anti-enumeración)
    Dado que un visitante introduce un email que no está registrado en /forgot-password
    Cuando confirma el formulario
    Entonces ve exactamente el mismo mensaje genérico que con un email real
    # Mismo patrón anti-enumeración que signUp() (ver escenario "Alta falla
    # porque el email ya está registrado"), aplicado también aquí por diseño
    # de Supabase Auth. Verificado en vivo comparando ambos mensajes carácter
    # a carácter.

  @login @recuperar-password @edge-case @verificado-manual-2026-08-19
  Escenario: El campo de email en /forgot-password exige un formato válido antes de enviar
    Dado que un usuario deja vacío el campo de email en /forgot-password
    Cuando intenta confirmar el formulario
    Entonces el navegador bloquea el envío con la validación nativa del campo (required + type=email), sin llamar al backend

  @login @recuperar-password @edge-case @verificado-manual-2026-08-19
  Escenario: Confirmar la nueva contraseña detecta que no coincide con la anterior
    Dado que un usuario está en /update-password
    Cuando escribe una contraseña y una confirmación distintas y confirma
    Entonces ve el mensaje "Las contraseñas no coinciden."

  @login @recuperar-password @edge-case @verificado-manual-2026-08-19
  Escenario: Un mensaje de error obsoleto puede confundir sobre el problema real de la contraseña
    Dado que un usuario en /update-password ya vio "Las contraseñas no coinciden." por un intento anterior
    Cuando corrige la confirmación para que ambas coincidan, pero deja una contraseña de menos de 10 caracteres, y reenvía
    Entonces el envío se bloquea por la validación nativa de longitud mínima (minLength=10)
    Y el mensaje "Las contraseñas no coinciden." sigue visible en pantalla, describiendo un problema que ya no es real
    # Bug real encontrado en vivo (barrido QA 2026-08-19), sin ticket todavía:
    # el segundo intento nunca llega al handler de JS que limpia/actualiza el
    # mensaje de error, porque el atributo minLength=10 del input bloquea el
    # submit de forma silenciosa (sin popup visible en este navegador/CLI)
    # antes de que se revalide el mismatch. El usuario se queda viendo un
    # error que ya no describe la causa real del bloqueo (contraseña corta,
    # no contraseñas distintas). Severidad: menor (edge-case de doble error,
    # no bloquea el flujo feliz — el usuario puede seguir corrigiendo).

  @login @recuperar-password @pendiente
  Escenario: Completar la recuperación de contraseña de punta a punta con el enlace real del correo
    Dado que un usuario solicitó recuperar su contraseña y recibió el email real
    Cuando sigue el enlace, cae en /update-password con una sesión de recuperación válida, y confirma una contraseña nueva válida
    Entonces su contraseña queda actualizada y puede volver a loguearse con la nueva
    # No ejecutado de punta a punta -- requiere leer un inbox real (mismo
    # bloqueo que los escenarios de OTP de registro progresivo, sin fixture
    # de inbox en tests/) y es una acción irreversible sobre la cuenta QA
    # compartida (cambiaría su contraseña real). Verificado en cambio: el
    # formulario de /update-password renderiza y valida coincidencia +
    # longitud mínima correctamente sin llegar a enviar nada al backend.

  # ==========================================================================
  # Onboarding y generación de menú (EPIC-FRESCO-4 / EPIC-FRESCO-6)
  # ==========================================================================

  @onboarding @generacion-menu @verificado-manual-2026-07-29 @automatizado
  # Automatizado: tests/steps/onboarding.steps.ts (FRESCO-352). Reutiliza el
  # step "pulsa \"Generar mi menú\"" de generacion-determinista.steps.ts.
  Escenario: Un usuario logueado completa el onboarding y genera su menú semanal
    Dado que el usuario tiene sesión iniciada
    Y no tiene todavía un menú generado para la semana actual
    Cuando completa los 3 pasos del onboarding (dieta/alérgenos, cocinas favoritas, hogar)
    Y pulsa "Generar mi menú"
    Entonces la IA genera un menú de 21 huecos (7 días x desayuno/comida/cena)
    Y el menú queda persistido en base de datos
    Y es redirigido a /menu, donde ve el menú completo

  @generacion-menu @edge-case @verificado-manual-2026-07-29
  Escenario: El catálogo filtrado no tiene recetas específicas para todos los huecos
    Dado que las restricciones del usuario dejan un catálogo con recetas insuficientes para desayuno o cena
    Cuando se genera el menú
    Entonces la IA rellena esos huecos con recetas de tipo "comida" como sustituto
    Y el sistema muestra un aviso explícito ("Antes de continuar…") explicando qué se sustituyó y por qué

  @generacion-menu @edge-case @verificado-manual-2026-08-01
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

  @generacion-menu @verificado-manual-2026-08-01 @automatizado
  # Automatizado: tests/steps/generacion-determinista.steps.ts
  # NO es @smoke (FRESCO-322): el umbral <10s es un guard de REGRESIÓN DE
  # RENDIMIENTO de ADR-0005, no un check de vida. Contra la infra fría de un
  # deploy recién publicado (serverless de Vercel + Edge Function en frío) el
  # cold-start lo revienta sin que nada esté roto. Corre en test:e2e (build
  # prod local, caliente), que es donde el guard de perf tiene sentido.
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

  @generacion-menu @edge-case @verificado-manual-2026-07-31
  Escenario: Ya existe un plan para la semana solicitada
    Dado que el usuario ya generó un menú para la semana actual
    Cuando intenta generar de nuevo sin eliminar el plan existente
    Entonces el sistema responde 409 y no crea un plan duplicado

  @onboarding @edge-case @verificado-manual-2026-08-06
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

  @onboarding @edge-case @verificado-manual-2026-08-07
  Escenario: Recargar la página a mitad del onboarding no borra el progreso ya completado
    Dado que el usuario completó el paso 1 o 2 del onboarding
    Cuando recarga la página antes de llegar al paso 3
    Entonces sus respuestas ya dadas siguen ahí, no vuelve al paso 1 en blanco
    # FRESCO-94 (arreglado 2026-08-07): lib/store/onboarding-store.ts ahora
    # persiste a sessionStorage vía zustand persist; verificado en vivo con
    # Playwright — tras F5 los chips de dieta/alérgenos siguen `pressed`.
    # El store se resetea al generar el menú con éxito para no filtrar
    # respuestas viejas a una futura visita en la misma pestaña.

  @onboarding @edge-case @verificado-manual-2026-08-07
  Escenario: El campo "Adultos" del hogar respeta un tope superior razonable
    Dado que el usuario está en el paso 3 del onboarding (hogar)
    Cuando escribe un valor muy grande (ej. 999) en "Adultos"
    Entonces el sistema lo rechaza o lo acota a un máximo razonable antes de permitir generar el menú
    # FRESCO-110 (arreglado 2026-08-07): validateHousehold() ahora valida
    # contra HOUSEHOLD_FIELD_MAX=10 (adultos y niños), igual al max=10
    # visual de ambos inputs.

  @generacion-menu @edge-case @verificado-manual-2026-07-31
  Escenario: El perfil de usuario no existe todavía
    Dado que un usuario autenticado nunca completó el onboarding
    Cuando se intenta generar un menú para él
    Entonces el sistema responde 404 "Perfil de usuario no encontrado"

  @generacion-menu @edge-case @verificado-manual-2026-07-31
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

  @generacion-menu @edge-case @verificado-manual-2026-07-31 @automatizado
  # Automatizado: tests/steps/entrega-parcial.steps.ts (playwright-bdd,
  # cuenta de test dedicada PRO_USER_EMAIL — fixture sembrado por REST,
  # sin mock; ver el archivo para por qué no usa la cuenta compartida)
  Escenario: El frontend muestra la franja sin receta
    Dado que un menú persistido tiene una franja con recipe_id null
    Cuando el usuario visita /menu o /calendar
    Entonces ve esa franja marcada como "Sin receta", sin crashear
    Y no puede arrastrarla ni marcarla como cocinada/descartada
    # FRESCO-361 (A4-M3): la etiqueta de la franja es neutral ("Sin receta");
    # el motivo (sin receta compatible con tus alergias, o sin variedad
    # suficiente sin repetir plato) lo explica el banner de advertencias.

  # ==========================================================================
  # Seguridad alimentaria — red de tests del filtro de alérgenos (A4-B2)
  # ==========================================================================
  # FRESCO-361: `get_filtered_recipes()` es el ÚNICO punto de enforcement
  # estructural de seguridad alimentaria (ADR-0001, NFR-SEC-3). Estos
  # escenarios trazan un alérgeno declarado desde el perfil hasta el plato y
  # asertan su ausencia. Gateados en CI vía `bun run test:e2e`.

  @seguridad @seguridad-alimentaria @automatizado
  # Automatizado: tests/steps/seguridad-alimentaria.steps.ts
  Escenario: Una receta con un alérgeno declarado nunca llega al menú generado
    Dado que un perfil declara alergia a "gluten" y "lactosa"
    Cuando se genera su menú semanal completo
    Entonces ninguna de las 21 recetas del menú contiene "gluten" ni "lactosa"

  @seguridad @seguridad-alimentaria @automatizado
  # Automatizado: tests/steps/seguridad-alimentaria.steps.ts
  Escenario: El filtro de alérgenos no depende de mayúsculas o minúsculas
    Dado que un perfil declara su alergia como "GLUTEN" en mayúsculas
    Cuando se pide su catálogo filtrado de recetas
    Entonces ninguna receta del catálogo filtrado contiene el alérgeno "gluten"

  @seguridad @seguridad-alimentaria @automatizado
  # Automatizado: tests/steps/seguridad-alimentaria.steps.ts
  Escenario: Cada uno de los alérgenos declarables filtra recetas de verdad
    Dado que el catálogo etiqueta recetas con cada alérgeno declarable
    Cuando un perfil declara alergia a cada uno de ellos por separado
    Entonces el catálogo filtrado excluye toda receta que contenga ese alérgeno

  # FRESCO-362 (audit-4 A4-H1 + A4-H2): las otras dos rutas por las que una
  # receta podía entrar en el plan sin pasar por get_filtered_recipes — la
  # sustitución de un plato y la reasignación del menú de una invitada.

  @seguridad @seguridad-alimentaria @automatizado
  # Automatizado: tests/steps/seguridad-alimentaria.steps.ts (FRESCO-362)
  Escenario: La sustitución de un plato rechaza una receta con un alérgeno del perfil
    Dado que un perfil declara alergia a "gluten" y tiene un menú sembrado
    Cuando intenta sustituir un plato por una receta que contiene "gluten"
    Entonces la petición se rechaza con 422 y el plato no cambia

  @seguridad @seguridad-alimentaria @automatizado
  # Automatizado: tests/steps/seguridad-alimentaria.steps.ts (FRESCO-362)
  Escenario: update-recipe-status solo acepta estados de la whitelist
    Dado que un usuario autenticado sin menú
    Cuando envía un estado que no es "cocinada", "descartada" ni "sustituida"
    Entonces la petición se rechaza con 400

  @seguridad @seguridad-alimentaria @automatizado
  # Automatizado: tests/steps/seguridad-alimentaria.steps.ts (FRESCO-362)
  Escenario: Reasignar los datos de una invitada re-filtra el menú contra el perfil destino
    Dado que la cuenta destino declara alergia a "gluten"
    Y una invitada tiene un menú con una receta que contiene "gluten" y otra que no
    Cuando se reasignan los datos de la invitada a la cuenta destino
    Entonces el plato con "gluten" queda excluido y el plato sin alérgeno se conserva

  # ==========================================================================
  # Modo Invitado y Registro Progresivo (EPIC-FRESCO-16 / EPIC-FRESCO-18)
  # ==========================================================================

  @invitado @verificado-manual-2026-07-31 @automatizado
  # Automatizado: tests/steps/invitado.steps.ts (FRESCO-353)
  Escenario: Una visitante nueva genera un menú sin crear cuenta
    Dado que una visitante sin cuenta ni sesión visita la landing
    Cuando completa el onboarding de 3 pasos y genera su menú
    Entonces se crea una sesión anónima real (ADR-0003) sin que ella lo note
    Y ve su menú completo de 21 comidas en /menu, sin ningún prompt de registro
    # Confirmado en vivo: JWT decodificado con is_anonymous: true.

  @registro-progresivo @verificado-manual-2026-07-31 @automatizado
  # Automatizado: tests/steps/registro-progresivo-edge.steps.ts
  Escenario: La invitada ve una invitación a guardar su menú
    Dado que una invitada con sesión anónima tiene un menú ya generado
    Cuando permanece en /menu
    Entonces ve un banner "Crea una cuenta para no perder este menú"
    Y un enlace a /signup

  @registro-progresivo @verificado-manual-2026-08-07
  # FRESCO-353: NO automatizado — la conversión es un flujo de 2 pasos con
  # verificación de código OTP de 6 dígitos (FRESCO-89); el camino feliz
  # completo necesita un inbox real. Queda manual.
  # FRESCO-89 (arreglado 2026-08-07): la conversión ahora es un flujo de dos
  # pasos — updateUser({ email }) primero, luego (tras verificar el código de
  # 6 dígitos enviado al correo) verifyOtp() + updateUser({ password }). Es
  # el patrón que los docs oficiales de Supabase documentan para "Convert an
  # anonymous user to a permanent user"; el proyecto tiene secure email
  # change activado, así que el password no puede aplicarse hasta que el
  # email quede verificado. Verificado en vivo con Playwright contra el
  # proyecto real de Supabase: la pantalla "Revisa tu correo" aparece tras el
  # paso 1, un código erróneo muestra el error traducido correctamente. El
  # último tramo del camino feliz (código real → password seteado → login
  # sobrevive a perder la sesión anónima) no se pudo verificar de punta a
  # punta en esta sesión por falta de acceso a un inbox real — pendiente de
  # una pasada de QA manual con una cuenta de correo real.
  Escenario: La invitada convierte su sesión anónima en una cuenta real
    Dado que una invitada con sesión anónima y un email nuevo rellena email y contraseña en /signup
    Cuando confirma el formulario y verifica el código de 6 dígitos enviado a su correo
    Entonces su sesión anónima se actualiza a una cuenta real (mismo user_id)
    Y conserva el menú que ya había generado como invitada

  @registro-progresivo @edge-case @verificado-manual-2026-08-07
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
    # ambos. Ver el escenario de arriba para el detalle de lo verificado en
    # vivo y lo pendiente de QA manual.

  @registro-progresivo @edge-case @verificado-manual-2026-08-08
  Escenario: Una password débil se rechaza antes de gastar el roundtrip de OTP
    Dado que una invitada rellena /signup con un email nuevo y una password de menos de 6 caracteres
    Cuando confirma el formulario
    Entonces se rechaza de inmediato, sin llegar a la pantalla de OTP
    # FRESCO-123 (arreglado 2026-08-08): app/signup/page.tsx no validaba la
    # password client-side — una invitada gastaba todo el roundtrip real de
    # email (esperar código, copiarlo) para recién ahí enterarse de que su
    # password de 3 caracteres se rechazaba. Fix: minLength=6 en el input +
    # chequeo JS con el mismo mensaje que usa weak_password de Supabase.
    # Verificado en vivo: password "123" nunca llega a "Revisa tu correo";
    # password válida sigue llegando normalmente (sin regresión).

  @registro-progresivo @edge-case @verificado-manual-2026-08-08
  Escenario: El botón de confirmar código OTP solo se habilita con los 6 dígitos completos
    Dado que la invitada está en la pantalla de OTP
    Cuando escribe menos de 6 dígitos
    Entonces el botón "Confirmar código" permanece deshabilitado
    # FRESCO-126 (arreglado 2026-08-08): el gate solo chequeaba !otpCode
    # (truthy), dejaba enviar con 2 dígitos — el servidor siempre rechaza
    # pero era una request desperdiciada (el error ya se mostraba bien
    # traducido, sin fuga de error crudo). Fix: gate por
    # otpCode.length === 6 + maxLength/pattern en el input.

  @registro-progresivo @edge-case @pendiente
  # NO automatizable con la infraestructura de test actual: verificado en
  # vivo (dos veces, con PRE_USER_EMAIL y con la llamada updateUser({email,
  # password}) original combinada) que Supabase encola el cambio con 200 sin
  # error — incluso cuando el email de destino ya pertenece a otra cuenta
  # confirmada — el mismo comportamiento anti-enumeración que este archivo ya
  # documenta para el signUp() normal. El conflicto real (`email_exists`)
  # solo puede surgir en `handleVerifyOtp` (verifyOtp() o el updateUser({
  # password }) posterior), que ahora lo captura y muestra esta misma
  # pantalla — pero confirmarlo de punta a punta requiere el código de 6
  # dígitos real, y no hay ningún fixture en `tests/` que lea un inbox real
  # (ni siquiera para PRO_USER_EMAIL). Pendiente de QA manual con
  # inbox real.
  Escenario: El email de conversión ya pertenece a una cuenta real distinta
    Dado que una invitada intenta convertir su sesión con un email ya registrado
    Cuando confirma el formulario de /signup y verifica el código de 6 dígitos
    Entonces ve un mensaje claro explicando el conflicto
    Y se le ofrece continuar con la cuenta existente ingresando su contraseña

  @registro-progresivo @edge-case @pendiente
  # Depende de alcanzar la pantalla de conflicto de arriba — mismo bloqueo:
  # requiere el código de 6 dígitos real de PRO_USER_EMAIL, sin fixture
  # de lectura de inbox en tests/. El mecanismo de reasignación en sí
  # (`handleReassign`, `reassign_guest_data()`) no se tocó en FRESCO-89 y
  # sigue siendo el mismo verificado de punta a punta el 2026-07-31 — lo que
  # cambió es solo cómo se llega a esta pantalla.
  Escenario: La invitada resuelve el conflicto con la contraseña correcta de la cuenta existente
    Dado que la invitada ve el conflicto de email y conoce la contraseña de esa cuenta
    Cuando la ingresa y confirma
    Entonces sus datos de invitada (menú, perfil) se reasignan a la cuenta real
    Y su sesión anónima y perfil huérfano se eliminan
    Y la cuenta real conserva exactamente su plan original, sin duplicarse
    Y es redirigida a /menu como la cuenta real
    # Verificado de punta a punta con casos reales el 2026-07-31, cuando
    # todavía se llegaba a esta pantalla sin pasar por OTP (ver nota arriba).

  @registro-progresivo @edge-case @pendiente
  # Mismo bloqueo que los dos escenarios anteriores.
  Escenario: La invitada ingresa una contraseña incorrecta al intentar reasignar
    Dado que la invitada ve el conflicto de email
    Cuando ingresa una contraseña incorrecta para esa cuenta
    Entonces ve un error claro
    Y no se mueve ni se modifica ningún dato

  @invitado @edge-case @verificado-manual-2026-08-07
  Escenario: Cerrar sesión como invitada advierte antes de borrar el menú generado
    Dado que una invitada generó un menú y tiene sesión anónima activa
    Cuando toca "Cerrar sesión" en el sidebar
    Entonces se le advierte específicamente que va a perder el menú generado, distinto del logout normal de una cuenta real
    # FRESCO-90 (arreglado 2026-08-07): nuevo guest-logout-dialog.tsx,
    # gateado por user.is_anonymous threaded desde app/(app)/layout.tsx.
    # Verificado en vivo: invitada con menú → click logout → diálogo, no
    # redirige hasta confirmar; cuenta real → logout directo sin diálogo,
    # comportamiento preexistente intacto.

  # ==========================================================================
  # Panel de Inicio — saludo personalizado (EPIC-FRESCO-54 / STORY-FRESCO-55)
  # ==========================================================================

  @panel-inicio @verificado-manual-2026-08-02 @automatizado
  # Automatizado: tests/steps/panel-inicio.steps.ts (FRESCO-355)
  Escenario: El saludo de Inicio muestra el nombre real cuando el perfil lo tiene guardado
    Dado que el usuario guardó su nombre en /profile
    Cuando abre /menu (Inicio)
    Entonces ve el saludo con su nombre real ("¡Hola, <nombre>!")

  @panel-inicio @edge-case @verificado-manual-2026-08-02
  Escenario: El saludo de Inicio cae a un mensaje genérico cuando el nombre no está cargado
    Dado que el usuario no tiene un nombre guardado en su perfil
    Cuando abre /menu (Inicio)
    Entonces ve un saludo genérico ("¡Hola!"), sin espacio en blanco ni error
    # Verificado en vivo por la vía de sesión invitada/anónima (ADR-0003):
    # sin nombre guardado, /menu renderiza el saludo genérico sin fallo.

  @panel-inicio @verificado-manual-2026-08-06 @automatizado
  # Automatizado: tests/steps/panel-inicio.steps.ts (FRESCO-355)
  Escenario: Los iconos de favoritos y notificaciones de Inicio navegan a sus pantallas reales
    Dado que el usuario está en /menu (Inicio)
    Cuando toca el icono de favoritos o el de notificaciones de la cabecera
    Entonces es llevado a /favorites o /notifications respectivamente
    # ACTUALIZADO 2026-08-06: este escenario decía "son solo decorativos" —
    # ya no es cierto, ambos son `<Link>` reales (app/(app)/menu/page.tsx).
    # Mismos iconos también corregidos de tamaño/grosor esta sesión
    # (FRESCO-85/86/87: 22px + stroke-width 3, antes 17.6px/20px con trazo
    # de 2px que leía "pálido" — el fix real necesitó un `safelist` en
    # tailwind.config.ts porque Tailwind purgaba la clase `lucide`, inyectada
    # en runtime por la librería, invisible al escaneo estático de content).

  @panel-inicio @edge-case @verificado-manual-2026-08-07
  Escenario: El sidebar muestra un placeholder de email para invitadas, no una línea en blanco
    Dado que una invitada con sesión anónima genera un menú
    Cuando mira el pie de la barra lateral (desktop)
    Entonces ve algún indicador tipo "Invitada" en vez de un espacio vacío bajo el nombre
    # FRESCO-111 (arreglado 2026-08-07): sidebar-account.tsx ahora usa
    # {email || 'Invitada'}, mismo fallback que profile/page.tsx.
    # Verificado en vivo: "Invitada" visible en el sidebar de una invitada.

  @panel-inicio @edge-case @verificado-manual-2026-08-07
  Escenario: "Ver más recetas" del scroll horizontal y "cargar más" de la lista tienen nombres accesibles distintos
    Dado que Laura está en la sección "Últimas recetas añadidas" de Inicio
    Cuando un lector de pantalla anuncia la flecha de scroll y el botón de cargar más
    Entonces cada control anuncia una acción distinta y reconocible
    # FRESCO-112 (arreglado 2026-08-07): re-investigado en vivo — el "botón
    # de cargar más" descrito no existe en el código actual (única fuente:
    # el link "Ver todas", que ya tenía nombre distinto). El único control
    # real con "Ver más recetas" era la flecha derecha del carrusel
    # (horizontal-scroll-row.tsx), renombrada a "Ver recetas siguientes"
    # por claridad/simetría con "Ver recetas anteriores".

  @panel-inicio @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/panel-inicio.steps.ts (FRESCO-355)
  Escenario: La sugerencia de Calendario en Inicio lleva directo al plan semanal
    Dado que el usuario está en /menu (Inicio) y ve el banner de sugerencia
    Cuando toca el botón "Ver mi plan semanal"
    Entonces es llevado directamente a /calendar

  @panel-inicio @edge-case @verificado-manual-2026-08-03
  Escenario: El banner de sugerencia de Calendario se muestra aunque no exista un menú generado todavía
    Dado que el usuario no tiene un menú generado para esta semana
    Cuando abre /menu (Inicio)
    Entonces ve el banner de sugerencia de todas formas, junto al estado vacío

  @panel-inicio @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/panel-inicio.steps.ts (FRESCO-355)
  Escenario: Inicio muestra el número real de recetas disponibles para el perfil del usuario
    Dado que el usuario tiene alérgenos e ingredientes marcados en su perfil
    Cuando abre /menu (Inicio)
    Entonces ve el número de recetas disponibles que respetan esas restricciones

  @panel-inicio @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/panel-inicio.steps.ts (FRESCO-355)
  Escenario: Tocar la card de recetas disponibles lleva al catálogo
    Dado que el usuario ve la card de recetas disponibles en Inicio
    Cuando toca la card
    Entonces es llevado a la pantalla de Recetas

  @panel-inicio @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/panel-inicio.steps.ts (FRESCO-355)
  Escenario: Inicio muestra las tres estimaciones orientativas
    Dado que Laura abre Inicio
    Cuando mira las cards de estimación
    Entonces ve una estimación de gasto semanal, una de ahorro y una de tiempo recuperado, cada una indicando que es un valor orientativo
    # Cifras placeholder genéricas (no calculadas por usuario, per Business
    # Rule de FRESCO-58) — pendientes de validación real de negocio, marcadas
    # en la propia UI ("Cifras de referencia general, pendientes de validar
    # con datos reales de mercado").

  @panel-inicio @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/panel-inicio.steps.ts (FRESCO-355)
  Escenario: Inicio muestra las últimas recetas añadidas al catálogo, dentro del perfil del usuario
    Dado que Laura abre Inicio
    Cuando mira la sección de últimas recetas
    Entonces ve las recetas agregadas más recientemente al catálogo, dentro de las que puede comer según su perfil

  @panel-inicio @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/panel-inicio.steps.ts (FRESCO-355)
  Escenario: Tocar "Ver todas" en últimas recetas lleva al catálogo
    Dado que Laura ve la sección de últimas recetas en Inicio
    Cuando toca "Ver todas"
    Entonces es llevada a la pantalla de Recetas

  # ==========================================================================
  # Control del Menú Semanal (EPIC-FRESCO-60 / STORY-FRESCO-61/62/63)
  # ==========================================================================

  @calendario @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/calendario-semana.steps.ts (FRESCO-352)
  Escenario: Ver la semana siguiente desde el Calendario
    Dado que el usuario está en /calendar viendo la semana actual
    Cuando toca el control de semana siguiente
    Entonces ve el menú de la semana siguiente si existe, o el estado vacío si todavía no se generó ninguno

  @calendario @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/calendario-semana.steps.ts (FRESCO-352)
  Escenario: Ver la semana anterior desde el Calendario
    Dado que el usuario está en /calendar viendo la semana actual
    Cuando toca el control de semana anterior
    Entonces ve el menú de la semana anterior si existe, o el estado vacío si nunca se generó uno para esa semana

  @calendario @edge-case @verificado-manual-2026-08-07
  Escenario: La etiqueta de semana distingue los meses cuando la semana cruza de mes
    Dado que el usuario navega a una semana que empieza en un mes y termina en el siguiente (ej. 27 jul – 2 ago)
    Cuando mira la etiqueta de semana
    Entonces queda claro a qué mes pertenece cada extremo
    # FRESCO-109 (arreglado 2026-08-07): nueva formatWeekRangeLabel() en
    # lib/date/iso-week.ts muestra ambos meses cuando difieren. Verificado
    # en vivo: semana 2026-W31 muestra "27 jul – 2 ago".

  @calendario @edge-case @verificado-manual-2026-08-06
  Escenario: El botón de eliminar semana es alcanzable en mobile
    Dado que el usuario tiene un menú generado, viewport 375px
    Cuando busca el botón de eliminar semana en el header de /calendar
    Entonces está visible y alcanzable sin scroll horizontal accidental
    # FRESCO-105 (MAJOR, sin fix todavía): el botón de papelera queda casi
    # totalmente fuera del viewport (x: 374.6 sobre 375px de ancho), y
    # document.body.scrollWidth (411px) supera window.innerWidth (375px) —
    # la página gana 36px de scroll horizontal no deseado. En la práctica,
    # "eliminar semana" es inalcanzable en mobile sin ese scroll accidental.

  @calendario @edge-case @verificado-manual-2026-08-03
  Escenario: Un parámetro de semana inválido en la URL cae a la semana actual
    Dado que el usuario visita /calendar con un valor de semana mal formado en la URL
    Cuando la página carga
    Entonces ve la semana actual, sin ningún error

  @calendario @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/calendario-semana.steps.ts (FRESCO-352)
  Escenario: El usuario elimina el menú de la semana que está viendo
    Dado que el usuario ve un menú generado para la semana actual
    Cuando toca el botón de eliminar
    Entonces el menú completo de esa semana desaparece y ve el mismo estado vacío que si nunca hubiera generado uno

  @calendario @edge-case @verificado-manual-2026-08-03
  Escenario: No hay opción de eliminar cuando no hay menú generado
    Dado que el usuario ve el estado vacío de una semana sin menú generado
    Cuando mira los controles disponibles
    Entonces no se le ofrece la opción de eliminar

  @calendario @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/calendario-semana.steps.ts (FRESCO-352)
  Escenario: Generar un menú nuevo directamente desde el Calendario
    Dado que el usuario está viendo una semana sin menú generado todavía
    Cuando toca "Generar mi menú"
    Entonces recibe un menú semanal completo para esa semana sin salir de /calendar

  @calendario @edge-case @pendiente
  Escenario: No se puede generar sobre una semana que ya tiene menú
    Dado que el usuario está viendo una semana que ya tiene un menú generado
    Cuando mira los controles disponibles
    Entonces no puede generar uno nuevo directamente — primero tiene que eliminar el existente
    # Verificado estructuralmente (el botón nunca se renderiza en esa rama),
    # no como acción bloqueada explícita — @pendiente hasta un intento real
    # de re-generar sobre una semana con plan (caso defensivo 409).

  # ==========================================================================
  # Calendario editable (EPIC-FRESCO-10 / STORY-FRESCO-11)
  # ==========================================================================

  @calendario @verificado-manual-2026-07-29 @automatizado
  # Automatizado: tests/steps/calendario-reordenar.steps.ts (FRESCO-352)
  Escenario: El usuario reordena su menú arrastrando un plato a otro hueco
    Dado que el usuario tiene un menú generado con los 21 huecos llenos
    Cuando arrastra el plato de un día/tipo a otro hueco distinto
    Entonces ambos huecos intercambian su receta inmediatamente en pantalla
    Y el cambio queda persistido en base de datos sin acción adicional

  @calendario @verificado-manual-2026-07-29 @automatizado
  # Automatizado: tests/steps/calendario-reordenar.steps.ts (FRESCO-352)
  Escenario: El orden reordenado sobrevive a recargar la página
    Dado que el usuario reordenó su menú previamente
    Cuando recarga /calendar
    Entonces ve el menú en el orden que dejó, no el orden original generado

  @calendario @edge-case @verificado-manual-2026-07-31
  Escenario: El intercambio falla por error de red o de base de datos
    Dado que el usuario arrastra un plato a otro hueco
    Cuando el guardado del nuevo orden falla
    Entonces el plato vuelve visualmente a su posición original
    Y ve un mensaje claro de que el cambio no se guardó

  @calendario @edge-case @verificado-manual-2026-07-29
  Escenario: Un usuario autenticado puede leer de vuelta su propio menú generado
    Dado que un usuario generó un menú y tiene su propia sesión (no admin)
    Cuando visita /menu o /calendar
    Entonces puede leer sus propias recetas asociadas sin error de permisos
    # Regresión real: la policy RLS de "recipes" solo permitía rol anon;
    # corregida 2026-07-29 (migración allow_authenticated_read_recipes).

  @calendario @edge-case @verificado-manual-2026-08-01 @automatizado
  # Automatizado: tests/steps/calendario.steps.ts
  Escenario: El sistema rechaza un intercambio entre franjas de tipo distinto
    Dado que el usuario tiene un menú semanal generado con los 21 huecos llenos
    Cuando arrastra el plato de una comida sobre el hueco de una cena
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
    # Fuente cambiada de desayuno a comida (2026-08-14): FRESCO-159 quitó el
    # handle de arrastre de desayuno por completo (ya no es un origen de
    # drag posible en absoluto), así que ya no sirve para probar el rechazo
    # de tipo distinto — comida→cena preserva el mismo chequeo real
    # (tipo_plato distinto), con un origen que sigue siendo arrastrable.

  @calendario @verificado-manual-2026-08-26 @automatizado
  # Automatizado: tests/steps/calendario.steps.ts
  Escenario: El grid del calendario pagina día a día con flechas, no con scroll horizontal
    Dado que el usuario tiene un menú semanal generado con los 21 huecos llenos
    Cuando pulsa la flecha de día siguiente
    Entonces el grid muestra días más allá del lunes
    # FRESCO-271 — reemplaza el escenario de scroll táctil (FRESCO-170/
    # FRESCO-222): tercera vez que se reportaba el mismo síntoma (la columna
    # DESAYUNO/COMIDA/CENA "se movía" durante el scroll) porque cada fix
    # anterior solo resincronizaba la etiqueta contra un scrollLeft que
    # seguía cambiando. FRESCO-271 quita el scroll horizontal del todo — el
    # grid pagina de a un día por click de flecha, la etiqueta nunca vive
    # dentro de nada que se mueva. Ya no hace falta touch real ni contexto
    # mobile-emulado para probarlo.

  @calendario @edge-case @verificado-manual-2026-07-31
  Escenario: Dos arrastres simultáneos sobre huecos que se solapan
    Dado que un primer intercambio todavía no ha terminado de guardarse
    Cuando el usuario arrastra de nuevo uno de esos dos huecos
    Entonces el segundo arrastre se bloquea hasta que el primero resuelve
    # Verificado con RPC mockeada con delay artificial + dos arrastres
    # solapados: solo 1 llamada de red disparada, el segundo arrastre nunca
    # llegó a la red (bloqueado por pendingSlots antes del fetch).

  # ==========================================================================
  # Aprendizaje Cocinado/Descartado (EPIC-FRESCO-14 / STORY-FRESCO-15)
  # ==========================================================================

  @aprendizaje @verificado-manual-2026-07-31 @automatizado
  # Automatizado: tests/steps/aprendizaje.steps.ts (playwright-bdd, backend real)
  # FRESCO-329: sacado de @smoke. La cadena que ejecuta este escenario (reseed
  # del plan de la semana + login + navegación a /calendar + marca + escritura
  # update-recipe-status + render del badge) tarda >20s o falla en silencio
  # contra infra recién publicada — falló 2/2 en las primeras corridas reales
  # post-deploy. Sigue en @automatizado (corre en test:e2e contra infra caliente).
  Escenario: Marcar un plato como cocinado
    Dado que el usuario tiene un menú semanal generado con un plato en estado pendiente
    Cuando marca ese plato como cocinado
    Entonces el plato se muestra como cocinado
    Y no puede volver a cambiar el estado de ese mismo plato

  @aprendizaje @verificado-manual-2026-07-31 @automatizado
  # Automatizado: tests/steps/aprendizaje.steps.ts (playwright-bdd, backend real)
  Escenario: Marcar un plato como descartado
    Dado que el usuario tiene un menú semanal generado con un plato en estado pendiente
    Cuando marca ese plato como descartado
    Entonces el plato se muestra como descartado
    Y no puede volver a cambiar el estado de ese mismo plato

  @aprendizaje @edge-case @verificado-manual-2026-07-31 @automatizado
  # Automatizado: tests/steps/aprendizaje.steps.ts (playwright-bdd, backend real)
  Escenario: Intentar cambiar el estado de un plato ya marcado
    Dado que el usuario ya marcó un plato como cocinado o descartado
    Cuando recarga la página y observa ese mismo plato
    Entonces no ve ningún control para volver a marcarlo
    Y el plato queda fijado en su estado actual

  @aprendizaje @verificado-manual-2026-09-01 @automatizado
  # Automatizado: tests/steps/aprendizaje.steps.ts (playwright-bdd, backend real)
  # FRESCO-373 (A4-M27): la marca es la única interacción de la que depende
  # el tier de pago. Ahora tiene ventana de deshacer de 5s (snackbar) antes
  # de escribir en el backend, y el objetivo táctil pasa a >= 44px.
  Escenario: Deshacer un marcado dentro de la ventana de 5 segundos
    Dado que el usuario tiene un menú semanal generado con un plato en estado pendiente
    Cuando marca ese plato como cocinado y pulsa "Deshacer" en el snackbar
    Entonces el plato vuelve a estado pendiente con sus controles de marcado
    Y al recargar la página el plato sigue pendiente

  @aprendizaje @verificado-manual-2026-09-01 @automatizado
  # Automatizado: tests/steps/aprendizaje.steps.ts (playwright-bdd, backend real)
  # FRESCO-369 (A4-H12): el aviso plano de Free se convierte en el "puente del
  # moat" — una tarjeta con el mecanismo real (no repetir 2 semanas, subir lo
  # cocinado, bajar lo descartado), un ejemplo trabajado, y para Free un CTA a
  # Pro. La usuaria ve la propuesta diferencial ANTES del payoff de la semana 2.
  # FRESCO-103 (2026-08-07): el aviso ya no miente — el marcado siempre
  # persiste igual en Free, solo que no se aplica a sus menús.
  Escenario: Usuaria de nivel gratuito ve el puente del moat en /calendar
    Dado que el usuario es de nivel gratuito (Free)
    Cuando visita /calendar
    Entonces ve la propuesta del aprendizaje con el mecanismo explicado
    Y ve que en Free las marcas no cambian sus menús, con un CTA a Pro

  @aprendizaje @verificado-manual-2026-08-08 @automatizado
  # Automatizado: tests/steps/aprendizaje-generacion.steps.ts (FRESCO-353)
  Escenario: La generación pesa el historial real de un usuario Pro y produce una explicación (FR-5.4/5.5)
    Dado que un usuario Pro tiene al menos 2 semanas de historial cocinado/descartado real
    Cuando se genera su menú de la semana siguiente
    Entonces el algoritmo determinista evita repetir recetas marcadas cocinada o descartada, sin tocar las pendientes
    Y genera una explicación cálida en "explicacion_aprendizaje", separada de "advertencias", que menciona cocinadas y descartadas por separado
    Y queda persistida en su propio campo, no mezclada con las advertencias de seguridad
    # FRESCO-120 (arreglado 2026-08-08, ADR-0006): root cause encontrado en
    # el QA sweep del 2026-08-08 — get_recent_recipe_ids() excluía TODO lo
    # reciente sin mirar estado, así que un Pro que nunca marcaba nada
    # recibía la misma exclusión que uno que marcaba todo; la explicación
    # además decía "ya cocinaste" sobre recetas descartadas; y "destacadas"
    # leía columnas globales (recipes.veces_cocinada/rating_promedio,
    # compartidas entre TODOS los usuarios), no historial personal. Fix:
    # nueva get_recent_recipe_marks() (devuelve estado, solo cocinada+
    # descartada excluyen) + get_user_cooked_recipe_ids() (historial
    # personal para destacadas) + buildLearningExplanation() ahora reporta
    # cocinadasEvitadas/descartadasEvitadas por separado. Verificado en
    # vivo contra PRO_USER_EMAIL: 1 slot marcado cocinada + 1
    # descartada + 19 pendientes → semana siguiente excluye exactamente
    # esos 2, el resto sigue disponible, texto separa "ya cocinaste"(1) de
    # "descartaste"(1). "la IA" ya no aplica — sigue siendo 100%
    # determinista desde ADR-0005, esta ficha solo estaba desactualizada.

  @aprendizaje @verificado-manual-2026-07-31 @automatizado
  # Automatizado: tests/steps/aprendizaje-pro.steps.ts (playwright-bdd,
  # cuenta de test dedicada PRO_USER_EMAIL, real Gemini call — sin mock)
  Escenario: El usuario Pro ve la tarjeta de explicación en /menu
    Dado que un usuario Pro tiene explicacion_aprendizaje no nula en su menú
    Cuando visita /menu
    Entonces ve una tarjeta "card-insight" con esa explicación
    Y nunca se mezcla visualmente con el banner de advertencias

  # ==========================================================================
  # Lista de la compra (EPIC-FRESCO-12 / STORY-FRESCO-13)
  # ==========================================================================

  @lista-compra @verificado-manual-2026-09-01 @automatizado
  # Automatizado: tests/steps/shopping-list.steps.ts (playwright-bdd, backend real, sin mock)
  # FRESCO-367 (A4-H10): la lista ya no se genera con un botón manual — al
  # abrir /shopping-list sin lista, ShoppingListGenerator arranca la
  # generación solo (autoGenerate, on-mount). generate-shopping-list es
  # determinista (sin Gemini: consolidación + mapa estático de pasillos),
  # pero sigue sin ser @smoke (FRESCO-322) por la escritura one-time contra
  # infra fría.
  Escenario: La lista de la compra se genera automáticamente al abrir /shopping-list
    Dado que el usuario tiene un menú semanal generado
    Cuando abre la lista de la compra
    Entonces el sistema consolida los ingredientes y los clasifica por pasillo
    Y ve un resumen con el total de productos y el coste estimado
    # AC FRESCO-367: todo plan nuevo tiene lista sin acción manual; los planes
    # antiguos sin lista hacen backfill perezoso en el mismo path.

  @lista-compra @verificado-manual-2026-07-31 @automatizado
  # Automatizado: tests/steps/shopping-list.steps.ts (playwright-bdd, backend real, sin mock)
  Escenario: Marcar un producto de la lista como comprado
    Dado que el usuario tiene una lista de la compra generada
    Cuando marca un producto como comprado
    Entonces el producto se muestra visualmente como comprado
    Y el estado se conserva la próxima vez que abre la lista

  @lista-compra @verificado-manual-2026-08-14 @automatizado
  # Automatizado: tests/steps/shopping-list.steps.ts (playwright-bdd, backend real, sin mock)
  Escenario: Cada producto de la lista muestra su precio estimado
    Dado que el usuario tiene una lista de la compra generada
    Entonces cada producto muestra su cantidad, unidad y precio estimado
    Y el precio se conserva la próxima vez que abre la lista
    # FRESCO-191 (segunda vuelta): aisle-pricing.ts ya calculaba un precio
    # real por ingrediente para armar el total — precio_estimado lo expone
    # por producto en vez de perderlo en la suma.

  @lista-compra @verificado-manual-2026-08-14 @automatizado
  # Automatizado: tests/steps/shopping-list.steps.ts (playwright-bdd, backend real, sin mock)
  Escenario: Compra realizada desmarca todos los productos marcados
    Dado que el usuario tiene una lista de la compra generada con un producto marcado como comprado
    Cuando pulsa "Compra realizada"
    Entonces todos los productos quedan desmarcados
    Y el botón "Compra realizada" desaparece
    # FRESCO-191 (QA rework): repurpose real del CTA "Completar compra" del
    # mockup — sin acción de "completar lista" en el backend, así que se
    # convirtió en un desmarcado en bloque real vía toggleShoppingListItem.
    # FRESCO-215: copy renombrada de "Vaciar comprados" a "Compra realizada"
    # para comunicar la intención (fin de la compra) en vez de la mecánica.

  @lista-compra @verificado-manual-2026-08-14 @automatizado
  # Automatizado: tests/steps/shopping-list.steps.ts (playwright-bdd, backend real, sin mock)
  Escenario: Sugerencias basadas en favoritos permiten añadir un producto a la lista
    Dado que el usuario tiene una lista de la compra generada y una receta favorita con un ingrediente que no está en la lista
    Cuando pulsa "Añadir" en esa sugerencia
    Entonces el producto aparece en la lista, en su pasillo correspondiente
    Y la sugerencia desaparece del carrusel
    Y el producto se conserva la próxima vez que abre la lista
    # FRESCO-194: única fuente de datos real disponible para "sugerencias"
    # (favoritos → ingredientes no presentes en la lista actual). "Nuevo"
    # queda fuera — sin tracking de recencia en shopping_lists.

  @lista-compra @edge-case @verificado-manual-2026-07-31
  Escenario: Ya existe una lista de la compra para ese menú
    Dado que el usuario ya generó una lista de la compra para su menú semanal actual
    Cuando intenta generar la lista de nuevo
    Entonces ve la lista ya existente en lugar de una segunda lista duplicada
    # FRESCO-367: la página solo monta ShoppingListGenerator (y su
    # auto-generación) cuando NO hay lista, así que nunca regenera una
    # existente. El backstop de backend sigue vigente: segunda llamada
    # directa a la API → 409, tratado como "ya existe → re-lee".

  @lista-compra @edge-case @verificado-manual-2026-07-31
  Escenario: La consolidación de ingredientes no produce ningún resultado
    Dado que el menú semanal del usuario no tiene ingredientes que se puedan consolidar
    Cuando solicita la lista de la compra
    Entonces ve un mensaje claro de que la lista no se pudo generar, nunca una lista vacía presentada como válida

  @lista-compra @edge-case @pendiente
  # FRESCO-194 (2ª pasada). NO @automatizado: montar dos semanas de historial de
  # menú + lista para un usuario factory es desproporcionado para un badge
  # cosmético — la lógica de diff (diffNombresNuevos) está cubierta por
  # lib/api/shopping-list.test.ts. Candidato a verificación manual periódica.
  Escenario: El badge "Nuevo" marca solo los ingredientes que no estaban la semana pasada
    Dado que el usuario tuvo una lista de la compra la semana anterior con "tomate" y "arroz"
    Y su lista de esta semana tiene "tomate", "lentejas" y "pan"
    Cuando abre /shopping-list
    Entonces ve el badge "Nuevo" junto a "lentejas" y "pan"
    Y no ve el badge junto a "tomate"

  @lista-compra @edge-case @pendiente
  Escenario: Sin lista la semana anterior, ningún ingrediente se marca como nuevo
    Dado que el usuario nunca generó una lista de la compra antes de esta semana
    Cuando abre /shopping-list con su primera lista generada
    Entonces no ve el badge "Nuevo" en ningún ingrediente

  # ==========================================================================
  # Guía de testeabilidad para QA (/qa)
  # ==========================================================================

  @qa @verificado-manual-2026-08-01 @automatizado @smoke
  # Automatizado: tests/steps/qa-page.steps.ts
  # @smoke: canario post-deploy — página pública sin auth ni fixtures,
  # detecta un deploy totalmente roto (SSR/routing) antes que nada más.
  Escenario: La guía de testeabilidad en /qa es pública y muestra las 4 Edge Functions reales
    Dado que un visitante sin sesión visita /qa
    Entonces ve la arquitectura, los usuarios demo y las secciones de testing DB/API/UI
    Y ve una tarjeta por cada una de las 4 Edge Functions reales con su método y ruta
    Y no ve ningún valor real de credencial, solo nombres de variables de entorno

  # ==========================================================================
  # Seguridad — aislamiento de datos entre usuarios
  # ==========================================================================

  @seguridad @edge-case @verificado-manual-2026-08-01 @automatizado
  # Automatizado: tests/steps/aislamiento-datos.steps.ts
  # Cubre el fix de FRESCO-27: get_filtered_recipes/get_recent_recipe_marks son
  # SECURITY DEFINER (bypassan RLS) — antes del fix confiaban ciegamente en
  # p_user_id, dejando leer perfil/historial de cualquier otra cuenta real.
  # get_recent_recipe_ids (nombre original de este escenario) fue reemplazada
  # por get_recent_recipe_marks en FRESCO-120 (20260808010000) — mismo check
  # de ownership, misma cobertura de seguridad, nombre actualizado.
  Escenario: Un usuario no puede leer el historial ni el perfil de otro pasando su UUID
    Dado que dos cuentas reales y distintas existen, cada una con su propio perfil e historial de comidas
    Cuando una de las cuentas llama a get_recent_recipe_marks con el UUID de la otra
    Entonces no recibe el historial real de la otra cuenta
    Cuando la misma cuenta llama a get_filtered_recipes con el UUID de la otra
    Entonces la llamada es rechazada, no se filtra el catálogo con el perfil ajeno

  @seguridad @edge-case @verificado-manual-2026-08-01 @automatizado
  # Automatizado: tests/steps/aislamiento-datos.steps.ts
  Escenario: Un usuario no puede intercambiar franjas del menú de otra cuenta
    Dado que otra cuenta real tiene un menú con dos franjas propias
    Cuando intento intercambiar esas dos franjas ajenas desde mi propia sesión
    Entonces la llamada es rechazada por no ser el dueño del plan

  @seguridad @edge-case @verificado-manual-2026-08-01 @automatizado
  # Automatizado: tests/steps/aislamiento-datos.steps.ts
  Escenario: Un usuario no puede marcar como comprado un ítem de la lista de la compra de otra cuenta
    Dado que otra cuenta real tiene una lista de la compra con un ítem sin comprar
    Cuando intento marcar ese ítem ajeno como comprado desde mi propia sesión
    Entonces la llamada no da error pero el ítem de la otra cuenta sigue sin comprar

  # --- FRESCO-360 (auditoría-4, A4-B1): bypass de pago por el camino INSERT ---

  @seguridad @edge-case @automatizado
  # Automatizado: tests/steps/suscripcion-seguridad.steps.ts
  # Antes del fix, el trigger protect_subscription_columns era solo BEFORE
  # UPDATE: una cuenta anónima podía autoconcederse Pro permanente con un
  # único INSERT en user_profiles, sin pasar por Stripe (ADR-0007).
  Escenario: Un cliente no puede autoconcederse Pro con un INSERT directo en su perfil
    Dado que una cuenta recién creada todavía no tiene fila de perfil
    Cuando intenta crear su perfil con plan Pro y sin suscripción de Stripe
    Entonces la base de datos rechaza el INSERT
    Y su perfil sigue sin conceder Pro

  @seguridad @edge-case @no-implementado
  # La segunda red de seguridad (el cron de reconciliación degrada cualquier
  # fila Pro/Family sin stripe_subscription_id) está cubierta por el test
  # unitario `sweepOrphanPaidPlans` en app/api/cron/stripe-reconcile/route.test.ts,
  # gateado por `bun test` en CI. No se automatiza como e2e a propósito:
  # llamar al endpoint real dispara el bucle global de reconciliación contra
  # todas las filas de user_profiles y podría degradar el fixture Pro de otro
  # escenario e2e en paralelo.
  Escenario: El cron de reconciliación degrada perfiles Pro huérfanos sin suscripción
    Dado que existe una fila de perfil con plan Pro y sin suscripción de Stripe
    Cuando se ejecuta el job de reconciliación de suscripciones
    Entonces esa fila queda degradada a plan Free

  # ==========================================================================
  # Biblioteca de Recetas (EPIC-FRESCO-64 / STORY-FRESCO-65)
  # ==========================================================================

  @biblioteca @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/biblioteca.steps.ts (FRESCO-353)
  Escenario: Buscar una receta por nombre en la Biblioteca
    Dado que Laura está en la Biblioteca de recetas
    Cuando escribe el nombre de una receta en el buscador
    Entonces ve solo las recetas del catálogo que coinciden con ese nombre

  @biblioteca @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/biblioteca.steps.ts (FRESCO-353)
  Escenario: Buscar una receta por ingrediente en la Biblioteca
    Dado que Laura está en la Biblioteca de recetas
    Cuando escribe un ingrediente en el buscador
    Entonces ve las recetas del catálogo que contienen ese ingrediente
    # Nota real verificada en vivo: la coincidencia es por subcadena simple,
    # sin límite de palabra — buscar "pollo" también trae "Repollo
    # salteado..." porque "pollo" es subcadena literal de "repollo". No es
    # un bug contra el AC tal como está escrito, pero es una causística real
    # a tener en cuenta.

  @biblioteca @edge-case @verificado-manual-2026-08-03
  Escenario: El buscador de la Biblioteca no encuentra resultados
    Dado que Laura busca algo que ninguna receta contiene
    Cuando mira los resultados
    Entonces ve un estado vacío claro y distinto al de "sin recetas en el catálogo"

  @biblioteca @edge-case @pendiente
  Escenario: El catálogo de la Biblioteca está vacío para el perfil de Laura
    Dado que el perfil de Laura excluye todas las recetas del catálogo
    Cuando abre la Biblioteca
    Entonces ve un estado vacío que la orienta a revisar su perfil, no su búsqueda
    # No verificado en vivo — requeriría un perfil de prueba artificialmente
    # restrictivo; revisado solo en código (misma rama `length === 0` que el
    # resto de estados vacíos de esta familia de páginas).

  @biblioteca @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/biblioteca.steps.ts (FRESCO-353)
  Escenario: Filtrar la Biblioteca por tipo de comida
    Dado que Laura está en la Biblioteca
    Cuando toca la pestaña "Cena"
    Entonces ve solo recetas de cena del catálogo

  @biblioteca @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/biblioteca.steps.ts (FRESCO-353)
  Escenario: Volver a ver todo el catálogo en la Biblioteca
    Dado que Laura tiene una pestaña de tipo de comida activa
    Cuando toca "Todo"
    Entonces vuelve a ver el catálogo completo

  @biblioteca @edge-case @verificado-manual-2026-08-07
  Escenario: El mensaje de "No encontramos nada" deja claro que solo aplica al catálogo
    Dado que Laura tiene una receta propia guardada y busca algo que ninguna receta del catálogo contiene
    Cuando mira la sección "Tus recetas" y el mensaje de "No encontramos nada"
    Entonces el mensaje aclara que la búsqueda/filtros no aplican a "Tus recetas", que sigue visible arriba
    # FRESCO-115 (arreglado 2026-08-07, decisión del user): RecetaPropia no
    # tiene clasificacion/dieta/alergenos, no puede filtrar como el
    # catálogo — en vez de inventar lógica no soportada por el modelo de
    # datos, se aclaró el copy del EmptyState ("No encontramos nada en el
    # catálogo para tu búsqueda... tus recetas propias no se filtran
    # aquí"). "Tus recetas" sigue sin filtrarse, por diseño.

  @biblioteca @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/biblioteca.steps.ts (FRESCO-353)
  Escenario: Buscador y pestaña de tipo de comida combinados en la Biblioteca
    Dado que Laura tiene la pestaña "Cena" activa
    Cuando escribe algo en el buscador
    Entonces los resultados respetan ambos filtros a la vez

  @biblioteca @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/biblioteca.steps.ts (FRESCO-353)
  Escenario: Filtrar la Biblioteca por cocina
    Dado que Laura está en la Biblioteca
    Cuando selecciona un filtro de cocina, por ejemplo "Italiana"
    Entonces ve solo recetas de esa cocina

  @biblioteca @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/biblioteca.steps.ts (FRESCO-353)
  Escenario: Filtrar la Biblioteca por dieta
    Dado que Laura está en la Biblioteca
    Cuando selecciona un filtro de dieta, por ejemplo "Vegano"
    Entonces ve solo recetas que cumplen esa restricción

  @biblioteca @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/biblioteca.steps.ts (FRESCO-353)
  Escenario: Filtrar la Biblioteca por un alérgeno puntual
    Dado que Laura quiere evitar un ingrediente puntual que no tiene declarado en su perfil
    Cuando activa ese filtro de alérgeno en la Biblioteca
    Entonces no ve ninguna receta que lo contenga, sin que cambie su perfil permanente

  @biblioteca @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/biblioteca.steps.ts (FRESCO-353)
  Escenario: Crear una receta propia
    Dado que Laura está en la Biblioteca
    Cuando completa el formulario "Crear propia" con nombre, ingredientes y pasos, y confirma
    Entonces su receta aparece en la sección "Tus recetas", distinguible del catálogo

  @biblioteca @edge-case @verificado-manual-2026-08-07
  Escenario: Un nombre de receta propia extremadamente largo no rompe el layout de la grilla
    Dado que Laura pega un nombre de ~1000 caracteres en el formulario "Crear propia"
    Cuando guarda la receta
    Entonces la tarjeta se trunca visualmente, sin desalinear el resto de la grilla "Tus recetas"
    # FRESCO-107 (arreglado 2026-08-07): maxLength={100} en el input
    # (create-recipe-form.tsx) + line-clamp-2 en personal-recipe-card.tsx
    # como defensa independiente. Verificado en vivo: card clamped a 2
    # líneas, grilla sin distorsión.

  @biblioteca @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/biblioteca.steps.ts (FRESCO-355 mini-batch)
  Escenario: Campos obligatorios al crear una receta propia
    Dado que Laura abre el formulario de "Crear propia" sin completar el nombre
    Cuando intenta guardar
    Entonces ve un mensaje claro pidiéndole completar el nombre antes de guardar

  @biblioteca @edge-case @verificado-manual-2026-08-07
  Escenario: El botón "Guardar receta" se deshabilita mientras el nombre esté vacío
    Dado que Laura abre "Crear propia" y deja el nombre vacío o solo con espacios
    Cuando mira el botón "Guardar receta"
    Entonces está deshabilitado, no solo mostrando un error tras el click
    # FRESCO-118 (arreglado 2026-08-07): disabled={!isValid || isSaving},
    # igual que components/profile/nombre-form.tsx. Verificado en vivo con
    # Playwright: deshabilitado con nombre vacío/solo espacios, habilitado
    # al escribir un nombre real.

  @biblioteca @automatizado
  # Automatizado: tests/steps/biblioteca.steps.ts (FRESCO-355 mini-batch)
  Escenario: Receta propia no participa en la generación de menú
    Dado que Laura tiene una receta propia guardada
    Cuando genera un menú semanal nuevo
    Entonces esa receta propia nunca aparece en el menú generado por la IA
    # No verificado con un ciclo de generación real -- garantía estructural
    # confirmada por code review (get_filtered_recipes()/generate-meal-plan
    # nunca referencian recetas_propias), no por prueba en vivo.

  @biblioteca @verificado-manual-2026-08-07 @automatizado
  # Automatizado: tests/steps/biblioteca.steps.ts (FRESCO-353)
  Escenario: Ver detalle de una receta del catálogo
    Dado que Laura está en la Biblioteca
    Cuando abre una receta del catálogo
    Entonces ve su nombre, ingredientes, pasos, tiempo, dificultad y tags de dieta/alérgeno/cocina
    # Corrección 2026-08-07: los tags de dieta NUNCA se mostraban aquí desde
    # que se escribió este escenario (2026-08-03) — DIETA_LABELS vivía en un
    # módulo 'use client', invisible para este Server Component (ver nota en
    # el escenario "dificultad y coste estimado" más abajo). No detectado en
    # su momento porque la verificación manual no separó "tags de dieta" de
    # "tags de alérgeno/cocina" en la evidencia. Arreglado junto con
    # FRESCO-117 — ahora sí muestra todos los flags de dieta activos.

  @biblioteca @edge-case @verificado-manual-2026-08-07
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
    # client-reference, no el objeto real (confirmado con un dump de debug:
    # {} en runtime, sin error de build/tipos). Esto ya afectaba a
    # DIETA_LABELS — los tags de dieta nunca aparecían en el detalle de
    # receta de catálogo; ahora sí. FRESCO-116 (espacio faltante en el meta
    # de la tarjeta, "30 min ·alto") arreglado por separado el mismo día
    # (2026-08-07): faltaba un {' '} explícito entre "min ·" y el valor de
    # coste_estimado en recipe-card.tsx. Verificado en vivo: "30 min · alto"
    # con espacio correcto.
    # FRESCO-122 (arreglado 2026-08-08): 228/1000 recetas (22.8%) tenían
    # meta.dificultad = "alta" en el dato real — valor que nunca fue parte
    # del enum DificultadReceta (muy_facil|facil|media|avanzada). Como meta
    # es jsonb no tipado en Postgres, el mismatch era invisible a TS y
    # renderizaba "30 min ·  · muy bajo" (doble punto, dificultad en
    # blanco). Fix: migración de datos normalizando "alta"→"avanzada" —
    # cero cambio de código, el tipo y el label map ya estaban bien.
    # Verificado en vivo: "30 min · avanzada · muy bajo".

  @biblioteca @edge-case @verificado-manual-2026-08-08
  Escenario: Receta propia con 1 solo ingrediente usa singular "1 ingrediente"
    Dado que Laura tiene una receta propia con exactamente 1 ingrediente
    Cuando ve su tarjeta en Recetas
    Entonces lee "1 ingrediente", no "1 ingredientes"
    # FRESCO-125 (arreglado 2026-08-08): pluralización naive en
    # personal-recipe-card.tsx, siempre añadía "s". Verificado en vivo.

  @biblioteca @edge-case @verificado-manual-2026-08-08
  Escenario: Receta propia con nombre vacío — investigado, constraint server-side ya existía
    Dado que se intenta insertar una receta propia con nombre vacío o solo espacios
    Cuando la escritura llega a Postgres
    Entonces se rechaza por un CHECK constraint
    # FRESCO-124: el QA sweep del 2026-08-08 encontró una fila real con
    # nombre vacío en producción — investigado, el CHECK
    # (char_length(trim(nombre)) > 0) YA EXISTÍA desde la creación de la
    # tabla (20260803000000_create_recetas_propias_table.sql), verificado
    # en vivo que rechaza un INSERT directo con nombre en blanco. La fila
    # reportada era debris transitorio de un test concurrente (varios
    # agentes de QA corriendo en paralelo contra la misma DB), no un gap
    # real — eliminada como limpieza. Ticket cerrado como no-reproducible.
    # Nota aparte, fuera de este ticket: el límite de 100 caracteres
    # (FRESCO-107) sí sigue siendo solo client-side, sin backstop en DB.

  @biblioteca @edge-case @verificado-manual-2026-08-07
  Escenario: Se puede marcar/desmarcar favorito desde el detalle de una receta del catálogo
    Dado que Laura abre el detalle de una receta de catálogo
    Cuando busca el control de favorito en esa pantalla
    Entonces puede alternar el favorito ahí mismo, sin volver a la Biblioteca o Favoritos
    # FRESCO-108 (arreglado 2026-08-07): nuevo favorite-toggle-button.tsx
    # montado sobre la imagen en CatalogRecipeDetail, mismo patrón
    # optimista que FavoriteRecipeCard. Verificado en vivo: toggle funciona
    # y persiste tras reload.

  @biblioteca @edge-case @verificado-manual-2026-08-07
  Escenario: El filtro de tipo de comida soporta navegación por flechas de teclado (patrón radiogroup)
    Dado que Laura tabula hasta el grupo "Filtrar por tipo de comida" en la Biblioteca
    Cuando usa las flechas izquierda/derecha
    Entonces la selección se mueve entre las opciones, con Tab deteniéndose solo en la opción activa
    # FRESCO-119 (arreglado 2026-08-07): components/ui/segmented-control.tsx
    # ahora implementa roving tabindex + flechas izquierda/derecha (con
    # wrap). Verificado en vivo con Playwright sobre /recipes: solo la
    # opción marcada tiene tabindex="0", ArrowRight/ArrowLeft mueven foco y
    # selección, wrap correcto en ambos extremos.

  @biblioteca @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/biblioteca.steps.ts (FRESCO-355 mini-batch)
  Escenario: Ver detalle de una receta propia
    Dado que Laura tiene una receta propia en su Biblioteca
    Cuando la abre
    Entonces ve su nombre, ingredientes y pasos, distinguible como receta propia

  @biblioteca @verificado-manual-2026-08-03 @automatizado
  # Automatizado: tests/steps/biblioteca.steps.ts (FRESCO-355 mini-batch)
  Escenario: Volver a la Biblioteca desde el detalle
    Dado que Laura está viendo el detalle de una receta
    Cuando elige volver
    Entonces regresa a la Biblioteca

  # ==========================================================================
  # Perfil
  # ==========================================================================

  @perfil @edge-case @verificado-manual-2026-08-07
  Escenario: El input "Tu nombre" no muestra borde de error en el primer render
    Dado que Laura entra a /profile con una cuenta que todavía no tiene nombre guardado
    Cuando la página carga por primera vez, sin que ella haya tocado el campo
    Entonces el input "Tu nombre" se ve neutral, sin borde de error
    # FRESCO-113 (arreglado 2026-08-07): className ahora gateado por
    # touched && !isValid, igual que el mensaje. Verificado en vivo: sin
    # borde rojo en primer render, rojo tras touch+vacío.

  @perfil @edge-case @verificado-manual-2026-08-08
  Escenario: El FAQ de Ayuda describe correctamente cómo se genera el menú, sin mencionar Gemini
    Dado que Laura abre /profile → Ayuda → FAQ
    Cuando lee "¿Cómo genera Fresco mi menú semanal?"
    Entonces el texto describe un proceso 100% determinista, sin ninguna mención a Gemini ni IA
    # FRESCO-121 (arreglado 2026-08-08): el FAQ decía "Gemini solo entra en
    # juego en Plan Pro, para redactar la explicación" — falso desde el
    # 2026-08-01 (ADR-0005 + commit ae3b560), confirmado independientemente
    # por los 3 agentes del QA sweep del 2026-08-08. Reescrito. Verificado
    # en vivo: cero menciones a "gemini" en el texto renderizado.

  @perfil @verificado-manual-2026-08-04 @automatizado
  # Automatizado: tests/steps/perfil.steps.ts (FRESCO-355)
  Escenario: Editar preferencias de dieta y alérgenos desde el perfil
    Dado que Laura está en /profile
    Cuando activa un chip de dieta y confirma "Actualizar Preferencias"
    Entonces la preferencia queda guardada y sigue activa tras recargar la página

  @perfil @verificado-manual-2026-08-04 @automatizado
  # Automatizado: tests/steps/perfil.steps.ts (FRESCO-355)
  Escenario: Descargar un backup de los propios datos en JSON
    Dado que Laura está en /profile
    Cuando pulsa "Descargar" en Backup JSON
    Entonces recibe un fichero con su perfil, menús, listas de la compra y recetas propias reales

  @perfil @verificado-manual-2026-08-04 @automatizado
  # Automatizado: tests/steps/perfil.steps.ts (FRESCO-355)
  Escenario: Cerrar sesión desde el perfil
    Dado que Laura está en /profile con sesión activa
    Cuando pulsa "Salir"
    Entonces la cookie de sesión se elimina y vuelve a /login

  @perfil @edge-case @verificado-manual-2026-08-04
  Escenario: Borrar cuenta exige escribir el email exacto para habilitarse
    Dado que Laura abre el diálogo "Borrar cuenta definitivamente"
    Cuando escribe un email distinto al suyo
    Entonces el botón de confirmación sigue deshabilitado
    Cuando escribe su propio email exacto
    Entonces el botón de confirmación se habilita

  @perfil @automatizado
  # Automatizado: tests/steps/perfil.steps.ts (FRESCO-355 mini-batch)
  Escenario: Borrar cuenta definitivamente elimina la cuenta y todos sus datos
    Dado que Laura confirma el borrado con su email exacto
    Cuando el sistema ejecuta la Edge Function delete-account
    Entonces su auth.users se elimina y el cascade de FK limpia user_profiles/meal_plans/shopping_lists/recetas_propias
    Y la sesión se cierra y es redirigida a /login con un mensaje de despedida
    # No verificado con una ejecución real de punta a punta -- destructivo e
    # irreversible, no ejecutado contra ninguna cuenta sin confirmación
    # explícita separada. Verificado sí: el gating del diálogo (ver escenario
    # anterior), que la Edge Function está deployada y ACTIVE, y que el
    # cascade de FK (user_profiles/meal_plans/shopping_lists/recetas_propias
    # -> auth.users, todos ON DELETE CASCADE) está confirmado por migración.

  # ==========================================================================
  # QA y herramientas de desarrollo
  # ==========================================================================

  @qa @edge-case @verificado-manual-2026-08-08
  Escenario: La página /qa no se autocontradice sobre la arquitectura de generación
    Dado que un evaluador externo abre /qa
    Cuando lee la cabecera y la sección "Arquitectura"
    Entonces ambas describen el mismo mecanismo, sin mencionar "IA" en una y "100% determinista, sin IA" en la otra
    # FRESCO-127 (arreglado 2026-08-08): la cabecera decía "generación
    # asistida por IA", la sección Arquitectura dos párrafos después decía
    # "100% deterministas — sin llamadas a modelos de IA en producción".
    # Se corrigió la cabecera para que coincida.

  @app-shell @edge-case @verificado-manual-2026-08-08
  Escenario: El title tag global no reclama un mecanismo de "IA" que ya no existe
    Dado que cualquier página de la app carga
    Cuando se inspecciona el <title> del documento
    Entonces no menciona "IA" como el mecanismo del producto
    # FRESCO-128 (arreglado 2026-08-08): "Fresco — Menús semanales con IA
    # que aprende de lo que realmente cocinas" → "Fresco — Menús semanales
    # que aprenden de lo que realmente cocinas". Mismo tema que
    # FRESCO-121/127, visible en cada pestaña/resultado de búsqueda/preview
    # de link compartido.

  # ==========================================================================
  # Suscripción Pro / Stripe — EPIC-FRESCO-227 / STORY-FRESCO-228/230/231/232
  # ==========================================================================

  # --- STORY-FRESCO-228: actualizar a Pro desde el perfil ---

  @suscripcion @verificado-manual-2026-08-19 @automatizado
  Escenario: Iniciar checkout desde el perfil
    Dado que Laura está en su perfil con plan Free
    Cuando toca el botón de actualizar a Pro
    Entonces es llevada a completar el pago de la suscripción Pro en Stripe Checkout real
    # FRESCO-228. Verificado en producción real (fresco-pro.vercel.app),
    # no simulado. Confirmado junto con el resto de la épica el
    # 2026-08-19 tras encontrar y arreglar 2 bugs de infra que dejaban el
    # webhook fallando en silencio desde que se shippeó (ver nota de
    # infraestructura al final de este fichero).
    # Grupo B automatizado (FRESCO-277): click real en /profile, assert del
    # redirect real a checkout.stripe.com -- sin llenar el formulario
    # hospedado.

  @suscripcion @verificado-manual-2026-08-19 @automatizado
  Escenario: Trial sin tarjeta
    Dado que Laura empieza el proceso de actualizar a Pro
    Cuando llega a la pantalla de pago de Stripe Checkout
    Entonces se le ofrece un periodo de prueba de 7 días sin necesidad de tarjeta
    # FRESCO-228. Verificado en producción real: Checkout Session con
    # trial_period_days: 7 y payment_method_collection: 'if_required'.
    # Grupo C automatizado (FRESCO-277): llamada real a POST
    # /api/stripe/checkout (autenticada vía cookies de sesión, no la UI
    # entera), luego se lee la Checkout Session creada vía la API real de
    # Stripe -- sin llenar el formulario hospedado.
    # GAP conocido: `payment_method_collection: 'if_required'` sí se
    # verifica (confirma "sin necesidad de tarjeta"), pero
    # `trial_period_days: 7` NO -- confirmado empíricamente que Stripe no
    # devuelve ese campo al leer una Checkout Session (solo existe como
    # input en `SessionCreateParams`, nunca se refleja en la respuesta; la
    # Subscription real tampoco existe todavía en este punto -- `session.
    # subscription` es `null` hasta que el cliente completa el checkout
    # hospedado). Verificar los 7 días exigiría completar el checkout real
    # en el DOM de Stripe, fuera del límite que se puso Grupo B ("sin
    # llenar el formulario hospedado") -- decisión consciente de dejarlo
    # sin cobertura e2e antes que acoplar el test al DOM hospedado de
    # Stripe.

  @suscripcion @verificado-manual-2026-08-19 @automatizado
  Escenario: Pago completado activa Pro
    Dado que Laura completó el pago de la suscripción Pro
    Cuando vuelve a la app
    Entonces su perfil muestra el plan Pro activo
    # FRESCO-228. Verificado en producción real vía checkout.session.completed.

  # --- STORY-FRESCO-230: reflejar el estado real de la suscripción ---

  @suscripcion @verificado-manual-2026-08-19 @automatizado
  Escenario: Pago exitoso activa Pro automáticamente
    Dado que Laura completó el pago de su suscripción
    Cuando el pago se confirma
    Entonces su cuenta pasa a plan Pro sin que tenga que hacer nada más
    # FRESCO-230. Mismo evento (checkout.session.completed) que el
    # escenario "Pago completado activa Pro" de FRESCO-228 -- ya
    # cubierto por ese handler, sin código nuevo. Verificado en el
    # mismo pase en vivo del 2026-08-19.

  @suscripcion @edge-case @verificado-manual-2026-08-19 @automatizado
  Escenario: Renovación mensual mantiene Pro
    Dado que Laura tiene una suscripción Pro activa
    Cuando se renueva el cobro mensual
    Entonces sigue teniendo plan Pro sin interrupción
    # FRESCO-230. Confirmado indirecto: no se pudo forzar un ciclo de
    # renovación real vía Stripe MCP (sin operación expuesta para
    # invoice pay/retry), pero el mismo code path (customer.subscription.updated
    # con status=active) se ejercitó de verdad al probar la cancelación
    # de FRESCO-231 y al recuperar la suscripción tras el pago fallido
    # de FRESCO-232. Cubierto también por tests unitarios del webhook.

  @suscripcion @verificado-manual-2026-08-19 @automatizado
  Escenario: Cancelación revierte a Free al fin del periodo pagado
    Dado que Laura canceló su suscripción Pro
    Cuando termina el periodo que ya pagó (customer.subscription.deleted)
    Entonces su cuenta pasa a plan Free
    # FRESCO-230. Verificado con evento real de Stripe en producción.

  # --- STORY-FRESCO-231: gestionar o cancelar la suscripción ---

  @suscripcion @verificado-manual-2026-08-19 @automatizado @smoke
  # @smoke: canario post-deploy — /profile renderiza y POST /api/stripe/portal
  # llega a la API real de Stripe (valida el wiring de claves Stripe del deploy).
  Escenario: Acceder a gestión de suscripción
    Dado que Laura tiene una suscripción Pro activa
    Y su cliente de Stripe existe realmente
    Cuando entra a su perfil y pulsa "Gestionar suscripción"
    Entonces puede abrir la gestión de su suscripción en el Billing Portal real de Stripe
    # FRESCO-231. Verificado en producción real, portal hospedado por
    # Stripe (ADR-0007: superficie hospedada de Stripe en vez de UI
    # custom).
    # Grupo B automatizado (FRESCO-277): click real en /profile, assert del
    # redirect real a billing.stripe.com. El paso extra "su cliente de
    # Stripe existe realmente" sustituye el customer id sintético de
    # `seedProBaseline` por uno real -- POST /api/stripe/portal llama a
    # `stripe.billingPortal.sessions.create({ customer: ... })` contra la
    # API real de Stripe, que rechaza un id inventado. Los demás escenarios
    # que comparten el Given "que Laura tiene una suscripción Pro activa"
    # (Renovación, Ver mi próximo cobro) no llaman a la API de Stripe, así
    # que su customer id sintético no se toca.

  @suscripcion @verificado-manual-2026-08-19
  Escenario: Cancelar la suscripción
    Dado que Laura está en la gestión de su suscripción (Billing Portal)
    Cuando elige cancelarla
    Entonces ve confirmado que seguirá teniendo Pro hasta el fin del periodo ya pagado
    # FRESCO-231. Verificado en producción real: configuración de
    # cancelación del portal en modo at_period_end.

  @suscripcion @verificado-manual-2026-08-19
  Escenario: Ver mi próximo cobro
    Dado que Laura tiene una suscripción Pro activa
    Cuando abre la gestión de su suscripción
    Entonces ve la fecha y el monto de su próximo cobro
    # FRESCO-231. Verificado en producción real, UI nativa del Billing
    # Portal (invoice_history habilitado en la configuración del portal).

  # --- STORY-FRESCO-232: saber si mi pago falló ---

  @suscripcion @edge-case @verificado-manual-2026-08-19 @automatizado
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

  @suscripcion @edge-case @verificado-manual-2026-08-19 @automatizado
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

  @suscripcion @edge-case @automatizado
  Escenario: Pago sigue fallando revierte a Free
    Dado que el pago de Laura falló y no se resolvió
    Cuando Stripe agota los reintentos y emite customer.subscription.updated con status unpaid
    Entonces su cuenta pasa a plan Free
    # FRESCO-232. Implementado en el webhook (rama `unpaid` -> downgrade
    # directo a free, sin esperar customer.subscription.deleted que
    # puede no llegar a disparar nunca en ese caso). La sesión de QA del
    # 2026-08-19 solo llegó hasta past_due y su recuperación (los dos
    # escenarios anteriores), sin agotar los reintentos hasta unpaid --
    # cubierto entonces solo por tests unitarios del webhook. Primera
    # verificación real (evento unpaid firmado y posteado) via
    # tests/steps/suscripcion.steps.ts (FRESCO-277).

  # ==========================================================================
  # Favoritos (/favorites)
  # ==========================================================================

  @favoritos @verificado-manual-2026-08-19 @automatizado
  # Automatizado: tests/steps/favoritos.steps.ts (FRESCO-355)
  Escenario: Ver la lista de recetas favoritas guardadas
    Dado que Laura tiene al menos una receta marcada como favorita
    Cuando abre /favorites
    Entonces ve una tarjeta por cada receta favorita, con imagen, nombre, categoría y tiempo/coste

  @favoritos @edge-case @verificado-manual-2026-08-19
  Escenario: La lista de favoritos vacía muestra un estado vacío claro
    Dado que Laura no tiene ninguna receta marcada como favorita
    Cuando abre /favorites
    Entonces ve un estado vacío ("Lista vacía... Guarda recetas para verlas aquí"), no una lista en blanco ni un error

  @favoritos @verificado-manual-2026-08-19 @automatizado
  # Automatizado: tests/steps/favoritos.steps.ts (FRESCO-355)
  Escenario: Quitar una receta de favoritos desde la propia pantalla de Favoritos
    Dado que Laura está en /favorites con al menos una receta guardada
    Cuando pulsa "Quitar de favoritos" en una de las tarjetas
    Entonces la tarjeta desaparece inmediatamente de la lista
    Y el cambio persiste tras recargar la página

  @favoritos @verificado-manual-2026-08-19 @automatizado
  # Automatizado: tests/steps/favoritos.steps.ts (FRESCO-355)
  Escenario: Marcar/desmarcar favorito se refleja en cualquier pantalla donde aparezca la misma receta
    Dado que Laura marca una receta como favorita desde /menu o /notifications
    Cuando visita /favorites, o el detalle de esa misma receta, o vuelve a la pantalla de origen
    Entonces el estado de favorito (marcado o no) es el mismo en todas ellas
    # Verificado en vivo cruzando /menu -> /favorites -> detalle de receta ->
    # /notifications: el toggle optimista se refleja de inmediato y persiste
    # tras recargar en las 4 pantallas.

  @favoritos @verificado-manual-2026-08-19 @automatizado
  # Automatizado: tests/steps/favoritos.steps.ts (FRESCO-355)
  Escenario: Abrir el detalle de una receta desde Favoritos
    Dado que Laura está en /favorites
    Cuando toca una tarjeta de receta favorita
    Entonces ve el detalle completo de esa receta, con el botón de favorito ya marcado

  @favoritos @edge-case @verificado-manual-2026-08-19
  Escenario: El enlace "Volver a la Biblioteca" del detalle de receta no vuelve a Favoritos aunque se haya llegado desde ahí
    Dado que Laura abre el detalle de una receta navegando desde /favorites
    Cuando pulsa "Volver a la Biblioteca"
    Entonces vuelve a /recipes (la Biblioteca), no a /favorites
    # Causística real, no necesariamente un bug -- la pantalla de detalle es
    # la misma para Biblioteca y Favoritos, y el enlace de vuelta siempre
    # apunta a /recipes independientemente de la pantalla de origen.

  # ==========================================================================
  # Centro de Avisos (/notifications)
  # ==========================================================================

  @notificaciones @edge-case @verificado-manual-2026-08-19
  Escenario: El "Centro de Avisos" no contiene avisos reales, solo recomendaciones de recetas
    Dado que Laura abre /notifications
    Entonces ve una sección "Recetas que te pueden gustar" con tarjetas de receta
    Y no ve ningún aviso de sistema, recordatorio, ni notificación real (pago, semana sin menú, etc.)
    # Causística real encontrada en el barrido QA 2026-08-19, sin ticket
    # todavía: la pantalla se titula "Centro de Avisos" / "Tus notificaciones"
    # pero el único contenido real es un carrusel de recomendaciones de
    # recetas -- el mismo tipo de tarjeta que "Últimas recetas añadidas" de
    # Inicio. No hay ningún aviso real (pago fallido, menú sin generar, etc.)
    # enrutado aquí pese a que ya existen esos eventos en el sistema (ver
    # aviso de pago fallido en /profile, FRESCO-232). Gap de producto, no
    # bug de código -- documentado para decisión de negocio.
    # ACTUALIZADO 2026-08-20 (FRESCO-234): el aviso de pago fallido ya está
    # enrutado aquí -- ver el nuevo escenario "El aviso de pago fallido
    # aparece..." más abajo. El resto de la afirmación sigue siendo cierta
    # (menú sin generar y otros eventos reales todavía no tienen un tipo de
    # aviso propio en /notifications).

  @notificaciones @edge-case @verificado-manual-2026-08-19
  Escenario: El icono de Notificaciones no muestra ningún contador de no leídos
    Dado que Laura está en /menu
    Cuando mira el icono de Notificaciones en la cabecera
    Entonces no ve ningún badge ni contador, incluso si hay recomendaciones nuevas sin ver
    # Consistente con el hallazgo anterior -- no existe concepto de
    # "leído/no leído" en esta pantalla todavía.
    # ACTUALIZADO 2026-08-20 (FRESCO-234): ya existe un badge -- un punto rojo
    # binario, deliberadamente sin contador numérico -- ver los nuevos
    # escenarios de badge más abajo. La ausencia de contador numérico sigue
    # siendo intencional, no un gap.

  @notificaciones @pago-fallido @pendiente
  Escenario: El aviso de pago fallido aparece en el Centro de Avisos para una cuenta Pro con un cobro fallido
    Dado que Laura tiene plan Pro y su último cobro de suscripción falló (payment_failed_at con valor)
    Cuando abre /notifications
    Entonces ve el aviso "Tu último pago falló" antes que cualquier otra sección
    Y puede pulsar "Gestionar mi suscripción" para ir al Billing Portal de Stripe
    # FRESCO-234: reutiliza el mismo dato ya persistido por el webhook de
    # Stripe (FRESCO-232, ya mostrado en /profile) -- ninguna columna ni
    # tabla nueva. Sin verificar en vivo todavía (requiere una cuenta Pro
    # real con un cobro fallido real).

  @notificaciones @pago-fallido @pendiente
  Escenario: El badge del icono de Notificaciones aparece cuando hay avisos pendientes
    Dado que Laura tiene al menos un aviso pendiente (bienvenida sin ver, rutas sin descartar, o pago fallido en Pro)
    Cuando abre /menu
    Entonces ve un punto rojo sobre el icono de Notificaciones de la cabecera, sin ningún número
    # FRESCO-234: getHasUnseenNotifications() en lib/api/user-profile.ts hace
    # un OR de las mismas 3 condiciones booleanas que ya gatean cada sección
    # de /notifications -- ninguna columna "visto" nueva.

  @notificaciones @pago-fallido @edge-case @pendiente
  Escenario: El badge del icono de Notificaciones no aparece cuando no hay nada pendiente
    Dado que Laura ya vio la bienvenida, ya descartó las rutas, y no tiene ningún pago fallido (o no es Pro)
    Cuando abre /menu
    Entonces el icono de Notificaciones se ve sin ningún punto rojo

  @notificaciones @verificado-manual-2026-08-19 @automatizado
  # Automatizado: tests/steps/notificaciones.steps.ts (FRESCO-355 mini-batch)
  Escenario: Se puede marcar como favorita una receta recomendada directamente desde Notificaciones
    Dado que Laura ve una receta recomendada en /notifications
    Cuando pulsa "Guardar en favoritos" en esa tarjeta
    Entonces la receta se añade a sus favoritos, visible en /favorites
    # Mismo componente de tarjeta de receta reutilizado que en
    # Inicio/Biblioteca -- el toggle de favorito funciona igual aquí.

  @notificaciones @edge-case @pendiente
  Escenario: Las recomendaciones de Notificaciones no excluyen recetas ya marcadas como favoritas
    Dado que Laura ya tiene una receta marcada como favorita
    Cuando abre /notifications
    Entonces esa misma receta puede seguir apareciendo en "Recetas que te pueden gustar"
    # Observado en vivo: tras marcar "Arroz con verduras..." como favorita,
    # siguió apareciendo en la misma lista de recomendaciones al recargar.
    # @pendiente en vez de @verificado-manual porque no se confirmó si es el
    # comportamiento pretendido (recomendaciones fijas/deterministas, sin
    # lógica de exclusión) o un gap real -- requiere decisión de producto,
    # no solo verificación técnica.

  # ==========================================================================
  # Landing pública (/)
  # ==========================================================================

  @landing @verificado-manual-2026-08-19 @automatizado
  # Automatizado: tests/steps/landing.steps.ts (FRESCO-355)
  Escenario: La landing pública muestra el value proposition, precios y FAQ sin necesidad de sesión
    Dado que un visitante sin cuenta ni sesión visita /
    Entonces ve la propuesta de valor, cómo funciona en 3 pasos, precios (Free y Pro) y FAQ
    Y ambos CTA principales ("Generar mi primer menú", "Empezar gratis") llevan a /onboarding

  @landing @verificado-manual-2026-08-19 @automatizado
  # Automatizado: tests/steps/landing.steps.ts (FRESCO-355)
  Escenario: El acordeón de FAQ de la landing expande y colapsa cada pregunta de forma independiente
    Dado que un visitante está en la sección FAQ de /
    Cuando toca una pregunta
    Entonces se expande mostrando su respuesta, sin afectar al resto de preguntas

  @landing @automatizado
  # Automatizado: tests/steps/landing.steps.ts (FRESCO-370)
  Escenario: La landing no reclama "IA" ni se compara con ChatGPT como mecanismo del producto
    Dado que un visitante sin cuenta ni sesión visita /
    Entonces el texto de la página no dice "con IA" ni menciona "ChatGPT"
    # FRESCO-370 (A4-H13): el motor es 100% determinista. La landing decía
    # "Menú semanal con IA" y "a diferencia de ChatGPT" — publicidad engañosa.
    # Mismo criterio que los escenarios FRESCO-128 de /profile más arriba.

  @landing @edge-case @verificado-manual-2026-08-19
  Escenario: Un usuario con sesión activa que visita / sigue viendo la landing pública, no su panel
    Dado que Laura tiene sesión iniciada y un menú ya generado
    Cuando visita / directamente
    Entonces sigue viendo la landing de marketing (con "Ya tengo cuenta"/"Empezar gratis"), no es redirigida a /menu
    # Causística real, no necesariamente un bug -- puede ser intencional (la
    # landing sirve también de página de marketing pública para SEO/compartir),
    # pero es una decisión de producto no documentada hasta ahora. Los CTA de
    # esa pantalla ("Empezar gratis", "Generar mi primer menú") siguen
    # apuntando a /onboarding incluso con sesión activa -- si Laura los pulsa
    # con un menú ya generado, cae en el 409 ya cubierto por el escenario "Ya
    # existe un plan para la semana solicitada".

  @landing @edge-case @verificado-manual-2026-08-19
  Escenario: El copyright del footer muestra un año desactualizado
    Dado que cualquier visitante llega al final de /
    Cuando lee el texto del footer
    Entonces ve "© 2025 Fresco..." aunque el año real ya avanzó a 2026
    # Bug cosmético real, menor severidad, sin ticket todavía -- el footer usa
    # un año hardcodeado en vez de calcularlo dinámicamente.

  # ==========================================================================
  # Notas de infraestructura (no son Gherkin ejecutable, pero son causística
  # real encontrada en pruebas en vivo — checklist para no repetir)
  # ==========================================================================
  #
  # - Toda migración nueva en supabase/migrations/ debe aplicarse contra la
  #   DB real (list_migrations vía MCP) — el repo puede tener .sql sin aplicar.
  # - Toda Edge Function nueva debe deployarse (list_edge_functions vía MCP)
  #   — el código puede existir sin estar nunca desplegado.
  # - Toda tabla nueva con RLS necesita, además de las policies, el GRANT de
  #   tabla para el rol `authenticated` (y `anon` si aplica) — RLS sin GRANT
  #   bloquea todo; GRANT sin política de rol correcto también bloquea todo.
  # - El modelo de Gemini pineado en supabase/functions/_shared/gemini.ts
  #   puede quedar deprecado por Google sin aviso — verificar contra
  #   ListModels si un 404/"no longer available" aparece en vivo.
  # - Un componente con handler de evento (onClick) SIN 'use client', renderizado
  #   directo desde una página Server Component, crashea toda la página
  #   ("Event handlers cannot be passed to Client Component props") -- no
  #   basta con que compile/typecheck limpio, solo se ve en vivo en el
  #   navegador. Encontrado en RecipeCard (bug real desde FRESCO-69,
  #   2026-08-03, sin detectar hasta esta sesión de pruebas en vivo).
  # - 2026-08-08, reporte real de producción (iPhone, wifi): "No pudimos
  #   guardar tu perfil o generar tu menú" en el paso 3 del onboarding con
  #   TODAS las opciones marcadas (7 dietas + 6 alérgenos + 14 ingredientes
  #   en el paso 1). Investigado a fondo: la combinatoria exacta reportada
  #   deja 128 recetas seguras en el catálogo (muy por encima del mínimo de
  #   21), y el mismo flujo reproducido vía Playwright contra producción
  #   real dio 200 limpio — no se pudo reproducir de forma determinista. La
  #   causa real queda sin confirmar (sospecha: primera carga real contra el
  #   `production` recién creado ese mismo día). Lo que SÍ se confirmó y
  #   arregló: el catch de app/onboarding/page.tsx colapsaba todo fallo
  #   (red, sesión expirada, error de servidor, catálogo insuficiente) en un
  #   único mensaje genérico, sin dar ninguna pista real. Ahora diferencia
  #   4 casos reales (TypeError de red, UserProfileError, EdgeFunctionError
  #   422, EdgeFunctionError otro status) — si vuelve a pasar, el mensaje va
  #   a decir qué fue de verdad.
  # - Variables de entorno añadidas a Vercel vía CLI/dashboard DESPUÉS de un
  #   build no se aplican a deploys ya corriendo — hace falta un redeploy
  #   explícito. Encontrado en 2026-08-19: STRIPE_WEBHOOK_SECRET y
  #   SUPABASE_SERVICE_ROLE_KEY se añadieron a prod y staging pero el
  #   webhook de Stripe siguió fallando hasta redesplegar ambos entornos.
  # - El rol service_role de Postgres NO tiene privilegios de tabla por
  #   defecto — necesita su propio GRANT (además de cualquier policy RLS),
  #   igual que `authenticated`/`anon`. Encontrado en 2026-08-19:
  #   service_role nunca tuvo GRANT SELECT/UPDATE sobre user_profiles, así
  #   que el webhook de Stripe devolvía 200 a Stripe pero el UPDATE a
  #   Supabase fallaba en silencio — la épica EPIC-FRESCO-227 entera nunca
  #   funcionó de punta a punta en producción hasta arreglar esto
  #   (migración 20260819124500_grant_service_role_user_profiles_privileges.sql).
  # - `stripe_api_search` (Stripe MCP) no encuentra operaciones poco
  #   comunes (attach de payment method, pay/retry de invoice, mark
  #   uncollectible) — hay que adivinar el operation id y llamar
  #   `stripe_api_details`/`stripe_api_write` directo. El formulario de
  #   tarjeta hospedado por Stripe (Checkout y Billing Portal) es un
  #   iframe anidado, accesible con refs normales de playwright-cli sin
  #   tratamiento especial.
