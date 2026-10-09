# Bitácora — Fresco

Log append-only. Cada iteración relevante suma entrada abajo: qué hecho, por qué, qué sigue. IA lee esto primero para contexto rápido en sesión nueva — no re-derivar todo desde cero. Nunca reescribir entrada vieja, solo agregar.

Formato entrada: fecha — título corto. Qué / Por qué / Siguiente.

**Cuándo escribir** (Regla 15, `CLAUDE.md`): SOLO al cerrar una historia de Jira, resolver un bug crítico, o hacer un deploy. NUNCA por trabajo trivial, cambios de texto o sesiones exploratorias.

**Rotación**: al superar 50 entradas, archivar (`mv` a `bitacora-<rango>.md`) y arrancar este archivo de nuevo con el header + las últimas ~15 entradas.

Historia archivada:
- `.context/bitacora-2026-07-to-2026-08.md` — 383 entradas, 2026-07-25 → 2026-08-27.
- `.context/bitacora-2026-08-to-09.md` — 85 entradas, 2026-08-27 → 2026-09-02.
- `.context/bitacora-2026-09.md` — 66 entradas, 2026-09-01 → 2026-09-10.
- `.context/bitacora-2026-09-to-10.md` — 137 entradas, 2026-09-05 → 2026-10-08.

---

## 2026-10-06 - FRESCO-806 onboarding con perfil guardado
- Qué: `/onboarding` rellena el asistente con el perfil guardado (hidratación en la puerta de sesión; lo escrito gana; si no se puede leer, pantalla de reintento en vez de asistente vacío); "Empezar" ya no pisa dieta, alérgenos ni nombre. PR #525 nivelada, 806 en Control de calidad, seguimiento FRESCO-856.
- Por qué: audit-6 A6-L5; el defecto era peor que "moderada": `handleGenerate` hacía upsert del estado por defecto sobre el perfil real, borrando alérgenos.
- Siguiente: la casilla de consentimiento de datos de salud no se precarga (FRESCO-856); no verificado en alojados por Turnstile; los usuarios factory del e2e tienen fila de perfil, por eso se precarga y no se redirige.

