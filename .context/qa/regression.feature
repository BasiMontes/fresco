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

  @generacion-menu @edge-case @pendiente
  Escenario: La generación falla porque la IA no devuelve un menú válido tras los reintentos
    Dado que el modelo no logra producir un JSON válido o completo tras 3 intentos
    Cuando se agotan los reintentos
    Entonces el sistema responde 422 con un mensaje claro de que no pudo generar un menú válido
    Y el frontend distingue este caso del error genérico de IA (502)
    # No forzable en vivo de forma determinística — depende de que Gemini
    # falle estructuralmente 3 veces seguidas, y no hay seam para mockear
    # esa llamada server-to-server desde fuera. Verificado solo por código
    # (index.ts:196-209, distinto del 502 de fallo de Gemini; onboarding/
    # page.tsx ya distingue 422 con mensaje amigable), no en vivo.

  @generacion-menu @edge-case @verificado-manual-2026-07-31
  Escenario: Ya existe un plan para la semana solicitada
    Dado que el usuario ya generó un menú para la semana actual
    Cuando intenta generar de nuevo sin eliminar el plan existente
    Entonces el sistema responde 409 y no crea un plan duplicado

  @generacion-menu @edge-case @verificado-manual-2026-07-31
  Escenario: El perfil de usuario no existe todavía
    Dado que un usuario autenticado nunca completó el onboarding
    Cuando se intenta generar un menú para él
    Entonces el sistema responde 404 "Perfil de usuario no encontrado"

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
