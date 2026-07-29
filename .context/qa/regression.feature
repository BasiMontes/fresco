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

  @login @verificado-manual-2026-07-29
  Escenario: Inicio de sesión correcto con credenciales válidas
    Dado que existe un usuario registrado con email y contraseña válidos
    Cuando introduce esas credenciales en /login y confirma el formulario
    Entonces el sistema le redirige a /menu
    Y la sesión queda activa

  @login @edge-case @pendiente
  Escenario: Inicio de sesión falla con credenciales incorrectas
    Dado que un usuario introduce un email o contraseña incorrectos
    Cuando confirma el formulario de /login
    Entonces ve un mensaje de error claro
    Y permanece en /login sin sesión activa

  @registro @verificado-manual-2026-07-29
  Escenario: Alta de nuevo usuario desde /signup
    Dado que un visitante sin cuenta rellena email y contraseña en /signup
    Cuando confirma el formulario
    Entonces se crea la cuenta en Supabase Auth
    Y el sistema le redirige a /onboarding

  @registro @edge-case @pendiente
  Escenario: Alta falla porque el email ya está registrado
    Dado que un visitante intenta darse de alta con un email ya existente
    Cuando confirma el formulario de /signup
    Entonces ve el mensaje de error que devuelve Supabase Auth
    Y no se crea una cuenta duplicada

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
    Dado que las restricciones del usuario dejan un catálogo con recetas insuficientes
      para desayuno o cena
    Cuando se genera el menú
    Entonces la IA rellena esos huecos con recetas de tipo "comida" como sustituto
    Y el sistema muestra un aviso explícito ("Antes de continuar…") explicando
      qué se sustituyó y por qué

  @generacion-menu @edge-case @pendiente
  Escenario: La generación falla porque la IA no devuelve un menú válido tras los reintentos
    Dado que el modelo no logra producir un JSON válido o completo tras 3 intentos
    Cuando se agotan los reintentos
    Entonces el sistema responde 422 con un mensaje claro de que no pudo generar
      un menú válido
    Y el frontend distingue este caso del error genérico de IA (502)

  @generacion-menu @edge-case @pendiente
  Escenario: Ya existe un plan para la semana solicitada
    Dado que el usuario ya generó un menú para la semana actual
    Cuando intenta generar de nuevo sin eliminar el plan existente
    Entonces el sistema responde 409 y no crea un plan duplicado

  @generacion-menu @edge-case @pendiente
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

  @calendario @edge-case @pendiente
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

  @calendario @edge-case @pendiente
  Escenario: Dos arrastres simultáneos sobre huecos que se solapan
    Dado que un primer intercambio todavía no ha terminado de guardarse
    Cuando el usuario arrastra de nuevo uno de esos dos huecos
    Entonces el segundo arrastre se bloquea hasta que el primero resuelve
    # Cubierto por lógica (pendingSlots) desde FRESCO-11 Stage 2; sin
    # verificación manual explícita del bloqueo visual todavía.

  # ==========================================================================
  # Lista de la compra (EPIC-FRESCO-12 / STORY-FRESCO-13) — SIN IMPLEMENTAR
  # ==========================================================================

  @lista-compra @no-implementado
  Escenario: Generar la lista de la compra a partir de un menú
    Dado que el usuario tiene un menú semanal generado
    Cuando solicita generar la lista de la compra
    Entonces el sistema debería consolidar ingredientes y clasificarlos por pasillo
    # Estado real a 2026-07-29: NO implementado. /shopping-list es 100% mock
    # (MOCK_SHOPPING_LIST hardcodeado en el propio archivo) y
    # generate-shopping-list/prompt.ts lanza Error a propósito (TODO).

  @lista-compra @no-implementado
  Escenario: Marcar un producto de la lista como comprado
    Dado que el usuario tiene una lista de la compra generada
    Cuando marca un producto como comprado
    Entonces el estado debería persistir vía RPC security definer
    # Estado real: el toggle actual en /shopping-list es solo estado local de
    # React (useState), no llama a ningún RPC todavía.

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