## 2026-10-06 - FRESCO-809 troceo del código de producto
- Qué: SlotCell, signup, OnboardingPage, MenuPage, ProfilePage, ShoppingListView, esProductoCompatible y user-profile.ts partidos en 5 PRs (#526-#530); un solo `createMockClient` en `lib/fixtures`; ESLint exige ya `complexity` 25 y `max-lines` 450 como error en `app/`, `components/` y `lib/`. 809 en Finalizada.
- Por qué: audit-6 A6-A5/A6-A6; cierre por la métrica (0 funciones de producto >25, 0 ficheros de producto >450, 1 `createMockClient`), evidencia en el comentario de Jira.
- Siguiente: las funciones entre 16 y 25 ya no avisan en el editor (el `warn 15` se sustituyó por `error 25`); `cli/` y `scripts/` quedan fuera del gate; dos fallos de infraestructura del runner e2e (puerto 54322) en #528 y #530, pasaron al relanzar.

## 2026-10-07 - FRESCO-810 cerrada: capas bloqueadas por lint
- Qué: PR 4 (#537, ea5dbd1e) migra login/forgot-password/update-password/posthog-provider a lib/client-api, añade candados ESLint en app/** y hooks en lib/**, y borra COMPONENTS_WITH_DIRECT_SUPABASE_ACCESS. Medición final en 0 (rutas inline, componentes, excepciones, hooks en lib, lib→UI, importadores en app).
- Por qué: sacar el acceso a Supabase de UI y rutas y que no vuelva (audit-6, ADR-0041); posthog-provider sigue lazy por FRESCO-505.
- Siguiente: test de ruta de punta a punta del webhook de Stripe; FRESCO-857 (boilerplate) y FRESCO-858 (ramas).

## 2026-10-07 - FRESCO-815 cerrada: higiene del backlog (A6-P12)
- Qué: 124 cerrada por evidencia (CHECK en prod, 0 nombres vacíos), 183 reabierta a Listo (defecto real sin motivo de rechazo), 31 rechazada con motivo (54 % mismatch Unsplash), 712 se mantiene WAD enlazada a 805. WIP sin actualizar >7d = 0; bugs reales en Rechazos = 0.
- Por qué: audit-6 A6-P12, Rechazos usado como aparcamiento; cierre por la métrica (definition-of-done).
- Siguiente: 65 tickets abiertos sin story points; 169 historias sin epic (todas cerradas, solo línea base); FRESCO-435 sigue en Rechazos aunque el pipeline de fotos se replantea ahí.

## 2026-10-07 - FRESCO-816 cerrada: higiene BAJO de seguridad (audit-6)
- Qué: S8 (comparación constante), S9 (REVOKE TRUNCATE/TRIGGER/REFERENCES/MAINTAIN + EXECUTE en funciones trigger), S10 (payment_status + estado de suscripción + idempotencia por event.id en stripe_webhook_events), S11 aceptado con nota, S13 (iat <5 min en reassign-guest-data), S14 (tope get_catalog 1000, pg_temp en 18 DEFINER, JsonLd escapa <). PRs #538, #539, #540, todo en prod.
- Por qué: audit-6 eje seguridad; cierre por evidencia en producción (has_table_privilege, ledger de migraciones).
- Siguiente: re-suscripción sin trial parece no conceder Pro (resolveProUpdateFromSession exige trial_end, deducido del código, sin reproducir); quedan 817-821, 837, 844 en la épica 775.

## 2026-10-07 - FRESCO-817 higiene de hallazgos BAJO de audit-6
- Qué: borrados los steps muertos de FRESCO-89 (0 test.skip(true)), esperas fijas sustituidas por condiciones, issue automático al fallar stripe-e2e y post-deploy-smoke (PR #541, nivelado dev/staging/main).
- Por qué: cerrar A6-T12/T13; los escenarios eran @solo-manual y su código solo cargaba skips. Ojo: un step borrado era compartido con un escenario @automatizado, bddgen lo caza.
- Siguiente: vigilar el primer fallo real de los workflows para confirmar que el issue se abre; el resto de BAJOS de audit-6 sigue en sus tickets.

## 2026-10-07 - FRESCO-818 higiene de hallazgos BAJO de audit-6 (DevOps)
- Qué: cierre sin código; D9/D10/D11/D13/D14 ya resueltos o por diseño, borrada la rama huérfana test/FRESCO-464-get-recent-recipe-ids-spoof (su test apuntaba a una RPC eliminada).
- Por qué: el criterio literal 'ramas remotas = 3' choca con los PRs abiertos de Dependabot; se reinterpretó como 'sin ramas remotas huérfanas' (0 hoy).
- Siguiente: decidir qué hacer con los PRs de Dependabot #451/#495/#507 (mergear o cerrar) como trabajo aparte.

## 2026-10-07 - FRESCO-819 higiene BAJO de audit-6 (App)
- Qué: PR #543 (cantidades y precios en es-ES, precio 0 oculto) y PR #544 (zonas táctiles de 44 px en /shopping-list y /profile a 360 px, 58 y 46 infractores a 0, escenarios @mobile @a11y en CI). Cookie L11 sin cambio: ADR-0035 + HSTS.
- Por qué: cerrar A6-L8/L10/L11; la rejilla de planificación no cabe a 44 px sin rediseño (allowlist con ticket).
- Siguiente: FRESCO-861/862/863/864 (derivados). test:e2e en 6m11s, cerca del aviso de ADR-0018 (~6m30).

## 2026-10-07 - FRESCO-820 jsonb validado con zod y scripts/cli vendored
- Qué: toRecipe y shopping_lists.items validan jsonb con zod en la frontera; 0 `as unknown as` en lib/api; scripts/ y cli/ marcados linguist-vendored. PR #545, 7c2a80af en dev/staging/main.
- Por qué: audit-6 A6-A11/A6-A15. Un enum estricto de clasificacion habria ocultado 531 de 1173 recetas (19 categorias y 9 cocinas reales fuera de los tipos), asi que categoria/cocina pasan a string.
- Siguiente: ticket Finalizada con evidencia. Receta con jsonb invalido se descarta y se loguea [recipes]; vigilar ese log.

## 2026-10-07 - FRESCO-859 re-suscripcion sin trial concede Pro
- Qué: resolveProUpdateFromSession usa trial_end si la suscripcion esta trialing y current_period_end del item si esta active. PR #546, b32c1dbc en dev/staging/main. Probado con Stripe real en modo test (trialing y re-suscripcion active sin trial).
- Por qué: una re-suscripcion no tiene trial_end, el resolver lanzaba, el webhook respondia 200 y el cliente pagaba sin Pro (audit-6, hallazgo colateral de FRESCO-816).
- Siguiente: el webhook sigue respondiendo 200 ante errores de proceso por diseño (sin reintento de Stripe); vigilar el log [/api/stripe/webhook] failed to process event.

## 2026-10-08 - FRESCO-823 simulacro de restauración
- Qué: workflow manual db-restore-drill restaura el último backup de R2 en un proyecto Supabase temporal; RTO de datos medido en 76 s (1173 recetas = prod); ADR-0020 actualizado.
- Por qué: el RTO del ADR era una estimación sin medir.
- Siguiente: FRESCO-873 (backup del 4-oct falló sin avisar) y FRESCO-874 (cronometrar pasos manuales).

## 2026-10-08 - FRESCO-873 backup semanal robusto
- Qué: sonda de Postgres listo por TCP en db-backup (fallo del 4-oct) y issue automática si un backup falla; backup manual en verde con copia nueva en R2.
- Por qué: el backup programado falló en silencio y la copia más nueva tenía 6 días.
- Siguiente: la ruta de aviso por fallo no se ha ejercitado aún; FRESCO-874 sigue pendiente.

## 2026-10-08 - FRESCO-860 test intermitente del diálogo de borrar cuenta
- Qué: el push('/calendar') diferido de ReuseMenuButton (1,2 s, sin cancelar) caía dentro del test del diálogo; ahora se cancela al desmontar.
- Por qué: el fallo intermitente del pre-push bloqueaba promociones y empujaba a --no-verify.
- Siguiente: sin test unitario nuevo (mock global filtraría); vigilar si reaparece algún push perdido en la suite.

## 2026-10-08 - FRESCO-856 aviso de consentimiento de salud ya dado
- Qué: el paso de dieta anuncia con fecha un consentimiento health_data ya registrado para los textos vigentes, sin casilla premarcada y con 'Volver a decidir'. Mergeado a staging (PR #560), NO a main.
- Por qué: tras FRESCO-806 quien volvía con alérgenos guardados tenía que marcar la casilla otra vez; una casilla premarcada no es consentimiento válido y el registro aún no tiene retirada (ADR-0040).
- Siguiente: el abogado debe confirmar que un consentimiento ya dado vale en un paso nuevo; hasta entonces no nivelar main (un git:promote lo arrastraría). Luego cerrar FRESCO-856.

## 2026-10-08 - FRESCO-842 lista de la compra: qué hacer cuando ya no quedan pendientes
- Qué: con 0 artículos, /shopping-list muestra "Has comprado todo lo de esta semana." y enlaces a menú, recetas y calendario (PR #562). Build spec-only, divergencia §5-X; validado en vivo a 1440 y 360 px. En dev, staging y main.
- Por qué: tras "Compra realizada" quedaba solo la tarjeta Resumen y el resto vacío; el mockup de Claude Design nunca se devolvió y el fundador eligió la ruta (b).
- Siguiente: si llega el mockup de `spend-trend-and-shopping-done`, ajustar en historia aparte; el estado "sin lista" y el tema oscuro no se probaron en vivo.

## 2026-10-08 - FRESCO-856 revertido en staging y main
- Qué: PR #565 revierte el aviso de consentimiento de salud ya dado (#560). Había llegado a main por error en la promoción de FRESCO-842, que arrastró el commit; ya no está activo en producción.
- Por qué: la bitácora pedía no nivelar main hasta que el abogado confirme que un consentimiento ya dado vale en un paso nuevo; hasta entonces se vuelve a pedir la casilla.
- Siguiente: si el abogado confirma, revertir el revert (b5343ca4) para reaplicar FRESCO-856. Antes de cada git:promote, mirar git log main..staging por si arrastra algo retenido.
## 2026-10-08 - FRESCO-863 cantidades de ingredientes en la ficha de receta
- Qué: columna recipes.ingredientes_cantidades (ADR-0042, Proposed), migración de datos con las 601 recetas activas (estimación IA validada por script) y la ficha muestra cantidad y unidad (PR #567, #568, #569, main en 8ed8f99b).
- Por qué: audit-6 A6-L8, la ficha listaba ingredientes sin cantidades; cierre medido en producción: 0 de 601 activas sin cantidades.
- Siguiente: aceptar ADR-0042; mover la lista de la compra de BASE_QUANTITIES a la columna nueva (ticket aparte); recetas del catálogo con ingredientes que no cuadran con el nombre (bizcocho con pan integral, sopa de ajo sin pan ni caldo).

## 2026-10-09 - FRESCO-855 cerrada: error con reintento si falla la lectura del catalogo
- Qué: /recipes ya no convierte un fallo de lectura en "no hay recetas"; muestra error con reintento y el paso e2e de Biblioteca vuelca el estado de la página si falla (PR #572, 13455a22, en dev/staging/main).
- Por qué: flaky e2e recipe_library_grid no aparecía en 5 s; causa raíz no demostrada, fix es de diagnóstico.
- Siguiente: si el flaky reaparece, leer el estado volcado en el log de CI antes de tocar nada más.

## 2026-10-09 - FRESCO-790 cerrada: riesgo de Consum aceptado con revisión fechada
- Qué: ADR-0037 con decisión del fundador de mantener `riesgo-aceptado`, revisión el 2026-11-06 y dictamen de abogado obligatorio antes del lanzamiento público (PR #575). Capturas de la cláusula en /legal/terminos y /shopping-list adjuntas en Jira.
- Por qué: criterio de cierre admite decisión documentada con fecha en vez de dictamen; Consum sin respuesta desde 2026-09-29.
- Siguiente: revisar el 2026-11-06 o antes si Consum contesta (FRESCO-764); FRESCO-772 sigue bloqueada.

## 2026-10-09 - FRESCO-875 cerrada: la lista de la compra usa las cantidades de cada receta
- Qué: generate-shopping-list lee recipes.ingredientes_cantidades, escala por personas y suma por ingrediente; BASE_QUANTITIES solo como respaldo (PR #576, 8a34a901, desplegada en Supabase).
- Por qué: seguimiento de FRESCO-863/ADR-0042; la tabla fija daba la misma cantidad para cualquier receta.
- Siguiente: promover a main cuando quieras; el coste de líneas con unidad no convertible usa el precio genérico por tipo de unidad.

## 2026-10-09 - FRESCO-878 entregada: añadir una receta al menú desde la Biblioteca
- Qué: función assign_recipe_to_slot (INVOKER, sin parámetro de identidad), icono de calendario y modal en /recipes, dos escenarios e2e (PR #577, #578, #579). Migración ya aplicada en producción.
- Por qué: no había forma de poner una receta del catálogo en un hueco; recipe_id ya no se escribe desde el cliente.
- Siguiente: probarlo en fresco-pro con un usuario real y pasar a Finalizada; promover #579 a main.

## 2026-10-09 - FRESCO-876 cerrada: cuatro listas de ingredientes corregidas y restricción anti-duplicados
- Qué: panqueques, croissant, bacalao a la vizcaína y tempeh corregidos con respaldo en su descripción; restricción recipes_ingredientes_principales_distinct en producción; consulta de revisión en scripts/queries/ (PR #581).
- Por qué: el barrido de 601 recetas dejó casos sin evidencia en los datos (sopa de ajo, César, bizcocho, arepa, rollitos, ~50 nombres con ingrediente ausente) que son decisión de producto.
- Siguiente: FRESCO-880 decide renombrar, reescribir o desactivar esas recetas.

## 2026-10-09 - FRESCO-861 cerrada: títulos sin "con" repetido y categorías dentro del contrato
- Qué: 122 nombres y 246 descripciones corregidos; CategoriaReceta pasa de 12 a 18; bowl a bowls, vegetal a verdura, 26 desayunos de ensalada a bowls/batidos/lacteos; restricciones recipes_nombre_sin_con_repetido y recipes_categoria_en_contrato (PR #582). Consulta de verificación: 0 filas en producción.
- Por qué: datos del catálogo que se veían mal en la app (audit-6 A6-L9).
- Siguiente: FRESCO-881 decide las combinaciones categoría y tipo de plato que no encajan; FRESCO-880 las recetas con ingredientes incoherentes.

## 2026-10-09 - FRESCO-880 catalogo: recetas cuyo nombre o descripcion no cuadran con sus ingredientes
- Qué: 7 PR (#583 a #589) en 4 familias: sésamo/perejil/comino con alérgeno, 42 títulos con condimento (13 renombradas, 29 copias desactivadas), consulta de revisión sin falsos positivos, 25 recetas con ingrediente añadido, sopas/césares/rollitos/bizcocho/arepa/gachas corregidos. Producción: nombre 80 a 0, descripcion 78 a 6 con nota.
- Por qué: el barrido de FRESCO-876 dejó casos que eran decisión de producto; el filtro de seguridad alimentaria lee dieta y alergenos.
- Siguiente: FRESCO-837 se cierra el 2026-10-10 si sigue 0 commits example.com. Cada PR de datos lleva también seed.sql (CI crea la base con migraciones y luego el seed).

## 2026-10-09 - FRESCO-862 cerrada: un solo Cerrar sesión en /profile de escritorio
- Qué: la fila de salir de la tarjeta Cuenta se oculta desde md (la barra lateral ya la ofrece) y se mantiene en móvil, donde es la única salida; ratificado en §5-Y del plan de diseño. Test de componente y dos escenarios e2e (móvil y escritorio). PR #591.
- Por qué: audit-6 A6-L9, dos Cerrar sesión iguales en la misma pantalla; quitarlo en todas partes habría dejado a móvil sin logout.
- Siguiente: FRESCO-882 (la fila de /profile no pasa por guest-logout-dialog) y FRESCO-864 (rejilla Comidas a planificar a 44 px).

## 2026-10-09 - FRESCO-882 cerrada: aviso de invitada al cerrar sesión desde /profile
- Qué: AccountActions recibe isAnonymous y abre el mismo GuestLogoutDialog que la barra lateral antes de salir; una cuenta registrada sale directa. Test de componente (invitada, registrada, confirmación) y escenario @solo-manual por el coste de generar un menú real en e2e (ADR-0018).
- Por qué: desde FRESCO-862 el botón de /profile solo se ve en móvil, y ahí una invitada perdía su menú sin aviso.
- Siguiente: FRESCO-864 (rejilla Comidas a planificar a 44 px) y FRESCO-837 (cierra el 2026-10-10).
