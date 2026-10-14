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

## 2026-10-09 - FRESCO-858 cerrada: ramas, worktrees y stash limpios
- Qué: de 24 ramas locales a 3 (dev, staging, main, las tres en 93eab22c), 1 solo worktree y 0 stash. Las ramas con commits propios o PR cerrada se comprobaron una a una contra main y la decisión quedó en el comentario del ticket.
- Por qué: el remoto estaba limpio pero lo acumulado vivía en local, con trabajo posiblemente sin subir.
- Siguiente: FRESCO-837 (cierra el 2026-10-10), FRESCO-864 y FRESCO-881. Las 3 ramas de Dependabot (#451, #495, #507) son decisión de dependencias.

## 2026-10-11 - FRESCO-837 cerrado: identidad de prueba fuera de main
- Qué: FRESCO-837 a Finalizada. Origen corregido en PR #472 (los tests del updater ya no escriben la identidad de prueba en .git/config); 0 commits con esa identidad como autor en origin/main y ramas remotas desde 2026-10-03 (ventana de 7 días cerrada el 10-10).
- Por qué: criterio 3 del ticket (7 días limpios) cumplido; comentario de cierre con PR y prueba (gotcha 21). FRESCO-776/828/792 comprobados: ya Finalizada.
- Siguiente: ninguno.

## 2026-10-11 - FRESCO-881 cerrado: categoría y tipo de plato encajan en cinco familias
- Qué: 69 recetas corregidas con la migración 20261011130000 (PR #594): verduras salteadas a cena, ensaladas a comida, tofu y tempeh a legumbres, masas dulces a reposteria, poke bowls a bowls, y tostadas y wraps fuera de sandwich. Comprobado en producción tras aplicar la migración. Se añadió el test tests/db/recipe-category-dish-type.test.ts y la consulta scripts/queries/catalog-category-dish-type-fit.sql.
- Por qué: FRESCO-861 dejó todas las categorías dentro del contrato, pero no que encajaran con el tipo de plato; cada familia la decidió el dueño de producto.
- Siguiente: FRESCO-847 (mapa de API, PR #595) en revisión; FRESCO-864 sigue en Control de calidad a la espera de ver a 360 px el onboarding.

## 2026-10-11 - FRESCO-847, FRESCO-848 y FRESCO-821 cerrados: documentación al día con el producto
- Qué: el mapa de API de negocio recoge la capa de supermercado, los consentimientos y el resumen de Pro (PR #595); los user-journeys describen el producto actual con tres recorridos nuevos (PR #596); el PRD anota la excepción del onboarding de 4 pasos y los 14 borradores [DRAFT] salieron de Listo a Blocked (PR #597). FRESCO-883 recoge el seguimiento del NIF y el Gmail.
- Por qué: la auditoría 6 (A6-P11, P13 a P15) señaló documentación de julio y un Listo que mezclaba ideas aparcadas con trabajo real.
- Siguiente: FRESCO-864 sigue en Control de calidad a la espera de ver a 360 px el onboarding y /profile. Quedan en Listo FRESCO-877, 843, 853, 857, 874, 717 y 753.

## 2026-10-11 - FRESCO-877 cerrado: Fresco frente a la checklist de lanzamiento
- Qué: informe .context/audits/2026-10-11-launch-checklist.md (PR #598) con los 66 puntos de la checklist clasificados: de los 35 que aplican antes del lanzamiento cumplimos 16, 9 a medias y 10 faltan. Se creó el epic FRESCO-884 (Preparación del lanzamiento público) con 9 cards: FRESCO-885 a 893.
- Por qué: saber cuánto falta para un lanzamiento público y convertir los huecos en trabajo con dueño. Los huecos grandes son el plan de lanzamiento (FRESCO-885) y el dominio propio (FRESCO-886), ambos empiezan por una decisión del fundador.
- Siguiente: FRESCO-864 sigue en Control de calidad a la espera de ver a 360 px el onboarding y /profile. Quedan en Listo FRESCO-843, 853, 857, 874, 717 y 753, más las 9 cards del epic FRESCO-884.

## 2026-10-11 - Epic de lanzamiento: FRESCO-885, 892, 893 y 894 cerrados
- Qué: FRESCO-885 fija el lanzamiento público el martes 1 de diciembre de 2026, sin Product Hunt y con canales en español (Instagram, TikTok y comunidades de recetas); plan en .context/launch-plan.md (PR #601). FRESCO-892 midió Core Web Vitals en producción (LCP y CLS bien; TBT alto en /login y /signup, card FRESCO-895). FRESCO-893 añade favicon.ico (PR #599) y FRESCO-894 da título propio al 404 (PR #600), los dos comprobados en producción.
- Por qué: cerrar huecos de la checklist de lanzamiento (FRESCO-877) y dar fecha y orden al resto del epic FRESCO-884.
- Siguiente: FRESCO-886 (dominio propio) en WIP, a la espera de elegir nombre; el abogado (textos legales y opinión sobre Consum) es el camino crítico y aún no tiene responsable. Quedan FRESCO-887 a 891 y 895, más FRESCO-864 en Control de calidad.

## 2026-10-11 - FRESCO-888 y FRESCO-891: lista de espera y FAQ ampliado en produccion
- Qué: formulario de lista de espera (solo correo, consentimiento explicito, tabla waitlist_signups con RLS insert-only) bajo el CTA final, y cuatro preguntas nuevas en el FAQ (precio, datos, comparativa, limites). PRs #603 y #604, main en 94f6a6ab.
- Por qué: sin lista de espera el dia uno dependia de desconocidos; el FAQ debia contestar de antemano las preguntas publicas (checklist de lanzamiento FRESCO-877).
- Siguiente: FRESCO-889 (capturas y kit de textos); enviar el aviso de lanzamiento queda bloqueado por el dominio propio (FRESCO-886). Abrir los PRs contra staging, no dev.

## 2026-10-11 - FRESCO-889: kit de lanzamiento (capturas y textos)
- Qué: tres capturas de la app real, descripcion corta y larga y primer comentario del autor, en docs/brand/launch-kit/ y enlazados desde el manual de marca. PR #605, main en 87367138.
- Por qué: las fichas de directorios y las publicaciones de lanzamiento necesitan material reutilizable escrito una vez (checklist FRESCO-877).
- Siguiente: repetir las capturas de lista de la compra y aprendizaje de Pro con cuentas adecuadas; ticketar la calidad de las recetas de ejemplo. Login con Turnstile: el humano entra en la ventana de playwright-cli.

## 2026-10-11 - FRESCO-896: pasos genericos del catalogo sustituidos
- Qué: 83 recetas activas con el guion "Preparar X / Cocinar con ... / Sazonar al gusto / Servir caliente" pasan a tener pasos propios, escritos solo con sus ingredientes mas aceite, sal y agua. PR #606, main en 575d1883; produccion: 570 activas, 0 con el guion. Test de BD que impide que vuelva.
- Por qué: al preparar el kit de lanzamiento (FRESCO-889) se vio que abrir una receta no servia para cocinar; en el lanzamiento es lo primero que ve un visitante.
- Siguiente: lote B descartado (la app solo usa tiempo_total_min). Pendiente sin ticket: nombres "con verduras salteadas" sin esas verduras en los ingredientes y recetas duplicadas con otro nombre. FRESCO-897 (cuentas Pro) espera al fundador.

## 2026-10-11 - FRESCO-898: recetas duplicadas y nombres enganosos del catalogo
- Qué: 30 grupos de recetas con los mismos ingredientes y pasos (62 recetas) se funden en 30; 32 duplicados desactivados, 9 casillas de menu de dos cuentas de pruebas pasadas a la receta conservada, 2 fotos copiadas. Las 23 recetas "con verduras salteadas" sin esas verduras desaparecen. PR #607, main en 7858db69; produccion: 538 activas, 0 duplicados, 0 con el sufijo.
- Por qué: al revisar la muestra de FRESCO-896 se vio que un menu podia sacar el mismo plato dos veces con nombres distintos.
- Siguiente: observacion sin ticket, 29 casillas de menu de semanas pasadas y 3 favoritos apuntan a recetas inactivas de trabajos anteriores. FRESCO-897 (cuentas Pro) espera al fundador.

## 2026-10-12 - FRESCO-942 y FRESCO-943 en staging; migración de recetas aplicada en producción
- Qué: PR #620 (cancelar Stripe y devolver el periodo no disfrutado al borrar la cuenta) y PR #621 (41 recetas con etiquetas de alérgenos y dieta corregidas más test de coherencia) mergeadas a staging. La migración 20261012100000 se aplicó a la base compartida con db push: 47 hallazgos pasan a 0.
- Por qué: auditoría definitiva 2026-10-12, hallazgos C-01 y C-02 (BLOCKER). Todas las auditorías previas leídas y 38 tickets creados con etiqueta auditoria-7.
- Siguiente: cargar STRIPE_SECRET_KEY en Supabase Edge (delete-account ya desplegada, falla en cerrado sin él), probar la devolución con una cuenta de pruebas de Stripe, decidir con criterio legal el caso de los 14 días, y promocionar a main en lote.

## 2026-10-13 - FRESCO-909 webhook claim caducable + barrido de checkouts pagados
- Qué: claim de eventos Stripe caducable (claimed_at/completed_at, 409 en vuelo), grantProFromCheckoutSession extraído (lib/billing/grant-pro.ts) y barrido en el cron de reconciliación de sesiones pagadas 48 h sin Pro (lib/billing/checkout-sweep.ts). PRs #622 #623 #624 #625 en staging, ADR-0015 con addendum.
- Por qué: audit C-03, un evento reclamado cuyo worker moría quedaba como procesado y el cron no podía curarlo (pago perdido).
- Siguiente: promover staging a main; revisar checkoutSweep.granted en logs del cron tras la primera ejecución en producción.

## 2026-10-13 - FRESCO-912 mostaza y altramuces en el vocabulario de alérgenos
- Qué: los 14 alérgenos de la UE se pueden declarar y etiquetar (PR #627 en staging; migración 20261013120000 aplicada en producción con db push, restricciones y get_catalog verificados); aviso de cobertura en onboarding y perfil; mínimo de tests de BD 292 a 298.
- Por qué: auditoría definitiva 2026-10-12, C-08. Hoy 0 de 538 recetas activas llevan mostaza o altramuz, así que declararlos aún no filtra nada; el test de coherencia del catálogo lo vigila.
- Siguiente: ninguna receta cubre esos dos alérgenos todavía; promocionar staging a main en lote; ADR-0043 sigue Proposed (adr:check fallará hacia el 26-27 de octubre).

## 2026-10-13 - FRESCO-910 exportación completa y supresión en PostHog con registro
- Qué: la exportación CSV incluye favoritos, consentimientos, push y correo (PR #628); delete-account borra la persona en PostHog y escribe account_erasures con el id hasheado (PR #629, migración 20261013140000 aplicada con db push; secretos de PostHog en Edge). Verificado en vivo con la cuenta de dev y con Stripe en modo de pruebas.
- Por qué: auditoría definitiva 2026-10-12, C-06 (RGPD, derecho de acceso y de supresión).
- Siguiente: FRESCO-947 reintento de borrados de PostHog fallidos; FRESCO-946 posible fuga del sidebar entre cuentas; recrear la cuenta de dev; el borrado completo con sesión y cliente de Stripe no se ejercitó por el captcha.

## 2026-10-13 - FRESCO-944 login: área de Turnstile reservada y errores en línea
- Qué: /login reserva el área del captcha (65 px) desde el primer render con estado en texto y Reintentar; el botón ya no se deshabilita en silencio, los requisitos que faltan se nombran en línea (PR #631 en staging). Medido en navegador: el botón no se mueve (antes 406 a 413).
- Por qué: auditoría definitiva 2026-10-12, UX-01 y UX-02.
- Siguiente: probar con el widget real en fresco-pre; FRESCO-946 (sidebar con datos de otra cuenta) y FRESCO-948 (sugerencias de la lista de la compra) creados en esta sesión;

## 2026-10-13 - FRESCO-945 cliente de Stripe por sesión de Checkout al borrar la cuenta
- Qué: si el perfil no tiene stripe_customer_id, delete-account busca el cliente en las sesiones de Checkout de las últimas 72 h por client_reference_id y cancela, devuelve la parte proporcional y borra el cliente (PR #632 en staging; delete-account v29). STRIPE_SECRET_KEY (clave de pruebas) cargada como secreto de Edge: no existía.
- Por qué: seguimiento de FRESCO-942/909; quien pagaba y borraba la cuenta antes del webhook seguía cobrándose. Un error de Stripe en la búsqueda impide borrar (502); una clave ausente no, para no bloquear todos los borrados.
- Siguiente: sustituir la clave por la live al pasar a producción; FRESCO-942 sigue en Merged (falta verificar el recorrido completo con sesión y cliente de Stripe, el captcha lo impide); un acierto real de la búsqueda no se ha ejercitado.

## 2026-10-13 - FRESCO-915 latido del cron de reconciliación y monitor de GitHub
- Qué: el cron escribe su latido en job_heartbeat y reporta sus fallos a Sentry (PR #633, migración 20261013150000 aplicada con db push); GET /api/health/jobs y workflow cron-heartbeat-monitor.yml cada hora (PR #634). Umbral 25 h; un job que nunca ha reportado queda en pending.
- Por qué: auditoría definitiva 2026-10-12, C-11; cron.job_run_details marca succeeded aunque la ruta responda 401 o 500 y es la única red de pagos perdidos.
- Siguiente: FRESCO-949, verificar tras promocionar a main el primer latido real, el simulacro del monitor y el caso stale; el criterio de alertar en menos de 26 h no se ejercitó de punta a punta.

## 2026-10-13 - FRESCO-913 plan semanal en una transacción
- Qué: create_meal_plan crea el plan y sus slots en una transacción (SECURITY INVOKER, solo service_role); valida la semana ISO y que fecha_inicio sea su lunes; CHECK sobre semana_iso; generate-meal-plan la llama en lugar de dos inserts con compensación manual (PR #635; migración 20261013160000 aplicada con db push ANTES del merge; generate-meal-plan v49). Borrado el plan huérfano 2026-W99 de pro-user, resto de un test e2e.
- Por qué: auditoría definitiva 2026-10-12, C-09; un corte entre los dos inserts dejaba un plan sin slots que bloqueaba regenerar esa semana con un 409.
- Siguiente: ninguno propio; el e2e de aislamiento sembraba la semana inválida 2026-W99 y ahora usa 2026-W51.

## 2026-10-13 - FRESCO-914 límites de tamaño en user_profiles
- Qué: tres CHECK sobre user_profiles (listas de ingredientes y alérgenos hasta 30 elementos y 2400 bytes, cocinas_favoritas 30, nombre 80 caracteres, textos libres 500, planning_selection objeto JSON de 4096 bytes); mensajes claros al rechazar un guardado y maxLength en los campos (PR #636; migración 20261013170000 aplicada con db push, validada, 0 perfiles incumplen).
- Por qué: auditoría definitiva 2026-10-12, C-10; un invitado podía guardar megabytes y get_filtered_recipes recorre ingredientes_odiados por cada receta.
- Siguiente: el tope de 30 x 60 caracteres de la auditoría se aplicó como total de bytes (como FRESCO-799), no por elemento; si se quiere por elemento hace falta una función auxiliar inmutable.

## 2026-10-13 - Promoción de staging a main (17 commits) y recreación de la cuenta de dev
- Qué: dev, staging y main en b8770ad7 con git:promote (gate pasado, 17 commits, todos con PR; las 7 migraciones del lote ya estaban aplicadas y las Edge Functions desplegadas). Producción responde: /api/health 200 y /api/health/jobs 200 en estado pending. El Post-Deploy Smoke falló 1 de 3 porque la cuenta de dev se había borrado al verificar FRESCO-910; recreada (id nuevo 175e3b94-d14d-4279-b6a6-a4827f6990c6, perfil mínimo) y el smoke relanzado pasa 3 de 3.
- Por qué: acumulado de staging por la regla de promover por lotes; la base ya llevaba migraciones que el código de producción aún no usaba.
- Siguiente: FRESCO-949 (primer latido real del cron a las 04:17 UTC, simulacro del monitor con path /api/health/jobs-drill); FRESCO-942 sigue en Merged (falta el recorrido con sesión y cliente de Stripe); alinear la clave de Stripe de Edge con la de Vercel producción antes de pasar a live; no borrar las cuentas de prueba DEV/PRE/PRO para verificar flujos.

## 2026-10-13 - FRESCO-917 consentimiento Art. 9 exigido en servidor
- Qué: trigger require_health_data_consent en user_profiles (rechaza alergias/dieta sin consentimiento health_data), bloque de consentimiento compartido en /profile, 16 tests de BD. PR #639 en staging (d556249c), ticket en Control de calidad.
- Por qué: auditoría C-13 (RGPD Art. 9), el consentimiento solo se pedía en la UI.
- Siguiente: migración llega a la BD compartida al pasar a main; comprobar en producción que cuentas antiguas pueden consentir y guardar.

## 2026-10-13 - FRESCO-919 eventos de PostHog del servidor respetan el rechazo de cookies
- Qué: columna user_profiles.analytics_consent, captureServerEvent (Next y Edge) envía solo con true, AnalyticsConsentSync copia la decisión del banner al perfil, ADR-0044. PR #640 en staging (c04a61d7), ticket en Control de calidad.
- Por qué: auditoría C-15, los eventos de servidor ignoraban la decisión de cookies del navegador.
- Siguiente: la migración no está en la BD compartida hasta main; los entornos de staging y dev escriben la columna en onboarding y /profile y fallarían sin ella; actualizar textos de privacidad con la abogada.

## 2026-10-13 - Promoción a main: FRESCO-946, 947, 938, 939 (3daafb2b)
- Qué: staging, dev y main avanzados por fast-forward a 3daafb2b (4 PR: #644 router.refresh en login/logout, #645 reintento diario de borrados fallidos de PostHog, #646 etiquetas en español + botón de invitado neutro, #647 pie legal de acceso con enlaces reales). Migración 20261014130000 aplicada y cron retry-posthog-erasures activo (30 4 * * *). Producción: despliegue success, /api/health 200.
- Por qué: lote acumulado en staging; el usuario pidió subir a main al cerrar sesión. El drift check de migraciones estuvo en rojo en staging por la migración 947 aún sin aplicar, esperado y resuelto con el push a main.
- Siguiente: FRESCO-946 y FRESCO-949 siguen abiertos (prueba manual en fresco-pre; /api/health/jobs a ok tras el cron de las 04:17 UTC del 14-10); 947, 938 y 939 en Control de calidad; FRESCO-937 sin empezar; FRESCO-900 espera decisión A/B del fundador.

## 2026-10-14 - Tanda de auditoría 7: 10 tickets en staging, 3 verificaciones cerradas y limpieza de PRs
- Qué: en staging y en Control de calidad: FRESCO-937 (CTA móvil de la landing, #648), 936 (etiquetas visibles y mostrar contraseña, #649), 940 (pulido de UX, #650), 948 (sección de sugerencias añadidas con Quitar, #651 + #653; la migración jsonb_remove_item se aplicó a la BD compartida con db push --linked), 922 (/api/health sin commit y decisiones de superficie pública documentadas, #654), 924 (overrides de source-map-js y katex, Dependabot ignora TypeScript 7, #655 y #617; #495 cerrado), 928 (catálogos de Jira alineados, createmeta como respaldo de opciones, #657), 930 (un intento lento hace fallar el escenario de generación, #656), 929 (caché de impeccable ignorada, config.json se queda versionado, #652) y 900 (charge.refunded cancela la suscripción si el cobro del periodo se reembolsa por completo, #658). Finalizadas por verificación: 949 (cron real en ok), 935 (el monitor de uptime dispara cada 3-9 h, no cada 5 min) y 931 (ya no quedaban ramas fusionadas; borrado automático activo). También fusionados #638 (907), #641 y #614; cerrado #451; 17 ramas locales borradas.
- Por qué: cierre de la lista de Listo etiquetada auditoria-7 y de la deuda de CI y de Jira que arrastraba. Dos hallazgos nuevos con ticket propio: FRESCO-951 (monitor externo gratuito de uptime) y FRESCO-952 (stripe 23, mayor del SDK de pagos).
- Siguiente: promover staging a main en lote. Pendiente del propietario: suscribir el webhook de Stripe a charge.refunded en test y en live (sin eso FRESCO-900 no hace nada, pasos en docs/workflows/stripe-refunds.md) y borrar NEXT_PUBLIC_TURNSTILE_SECRET_KEY de Vercel en preview y production (FRESCO-907, sigue en WIP). Verificar en main que dependency-audit.yml pasa en verde.

## 2026-10-14 - Promoción de staging a main (16 commits, cd758f5e) y pasos del propietario resueltos
- Qué: dev, staging y main en cd758f5e con git:promote (simulacro primero, gate pasado, 16 commits con PR; el push avisó del bypass de administrador que el flujo documentado asume). Verificado en producción: /api/health sin commit ni environment, post-deploy @smoke en success y dependency-audit.yml lanzado sobre main en success (el 12-10 falló); con eso pasaron a Finalizada FRESCO-924 y FRESCO-922. Los dos pasos que eran del propietario ya están: los tres endpoints del webhook de Stripe (dev, pre y pro, todos en modo test) escuchan charge.refunded y NEXT_PUBLIC_TURNSTILE_SECRET_KEY ya no existe en Vercel, con lo que FRESCO-907 pasó a Finalizada.
- Por qué: subir el lote acumulado en staging por la regla de promover por lotes, y dejar FRESCO-900 operativo (sin el evento en el webhook no actuaba).
- Siguiente: no existe aún endpoint de Stripe en modo live: al crearlo hay que incluir charge.refunded (docs/workflows/stripe-refunds.md). FRESCO-900 sigue en Control de calidad hasta probar un reembolso total en modo test. Siguen en Control de calidad, para verificar en producción por una persona: 900, 928, 929, 930, 936, 937, 940, 948 y los del 13-10 (946, 947, 917, 918, 919, 938, 939). Ningún endpoint escucha checkout.session.async_payment_succeeded, que la ruta sí trata.

## 2026-10-14 - Segunda promoción a main (5 commits, b4b368db): backup diario, simulacro trimestral y runbooks
- Qué: dev, staging y main en b4b368db con git:promote. La pasarela se negó la primera vez porque el PR Check de staging seguía en curso; se esperó a que terminara en success y no se usó --override-reason. Entran #660 (parches de lucide-react, posthog-js y prettier), #662 (bitácora y runbook de Stripe), #663 (runbook de retirada de datos de Mercadona y Consum, FRESCO-921), #664 (Dependabot ignora el major de stripe, FRESCO-952) y #665 (backup diario y simulacro trimestral, FRESCO-920). Verificado en main: los dos cron (17 3 * * * y 43 4 1 1,4,7,10 *), los dos ignores de Dependabot (typescript y stripe), /api/health en ok, despliegue de producción y post-deploy @smoke en success.
- Por qué: dejar activos el backup diario (RPO de 7 días a 24 horas) y la regla de Dependabot, que solo se leen desde la rama por defecto.
- Siguiente: el primer backup diario corre mañana a las 03:17 UTC y es lo que confirma FRESCO-920 (sigue en Control de calidad, igual que 921). Decisión abierta del fundador: lanzar el simulacro de restauración a mano una vez, que crea un proyecto temporal en Supabase unos minutos; si no, el primero programado es el 2027-01-01. FRESCO-952 sigue en Listo: la subida de stripe 23 es a mano. Cuando Dependabot recree el grupo de mayores sin stripe, evaluar @types/node, boxen y lint-staged.
