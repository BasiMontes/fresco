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
#   @no-implementado               → describe comportamiento deseado que AÚN no existe
#                                     en el código (mock, TODO, o feature sin construir)
#   @edge-case                     → causística además del camino feliz
#
# Al automatizar un escenario, añadir @automatizado y el fichero de test que lo cubre.

Característica: Flujo completo de usuario en Fresco
  Como equipo de producto, queremos un registro único de todos los escenarios
  de prueba y sus posibles causísticas, para tener trazabilidad end-to-end del
  producto más allá de las AC sueltas de cada tarjeta.

  # ==========================================================================
  # Autenticación
  # ==========================================================================

  @login @verificado-manual-2026-07-29 @automatizado
  # Automatizado: tests/steps/login.steps.ts (playwright-bdd)
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

  @login @edge-case @verificado-manual-2026-08-06
  Escenario: Doble-click rápido en "Iniciar sesión" no dispara dos intentos de autenticación
    Dado que un usuario completa email y contraseña válidos en /login
    Cuando hace dos clicks sincrónicos sobre "Iniciar sesión" sin esperar entre ambos
    Entonces solo se dispara una llamada de autenticación
    # FRESCO-114 (MINOR, sin fix todavía): el guard `disabled={isSubmitting}`
    # depende de un re-render de React que no llega a tiempo si los dos
    # clicks ocurren en el mismo tick — confirmado en vivo, 2 requests POST
    # idénticos a /auth/v1/token en la pestaña de red. No rompe el flujo
    # (Supabase maneja bien el duplicado), pero gasta cupo de rate-limit
    # más rápido de lo necesario.

  @registro @verificado-manual-2026-07-29 @automatizado
  # Automatizado: tests/steps/signup.steps.ts (playwright-bdd, mock de red — ver comentario en el step file)
  Escenario: Alta de nuevo usuario desde /signup
    Dado que un visitante sin cuenta rellena email y contraseña en /signup
    Cuando confirma el formulario
    Entonces se crea la cuenta en Supabase Auth
    Y el sistema le redirige a /onboarding

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

  # ==========================================================================
  # Onboarding y generación de menú (EPIC-FRESCO-4 / EPIC-FRESCO-6)
  # ==========================================================================

  @onboarding @generacion-menu @verificado-manual-2026-07-29
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

  @onboarding @edge-case @verificado-manual-2026-08-06
  Escenario: Recargar la página a mitad del onboarding no borra el progreso ya completado
    Dado que el usuario completó el paso 1 o 2 del onboarding
    Cuando recarga la página antes de llegar al paso 3
    Entonces sus respuestas ya dadas siguen ahí, no vuelve al paso 1 en blanco
    # FRESCO-94 (MAJOR, sin fix todavía): el estado del onboarding vive solo
    # en memoria de React, sin persistir a localStorage/sessionStorage ni a
    # DB hasta el submit final del paso 3 — un refresh a mitad de camino
    # pierde todo lo ya completado, sin ningún aviso.

  @onboarding @edge-case @verificado-manual-2026-08-06
  Escenario: El campo "Adultos" del hogar respeta un tope superior razonable
    Dado que el usuario está en el paso 3 del onboarding (hogar)
    Cuando escribe un valor muy grande (ej. 999) en "Adultos"
    Entonces el sistema lo rechaza o lo acota a un máximo razonable antes de permitir generar el menú
    # FRESCO-110 (MINOR, sin fix todavía): el input tiene `max={10}` visual,
    # pero validateHousehold() (lib/validation/onboarding.ts) solo exige
    # adultos > 0 — con adultos=999 el botón "Generar mi menú" queda
    # habilitado igual.

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
  # cuenta de test dedicada PRO_TEST_USER_EMAIL — fixture sembrado por REST,
  # sin mock; ver el archivo para por qué no usa la cuenta compartida)
  Escenario: El frontend muestra la franja sin receta segura
    Dado que un menú persistido tiene una franja con recipe_id null
    Cuando el usuario visita /menu o /calendar
    Entonces ve esa franja marcada como "Sin receta segura", sin crashear
    Y no puede arrastrarla ni marcarla como cocinada/descartada

  # ==========================================================================
  # Modo Invitado y Registro Progresivo (EPIC-FRESCO-16 / EPIC-FRESCO-18)
  # ==========================================================================

  @invitado @verificado-manual-2026-07-31
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

  @registro-progresivo @verificado-manual-2026-07-31 @automatizado
  # Automatizado: tests/steps/registro-progresivo.steps.ts (playwright-bdd,
  # sesión anónima + generación real; updateUser() mockeado — mismo criterio
  # que @registro para no quemar un envío de email real)
  # ATENCIÓN — este escenario quedó DESACTUALIZADO por el hallazgo de abajo
  # (FRESCO-89, barrido QA 2026-08-06): automatizado con updateUser()
  # mockeado, nunca verificado de punta a punta contra el proyecto real de
  # Supabase con un logout real intermedio. Con datos reales, la conversión
  # NO se completa — ver el escenario siguiente para el comportamiento
  # verdadero observado en vivo.
  Escenario: La invitada convierte su sesión anónima en una cuenta real
    Dado que una invitada con sesión anónima y un email nuevo rellena email y contraseña en /signup
    Cuando confirma el formulario
    Entonces su sesión anónima se actualiza a una cuenta real (mismo user_id)
    Y conserva el menú que ya había generado como invitada

  @registro-progresivo @edge-case @verificado-manual-2026-08-06
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
    # cause rompe también el escenario de "email ya registrado → reasignar
    # cuenta" de abajo — probado contra el email real de PRO_TEST_USER_EMAIL,
    # la UI de reasignación nunca se dispara.

  @registro-progresivo @edge-case @verificado-manual-2026-07-31 @automatizado
  # Automatizado: tests/steps/registro-progresivo-edge.steps.ts (target real:
  # PRO_TEST_USER_EMAIL, no el usuario de test compartido)
  Escenario: El email de conversión ya pertenece a una cuenta real distinta
    Dado que una invitada intenta convertir su sesión con un email ya registrado
    Cuando confirma el formulario de /signup
    Entonces ve un mensaje claro explicando el conflicto
    Y se le ofrece continuar con la cuenta existente ingresando su contraseña
    # Disparado en vivo contra el email real ya registrado del usuario de
    # test — 422 email_exists real, mensaje correcto.

  @registro-progresivo @edge-case @verificado-manual-2026-07-31 @automatizado
  # Automatizado: tests/steps/registro-progresivo-edge.steps.ts
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

  @registro-progresivo @edge-case @verificado-manual-2026-07-31 @automatizado
  # Automatizado: tests/steps/registro-progresivo-edge.steps.ts
  Escenario: La invitada ingresa una contraseña incorrecta al intentar reasignar
    Dado que la invitada ve el conflicto de email
    Cuando ingresa una contraseña incorrecta para esa cuenta
    Entonces ve un error claro
    Y no se mueve ni se modifica ningún dato

  @invitado @edge-case @verificado-manual-2026-08-06
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

  # ==========================================================================
  # Panel de Inicio — saludo personalizado (EPIC-FRESCO-54 / STORY-FRESCO-55)
  # ==========================================================================

  @panel-inicio @verificado-manual-2026-08-02
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

  @panel-inicio @verificado-manual-2026-08-06
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

  @panel-inicio @edge-case @verificado-manual-2026-08-06
  Escenario: El sidebar muestra un placeholder de email para invitadas, no una línea en blanco
    Dado que una invitada con sesión anónima genera un menú
    Cuando mira el pie de la barra lateral (desktop)
    Entonces ve algún indicador tipo "Invitada" en vez de un espacio vacío bajo el nombre
    # FRESCO-111 (MINOR, sin fix todavía): components/layout/sidebar-account.tsx
    # renderiza {email} sin fallback — para una sesión anónima email es "",
    # así que se ve una línea en blanco. app/(app)/profile/page.tsx SÍ tiene
    # el fallback correcto (user?.email ?? 'Invitada') para el mismo caso —
    # inconsistencia entre dos componentes que resuelven el mismo dato.

  @panel-inicio @edge-case @verificado-manual-2026-08-06
  Escenario: "Ver más recetas" del scroll horizontal y "cargar más" de la lista tienen nombres accesibles distintos
    Dado que Laura está en la sección "Últimas recetas añadidas" de Inicio
    Cuando un lector de pantalla anuncia la flecha de scroll y el botón de cargar más
    Entonces cada control anuncia una acción distinta y reconocible
    # FRESCO-112 (MINOR, sin fix todavía): ambos exponen el mismo
    # aria-label "Ver más recetas" (components/menu/horizontal-scroll-row.tsx
    # vs. el botón de cargar más) — ambiguo por lector de pantalla o control
    # por voz, aunque hacen cosas distintas (scroll del carrusel vs. cargar
    # más recetas).

  @panel-inicio @verificado-manual-2026-08-03
  Escenario: La sugerencia de Calendario en Inicio lleva directo al plan semanal
    Dado que el usuario está en /menu (Inicio) y ve el banner de sugerencia
    Cuando toca el botón "Ver mi plan semanal"
    Entonces es llevado directamente a /calendar

  @panel-inicio @edge-case @verificado-manual-2026-08-03
  Escenario: El banner de sugerencia de Calendario se muestra aunque no exista un menú generado todavía
    Dado que el usuario no tiene un menú generado para esta semana
    Cuando abre /menu (Inicio)
    Entonces ve el banner de sugerencia de todas formas, junto al estado vacío

  @panel-inicio @verificado-manual-2026-08-03
  Escenario: Inicio muestra el número real de recetas disponibles para el perfil del usuario
    Dado que el usuario tiene alérgenos e ingredientes marcados en su perfil
    Cuando abre /menu (Inicio)
    Entonces ve el número de recetas disponibles que respetan esas restricciones

  @panel-inicio @verificado-manual-2026-08-03
  Escenario: Tocar la card de recetas disponibles lleva al catálogo
    Dado que el usuario ve la card de recetas disponibles en Inicio
    Cuando toca la card
    Entonces es llevado a la pantalla de Recetas

  @panel-inicio @verificado-manual-2026-08-03
  Escenario: Inicio muestra las tres estimaciones orientativas
    Dado que Laura abre Inicio
    Cuando mira las cards de estimación
    Entonces ve una estimación de gasto semanal, una de ahorro y una de tiempo recuperado, cada una indicando que es un valor orientativo
    # Cifras placeholder genéricas (no calculadas por usuario, per Business
    # Rule de FRESCO-58) — pendientes de validación real de negocio, marcadas
    # en la propia UI ("Cifras de referencia general, pendientes de validar
    # con datos reales de mercado").

  @panel-inicio @verificado-manual-2026-08-03
  Escenario: Inicio muestra las últimas recetas añadidas al catálogo, dentro del perfil del usuario
    Dado que Laura abre Inicio
    Cuando mira la sección de últimas recetas
    Entonces ve las recetas agregadas más recientemente al catálogo, dentro de las que puede comer según su perfil

  @panel-inicio @verificado-manual-2026-08-03
  Escenario: Tocar "Ver todas" en últimas recetas lleva al catálogo
    Dado que Laura ve la sección de últimas recetas en Inicio
    Cuando toca "Ver todas"
    Entonces es llevada a la pantalla de Recetas

  # ==========================================================================
  # Control del Menú Semanal (EPIC-FRESCO-60 / STORY-FRESCO-61/62/63)
  # ==========================================================================

  @calendario @verificado-manual-2026-08-03
  Escenario: Ver la semana siguiente desde el Calendario
    Dado que el usuario está en /calendar viendo la semana actual
    Cuando toca el control de semana siguiente
    Entonces ve el menú de la semana siguiente si existe, o el estado vacío si todavía no se generó ninguno

  @calendario @verificado-manual-2026-08-03
  Escenario: Ver la semana anterior desde el Calendario
    Dado que el usuario está en /calendar viendo la semana actual
    Cuando toca el control de semana anterior
    Entonces ve el menú de la semana anterior si existe, o el estado vacío si nunca se generó uno para esa semana

  @calendario @edge-case @verificado-manual-2026-08-06
  Escenario: La etiqueta de semana distingue los meses cuando la semana cruza de mes
    Dado que el usuario navega a una semana que empieza en un mes y termina en el siguiente (ej. 27 jul – 2 ago)
    Cuando mira la etiqueta de semana
    Entonces queda claro a qué mes pertenece cada extremo
    # FRESCO-109 (MINOR, sin fix todavía): components/calendar/week-navigation.tsx
    # calcula el label usando siempre el mes del domingo para ambos
    # extremos — se muestra literalmente "27–2 AGO", que se lee como si el
    # 27 fuera de agosto (después del 2), cuando en realidad es de julio.

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

  @calendario @verificado-manual-2026-08-03
  Escenario: El usuario elimina el menú de la semana que está viendo
    Dado que el usuario ve un menú generado para la semana actual
    Cuando toca el botón de eliminar
    Entonces el menú completo de esa semana desaparece y ve el mismo estado vacío que si nunca hubiera generado uno

  @calendario @edge-case @verificado-manual-2026-08-03
  Escenario: No hay opción de eliminar cuando no hay menú generado
    Dado que el usuario ve el estado vacío de una semana sin menú generado
    Cuando mira los controles disponibles
    Entonces no se le ofrece la opción de eliminar

  @calendario @verificado-manual-2026-08-03
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

  @calendario @verificado-manual-2026-07-29
  Escenario: El usuario reordena su menú arrastrando un plato a otro hueco
    Dado que el usuario tiene un menú generado con los 21 huecos llenos
    Cuando arrastra el plato de un día/tipo a otro hueco distinto
    Entonces ambos huecos intercambian su receta inmediatamente en pantalla
    Y el cambio queda persistido en base de datos sin acción adicional

  @calendario @verificado-manual-2026-07-29
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

  @aprendizaje @edge-case @verificado-manual-2026-07-31 @automatizado
  # Automatizado: tests/steps/aprendizaje.steps.ts (playwright-bdd, backend real)
  Escenario: Usuaria de nivel gratuito ve el aviso de función Pro
    Dado que el usuario es de nivel gratuito (Free)
    Cuando visita /calendar
    Entonces ve un aviso claro de que marcar cocinado/descartado es una función de nivel Pro
    Y ese aviso aclara que su menú actual no se ve afectado
    # AC original menciona "recibe su menú de la semana siguiente" — este aviso
    # estático cumple la intención de comunicación; la aplicación real del
    # historial a generación futura es capacidad separada, gateada en el
    # tiempo (Fuera de Alcance de FRESCO-15).

  @aprendizaje @edge-case @verificado-manual-2026-08-06
  Escenario: Marcar cocinado/descartado en plan Free coincide con lo que dice el aviso
    Dado que el usuario es de nivel gratuito (Free) y ya vio el aviso "tu menú actual no se ve afectado"
    Cuando marca un plato como cocinado de todas formas
    Entonces el resultado real coincide con lo que el aviso le hizo esperar
    # FRESCO-103 (MAJOR, sin fix todavía): el marcado se guarda de verdad
    # vía updateRecipeStatus, persiste tras recargar, y es (según el propio
    # código) un estado terminal de una sola vía — sin ningún check de
    # userPlan en handleMarkEstado. Una usuaria Free que confía en el aviso
    # puede terminar con un cambio irreversible que creía sin efecto. Queda
    # abierta la decisión de negocio: ¿el aviso está mal, o el marcado
    # debería de verdad no aplicar en Free?

  @aprendizaje @verificado-manual-2026-07-31
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

  @aprendizaje @verificado-manual-2026-07-31 @automatizado
  # Automatizado: tests/steps/aprendizaje-pro.steps.ts (playwright-bdd,
  # cuenta de test dedicada PRO_TEST_USER_EMAIL, real Gemini call — sin mock)
  Escenario: El usuario Pro ve la tarjeta de explicación en /menu
    Dado que un usuario Pro tiene explicacion_aprendizaje no nula en su menú
    Cuando visita /menu
    Entonces ve una tarjeta "card-insight" con esa explicación
    Y nunca se mezcla visualmente con el banner de advertencias

  # ==========================================================================
  # Lista de la compra (EPIC-FRESCO-12 / STORY-FRESCO-13)
  # ==========================================================================

  @lista-compra @verificado-manual-2026-07-31 @automatizado
  # Automatizado: tests/steps/shopping-list.steps.ts (playwright-bdd, backend real, sin mock)
  Escenario: Generar la lista de la compra a partir de un menú
    Dado que el usuario tiene un menú semanal generado
    Cuando solicita generar la lista de la compra
    Entonces el sistema consolida los ingredientes y los clasifica por pasillo
    Y ve un resumen con el total de productos y el coste estimado

  @lista-compra @verificado-manual-2026-07-31 @automatizado
  # Automatizado: tests/steps/shopping-list.steps.ts (playwright-bdd, backend real, sin mock)
  Escenario: Marcar un producto de la lista como comprado
    Dado que el usuario tiene una lista de la compra generada
    Cuando marca un producto como comprado
    Entonces el producto se muestra visualmente como comprado
    Y el estado se conserva la próxima vez que abre la lista

  @lista-compra @edge-case @verificado-manual-2026-07-31
  Escenario: Ya existe una lista de la compra para ese menú
    Dado que el usuario ya generó una lista de la compra para su menú semanal actual
    Cuando intenta generar la lista de nuevo
    Entonces ve la lista ya existente en lugar de una segunda lista duplicada
    # El propio flujo de /shopping-list ya previene esto en la práctica (solo
    # ofrece "Generar" cuando no hay lista todavía) — verificado el backstop
    # de backend directamente por API: segunda llamada → 409.

  @lista-compra @edge-case @verificado-manual-2026-07-31
  Escenario: La consolidación de ingredientes no produce ningún resultado
    Dado que el menú semanal del usuario no tiene ingredientes que se puedan consolidar
    Cuando solicita la lista de la compra
    Entonces ve un mensaje claro de que la lista no se pudo generar, nunca una lista vacía presentada como válida

  # ==========================================================================
  # Guía de testeabilidad para QA (/qa)
  # ==========================================================================

  @qa @verificado-manual-2026-08-01 @automatizado
  # Automatizado: tests/steps/qa-page.steps.ts
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
  # Cubre el fix de FRESCO-27: get_filtered_recipes/get_recent_recipe_ids son
  # SECURITY DEFINER (bypassan RLS) — antes del fix confiaban ciegamente en
  # p_user_id, dejando leer perfil/historial de cualquier otra cuenta real.
  Escenario: Un usuario no puede leer el historial ni el perfil de otro pasando su UUID
    Dado que dos cuentas reales y distintas existen, cada una con su propio perfil e historial de comidas
    Cuando una de las cuentas llama a get_recent_recipe_ids con el UUID de la otra
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

  # ==========================================================================
  # Biblioteca de Recetas (EPIC-FRESCO-64 / STORY-FRESCO-65)
  # ==========================================================================

  @biblioteca @verificado-manual-2026-08-03
  Escenario: Buscar una receta por nombre en la Biblioteca
    Dado que Laura está en la Biblioteca de recetas
    Cuando escribe el nombre de una receta en el buscador
    Entonces ve solo las recetas del catálogo que coinciden con ese nombre

  @biblioteca @verificado-manual-2026-08-03
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

  @biblioteca @verificado-manual-2026-08-03
  Escenario: Filtrar la Biblioteca por tipo de comida
    Dado que Laura está en la Biblioteca
    Cuando toca la pestaña "Cena"
    Entonces ve solo recetas de cena del catálogo

  @biblioteca @verificado-manual-2026-08-03
  Escenario: Volver a ver todo el catálogo en la Biblioteca
    Dado que Laura tiene una pestaña de tipo de comida activa
    Cuando toca "Todo"
    Entonces vuelve a ver el catálogo completo

  @biblioteca @edge-case @verificado-manual-2026-08-06
  Escenario: "Tus recetas" respeta la búsqueda y los filtros de la Biblioteca
    Dado que Laura tiene una receta propia guardada y busca algo que ninguna receta contiene
    Cuando mira la sección "Tus recetas" y el mensaje de "No encontramos nada"
    Entonces ambos son consistentes entre sí, sin mostrar una receta y "no encontramos nada" a la vez
    # FRESCO-115 (MINOR, sin fix todavía): components/recipes/recipe-library.tsx
    # — "Tus recetas" ignora por completo la búsqueda y los filtros, sigue
    # mostrándose completa aunque el catálogo diga "No encontramos nada para
    # tu búsqueda" justo debajo. Mismo comportamiento con cualquier
    # combinación de filtros (tab de comida, cocina, dieta, alérgeno).

  @biblioteca @verificado-manual-2026-08-03
  Escenario: Buscador y pestaña de tipo de comida combinados en la Biblioteca
    Dado que Laura tiene la pestaña "Cena" activa
    Cuando escribe algo en el buscador
    Entonces los resultados respetan ambos filtros a la vez

  @biblioteca @verificado-manual-2026-08-03
  Escenario: Filtrar la Biblioteca por cocina
    Dado que Laura está en la Biblioteca
    Cuando selecciona un filtro de cocina, por ejemplo "Italiana"
    Entonces ve solo recetas de esa cocina

  @biblioteca @verificado-manual-2026-08-03
  Escenario: Filtrar la Biblioteca por dieta
    Dado que Laura está en la Biblioteca
    Cuando selecciona un filtro de dieta, por ejemplo "Vegano"
    Entonces ve solo recetas que cumplen esa restricción

  @biblioteca @verificado-manual-2026-08-03
  Escenario: Filtrar la Biblioteca por un alérgeno puntual
    Dado que Laura quiere evitar un ingrediente puntual que no tiene declarado en su perfil
    Cuando activa ese filtro de alérgeno en la Biblioteca
    Entonces no ve ninguna receta que lo contenga, sin que cambie su perfil permanente

  @biblioteca @verificado-manual-2026-08-03
  Escenario: Crear una receta propia
    Dado que Laura está en la Biblioteca
    Cuando completa el formulario "Crear propia" con nombre, ingredientes y pasos, y confirma
    Entonces su receta aparece en la sección "Tus recetas", distinguible del catálogo

  @biblioteca @edge-case @verificado-manual-2026-08-06
  Escenario: Un nombre de receta propia extremadamente largo no rompe el layout de la grilla
    Dado que Laura pega un nombre de ~1000 caracteres en el formulario "Crear propia"
    Cuando guarda la receta
    Entonces la tarjeta se trunca visualmente, sin desalinear el resto de la grilla "Tus recetas"
    # FRESCO-107 (MAJOR, sin fix todavía): sin `maxLength` en el input
    # (create-recipe-form.tsx), sin tope en la constraint de DB, sin
    # truncate/line-clamp en personal-recipe-card.tsx — la tarjeta crece a
    # ~30 líneas y desalinea toda la grilla.

  @biblioteca @verificado-manual-2026-08-03
  Escenario: Campos obligatorios al crear una receta propia
    Dado que Laura abre el formulario de "Crear propia" sin completar el nombre
    Cuando intenta guardar
    Entonces ve un mensaje claro pidiéndole completar el nombre antes de guardar

  @biblioteca @edge-case @verificado-manual-2026-08-06
  Escenario: El botón "Guardar receta" se deshabilita mientras el nombre esté vacío
    Dado que Laura abre "Crear propia" y deja el nombre vacío o solo con espacios
    Cuando mira el botón "Guardar receta"
    Entonces está deshabilitado, no solo mostrando un error tras el click
    # FRESCO-118 (MINOR, sin fix todavía): el botón solo tiene
    # disabled={isSaving} — se mantiene clickeable con nombre vacío. El
    # propio comentario del componente dice que replica
    # components/profile/nombre-form.tsx ("disabled submit while invalid or
    # saving"), pero ese SÍ hace disabled={!isValid || isSaving} — no
    # bloquea nada grave (handleSubmit corta con if (!isValid) return), pero
    # el usuario no recibe la señal visual esperada.

  @biblioteca @pendiente
  Escenario: Receta propia no participa en la generación de menú
    Dado que Laura tiene una receta propia guardada
    Cuando genera un menú semanal nuevo
    Entonces esa receta propia nunca aparece en el menú generado por la IA
    # No verificado con un ciclo de generación real -- garantía estructural
    # confirmada por code review (get_filtered_recipes()/generate-meal-plan
    # nunca referencian recetas_propias), no por prueba en vivo.

  @biblioteca @verificado-manual-2026-08-03
  Escenario: Ver detalle de una receta del catálogo
    Dado que Laura está en la Biblioteca
    Cuando abre una receta del catálogo
    Entonces ve su nombre, ingredientes, pasos, tiempo, dificultad y tags de dieta/alérgeno/cocina

  @biblioteca @edge-case @verificado-manual-2026-08-06
  Escenario: El texto de dificultad y coste estimado se muestra humanizado, no en snake_case crudo
    Dado que Laura ve una receta cuya dificultad es "muy_facil" o cuyo coste es "muy_bajo"
    Cuando mira la tarjeta o el detalle de esa receta
    Entonces ve un texto humanizado ("muy fácil"), no el valor crudo del enum con guion bajo
    # FRESCO-117 (MINOR, sin fix todavía): recipe-card.tsx y
    # recipe-detail.tsx muestran `dificultad`/`coste_estimado` tal cual
    # (CosteEstimado/DificultadReceta de api/schemas/recipe.types.ts), sin
    # un mapa de labels como el que ya existe para dieta (DIETA_LABELS).
    # También falta un espacio en el separador del meta de la tarjeta:
    # "30 min ·alto" en vez de "30 min · alto" (falta un {' '} explícito en
    # recipe-card.tsx, presente correctamente en recipe-detail.tsx).

  @biblioteca @edge-case @verificado-manual-2026-08-06
  Escenario: Se puede marcar/desmarcar favorito desde el detalle de una receta del catálogo
    Dado que Laura abre el detalle de una receta de catálogo
    Cuando busca el control de favorito en esa pantalla
    Entonces puede alternar el favorito ahí mismo, sin volver a la Biblioteca o Favoritos
    # FRESCO-108 (MAJOR, sin fix todavía): components/recipes/recipe-detail.tsx
    # (CatalogRecipeDetail) no renderiza ningún botón de favorito — el único
    # control funcional vive en RecipeCard/FavoriteRecipeCard. El comentario
    # "OOS" del componente lista edit/delete/rate/menu-add/share como fuera
    # de alcance, pero no menciona favorito — parece un gap, no una
    # exclusión intencional.

  @biblioteca @edge-case @verificado-manual-2026-08-06
  Escenario: El filtro de tipo de comida soporta navegación por flechas de teclado (patrón radiogroup)
    Dado que Laura tabula hasta el grupo "Filtrar por tipo de comida" en la Biblioteca
    Cuando usa las flechas izquierda/derecha
    Entonces la selección se mueve entre las opciones, con Tab deteniéndose solo en la opción activa
    # FRESCO-119 (MINOR, sin fix todavía): components/ui/segmented-control.tsx
    # — cada opción es un <button role="radio"> nativo sin gestión de
    # tabIndex ni manejador de flechas. Funciona igual con Tab + Enter/Espacio
    # (no bloquea el flujo), pero se desvía del patrón ARIA APG esperado
    # para un radiogroup.

  @biblioteca @verificado-manual-2026-08-03
  Escenario: Ver detalle de una receta propia
    Dado que Laura tiene una receta propia en su Biblioteca
    Cuando la abre
    Entonces ve su nombre, ingredientes y pasos, distinguible como receta propia

  @biblioteca @verificado-manual-2026-08-03
  Escenario: Volver a la Biblioteca desde el detalle
    Dado que Laura está viendo el detalle de una receta
    Cuando elige volver
    Entonces regresa a la Biblioteca

  # ==========================================================================
  # Perfil
  # ==========================================================================

  @perfil @edge-case @verificado-manual-2026-08-06
  Escenario: El input "Tu nombre" no muestra borde de error en el primer render
    Dado que Laura entra a /profile con una cuenta que todavía no tiene nombre guardado
    Cuando la página carga por primera vez, sin que ella haya tocado el campo
    Entonces el input "Tu nombre" se ve neutral, sin borde de error
    # FRESCO-113 (MINOR, sin fix todavía): components/profile/nombre-form.tsx
    # — el mensaje de validación SÍ respeta el gate de `touched` (silencioso
    # al primer paint, según su propio comentario de intención), pero la
    # clase CSS del input (`!isValid ? 'border-error' : ''`) ignora ese
    # mismo gate — el borde rojo aparece de entrada, sin ningún mensaje que
    # lo explique. Cosmético, no bloquea el guardado.

  @perfil @verificado-manual-2026-08-04
  Escenario: Editar preferencias de dieta y alérgenos desde el perfil
    Dado que Laura está en /profile
    Cuando activa un chip de dieta y confirma "Actualizar Preferencias"
    Entonces la preferencia queda guardada y sigue activa tras recargar la página

  @perfil @verificado-manual-2026-08-04
  Escenario: Descargar un backup de los propios datos en JSON
    Dado que Laura está en /profile
    Cuando pulsa "Descargar" en Backup JSON
    Entonces recibe un fichero con su perfil, menús, listas de la compra y recetas propias reales

  @perfil @verificado-manual-2026-08-04
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

  @perfil @pendiente
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
