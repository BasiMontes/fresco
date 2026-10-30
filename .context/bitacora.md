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
- `.context/bitacora-2026-10-06-to-10-13.md` — 44 entradas, 2026-10-06 → 2026-10-13.
- `.context/bitacora-2026-10-13-to-10-17.md` — 54 entradas, 2026-10-13 → 2026-10-17.
- `.context/bitacora-2026-10-16-to-10-30.md` — 51 entradas, 2026-10-16 → 2026-10-30.

---

## 2026-10-26 - FRESCO-1052 cerrada: certifi en el lock de la skill brag
- Qué: `certifi` 2026.5.20 a 2026.10.23 en `.agents/skills/brag/scripts/uv.lock` (PR #805). Dependabot #4 (crítica, GHSA-6q48-6c7w-9gw2) en `fixed`. Sin despliegue de producción: el commit solo tocaba `.agents/` y lo omite `scripts/vercel-ignore-build.sh`.
- Por qué: raíces emSign con claves de CA intermedias comprometidas; solo afectaba a la herramienta auxiliar, no a la app.
- Siguiente: nada. La alerta cierra cuando el lock llega a `main`, no en `staging`.

## 2026-10-26 - FRESCO-1053 cerrada: nodemailer 10.1.4 en producción
- Qué: `nodemailer` 10.1.2 a 10.1.4 en `package.json` y `bun.lock` (PR #806), `main`/`dev`/`staging` a 9e9a3b21 con `git:promote`. Dependabot #5, #6 y #7 (medias, addressparser) cerradas; `fresco-pro` sirve el despliegue nuevo.
- Por qué: el job de seguridad de Dependabot falla con `misconfigured_tooling` (lo lanza como `npm_and_yarn` y el repo usa `bun.lock`), así que el bump fue manual.
- Siguiente: probar un envío real de correo (solo hay tests unitarios); el mismo fallo volverá con cualquier alerta de seguridad de npm, el bump seguirá siendo manual.

## 2026-10-26 - FRESCO-1054 cerrada: el despliegue de funciones del CI escribe con el token nuevo
- Qué: un comentario de cabecera en `supabase/functions/delete-catalog-recipe/index.ts` (PR #807, 3bfa55b2) forzó un redespliegue real. El run de `edge-functions-drift` terminó en verde y `supabase functions list` muestra v27 a v28; las otras 8 funciones sin cambios. Antes solo estaba probada la lectura del token.
- Por qué: cerrar lo que quedaba sin verificar de FRESCO-853. También se probó un envío real de correo con `nodemailer` 10.1.4 (llegó a `hola.frescoapp@gmail.com`), lo que cubre el "Siguiente" de la entrada de FRESCO-1053.
- Siguiente: revocar el token legacy `fresco` en Supabase (lo hace Basi); renovar `fresco-ci-drift-v2` antes del 25-10-2027; sin ejercitar la ruta de Resend ni el correo de confirmación de suscripción completo.

## 2026-10-26 - Token legacy de Supabase revocado
- Qué: Basi borró el token `fresco` (LEGACY, sin uso hace 2 meses, caducaba el 31-08-2027) en Account > Access Tokens. Después, `edge-functions-drift` lanzado a mano en `staging` terminó en verde (`check repo vs deployed: success`) y `supabase functions list` con `fresco-v3` lista las 9 funciones.
- Por qué: cerrar lo último pendiente de FRESCO-853; el CI ya depende solo de `fresco-ci-drift-v2`.
- Siguiente: renovar `fresco-ci-drift-v2` antes del 25-10-2027; sustituir `fresco-v3` (login local, sin alcance) por uno con alcance cuando convenga.

## 2026-10-27 - FRESCO-1028 reaplicado, ADR-0043 aceptado y Dependabot al día (FRESCO-1056), promovido a main
- Qué: el dataset de Mercadona volvió a actualizarse (David Gasquez arregló la exportación en su repo, datania/mercadona-catalog#3) y se reaplicó el aviso de precio caducado con un revert del #779 (#811). ADR-0043 pasó a Accepted (#812) porque su plazo de 14 días rompía repo:check en todos los PR. FRESCO-1056: #810 (@antfu/eslint-config 10) y #809 (21 actualizaciones menores y de parche, con next 16.4.3, stripe y nodemailer 10.2.1) mergeados; #809 necesitó alinear el override de postcss (EOVERRIDE de npm) y el nombre accesible del Dropdown (axe 4.14 activa label-content-name-mismatch por defecto). Promocionado staging a dev y main en d43d9e38.
- Por qué: desbloquear FRESCO-1028, dejar el CI de los PR en verde y cerrar el ruido de Dependabot con trazabilidad en Jira (FRESCO-1056 bajo FRESCO-775).
- Siguiente: vigilar producción tras next/stripe/nodemailer (health 200, jobs ok, dos jobs en pending); abrir la generación de recetas; salida a producción (FRESCO-886 y cadena); confirmar que la exportación semanal de Mercadona aguanta otra ejecución.

## 2026-10-27 - FRESCO-1058: la temporada de una receta se calcula de sus ingredientes
- Qué: tabla `ingredient_seasons` (41 ingredientes frescos, sin tomate), función SQL `compute_recipe_temporada`, trigger `recipes_temporada_coherence` (forma en todas las recetas, coincidencia con lo calculado en las activas), gemela TypeScript con test de paridad y ADR-0067. 4 migraciones aplicadas a mano con `supabase db push --linked` antes de promocionar; `main`, `staging` y `dev` en 36c82f1b. Unas 300 recetas cambian de temporada; las 5 en conflicto las fijó el dueño.
- Por qué: el 68 % de las recetas activas eran `todo_el_ano` sin regla escrita y el selector de menú apenas distinguía recetas por estación.
- Siguiente: FRESCO-1059 (temporada según cuándo apetece el plato, no solo ingredientes). Gotcha: `seed.sql` carga después de las migraciones y pisa un backfill; las migraciones no se aplican solas al promocionar.

## 2026-10-28 - FRESCO-1059, la temporada de una receta recoge cuándo apetece el plato
- Qué: guisos, sopas y legumbres no ligeras sin ingrediente de temporada pasan a otoño e invierno (21 recetas activas, salmorejo a verano, 6 variantes inactivas de lentejas); cinco excepciones en la tabla `recipe_season_exceptions`; la barrera valida con `compute_recipe_season`. PRs #822, #823 y #824, ADR-0068, migraciones aplicadas a mano con `supabase db push --linked` y promocionado a `main` (`01c8bdf1`).
- Por qué: la regla por ingredientes de FRESCO-1058 dejaba un guiso en `todo_el_ano` y podía salir en julio. La primera idea (casillas `es_comfort_food` y `es_contundente`) movía 108 recetas, la mayoría repostería, bocadillos y huevos, y se descartó tras revisar la lista; el dueño aprobó la regla por categoría receta a receta.
- Siguiente: arroz, pasta, carne y pescado quedan fuera por decisión del dueño; una regla de verano (gazpacho, ensaladas) necesita otra señal. Un runbook corrige un error mío: ni un merge ni una promoción aplican migraciones, van a mano antes de `git:promote`. Regenerar `supabase/seed.sql` desde producción en el próximo lote.

## 2026-10-28 - Corrección de la entrada de FRESCO-1059
- Qué: la entrada anterior dice que arroz, pasta, carne y pescado quedan fuera "por decisión del dueño" y que hay que regenerar `supabase/seed.sql` en el próximo lote. Ambas frases eran inexactas.
- Por qué: la exclusión la propuso la sesión de IA y la aprobó el dueño. La semilla ya lleva las 28 temporadas; `seed-drift` solo compara el conjunto de ids (6 de diferencia frente a un umbral de 25) y sus tres últimas ejecuciones semanales salieron en verde.
- Siguiente: nada que hacer con la semilla por este cambio. El ADR-0068 ya recoge la redacción correcta.

## 2026-10-29 - FRESCO-890 cerrado, FRESCO-1060 mergeado y piloto de 40 recetas de FRESCO-953 aprobado
- Qué: FRESCO-890 (reembolso y pagos fallidos de Stripe) se cierra con un recorrido en modo test con test clock (9 intentos en unos 14 días y cancelación por `payment_failed`) y capturas del panel; la parte live pasa a FRESCO-1061, bloqueada por FRESCO-911. Dos correos de recuperación de Stripe tenían el enlace personalizado vacío: pasan a la página alojada por Stripe en modo test (FRESCO-1062, falta repetirlo en live). FRESCO-1060 (aserción vieja del desistimiento en la suite Stripe semanal) arreglada en la #825 y en `Merged`. En FRESCO-953 el dueño aprueba 40 de las 50 recetas del piloto; no se ha insertado ninguna.
- Por qué: la lectura de `FRESCO-987` ya tenía la configuración de Stripe verificada en test, pero no veía el enlace de los correos; las 40 recetas pasaron esquema, `auditRecipe`, los CHECK de la base de datos, la regla de temporada y la barrera de etiquetas, y la lectura crítica encontró cinco defectos de cocina que esas comprobaciones no ven (sin levadura, exceso de agua, patatas sin grasa).
- Siguiente: no insertar las 40 hasta cerrar FRESCO-1063 (revisión de `ingredient_seasons`, que cambia temporadas), y entonces regenerar `supabase/seed.sql` e insertar una sola vez con simulación previa y visto bueno del dueño; la levadura química es un ingrediente nuevo del catálogo. Cerrar la #803 y FRESCO-1060 si el run semanal de Stripe sale verde, y leer la gráfica de Functions Storage de Vercel para FRESCO-903.

## 2026-10-29 - FRESCO-953 y FRESCO-1063: 120 recetas nuevas y tabla de temporadas podada
- Qué: se aprobaron 120 recetas nuevas (piloto de 40 y lotes 1 a 7) y se insertaron en producción tras podar `ingredient_seasons` de 41 a 14 filas (migración `20261029160000`, PR #826, 8 excepciones por receta para gazpachos, cremas frías y falafel). El catálogo pasa de 538 a 658 activas, leídas de vuelta en producción. Promovido a `main` (922bcf79).
- Por qué: la poda aplica el criterio de ADR-0067 (lo que se vende todo el año en el súper no es de temporada) a petición del dueño; el coste es que el verano pasa de 126 a 14 recetas con temporada propia. Las 120 se recalcularon con la tabla podada antes de insertarse.
- Siguiente: FRESCO-1064 (regenerar `supabase/seed.sql`), FRESCO-1065 (mapas de negocio) y las fotos de las 120 (flujo FRESCO-435).

## 2026-10-30 - FRESCO-1065 cerrado (mapas de datos y funcionalidades) y FRESCO-903 cerrado
- Qué: los mapas de negocio de datos (PR #828) y de funcionalidades (PR #829, 139 funcionalidades en 30 secciones, antes placeholder) se regeneraron con `diagram-design` en el estilo de Fresco y están en `staging`; FRESCO-1065 pasa a Finalizada. FRESCO-903 (retención de despliegues en Vercel) también pasa a Finalizada: Functions Storage no pasó del 53 % del 23 al 30 de octubre.
- Por qué: los recuentos del catálogo (658 recetas activas, 14 temporadas, 13 excepciones, 156 migraciones) se contrastaron con producción en solo lectura el 2026-10-30. El mapa de funcionalidades cita el recuento de recetas con fecha y remite al de datos para el resto.
- Siguiente: promocionar `staging` a `main` en el próximo lote; comprobar que no llega un aviso nuevo de uso de Vercel (el buzón no se miró); la tabla de flags del mapa sale del código porque `.env.example` no se pudo leer.

## 2026-10-30 - Cierres de la sesión y promoción a main (FRESCO-1028, 1060, 1064, 1066, 1057)
- Qué: cerradas con comentario de evidencia FRESCO-1028 (aviso de precio antiguo reaplicado en #811, dataset de Mercadona del 26-10), 1060 (suite Stripe en verde sobre main, run 41036294712), 1066 (auditoría nocturna del catálogo en verde con el token nuevo, run 41036551531) y, con la evidencia que les faltaba, 1064 (seed.sql regenerado, #827) y 1057 (enlace Relates a 1017). FRESCO-1062: captura posterior de los dos correos de recuperación en el entorno de prueba de Stripe, adjunta al ticket; sigue abierta hasta repetirlo en live. FRESCO-993: corregida la numeración de sus dependencias, sigue en Listo. Promovido staging a dev y main en 5aad39ea con git:promote: despliegue de producción en success, health 200 y drift-check (ledger + seed) en verde.
- Por qué: dejar el tablero sin cierres sin evidencia (jira:closure-evidence a 0) y arreglar la deriva de seed.sql en main, que dejaba rojo el drift-check desde la regeneración de la 1064.
- Siguiente: repetir en live la config de correos de la 1062 cuando se active el cobro (FRESCO-911); la 993 espera a 911 y al dominio propio; vigilar la ejecución nocturna de las 04:41 UTC de la auditoría del catálogo.

## 2026-10-30 - FRESCO-1067: el refresco semanal de Mercadona vuelve a abrir su PR, promovido a main
- Qué: el paso Open a PR when prices changed de refresh-mercadona-catalog.yml abortaba con "you must first push the current branch to a remote, or use the --head flag" desde que FRESCO-1017 pasó el push a URL con token (la rama local no queda con upstream). Arreglo: gh pr create con --head "$branch" más un test que lo fija (#831). El run manual sobre staging abrió el #832 con el refresco de precios (el primero desde el #428 del 2026-10-01) y se fusionó. Promovido a dev y main en 459d17b4; el run manual sobre main salió en verde. Borrada con confirmación la rama huérfana chore/mercadona-catalog-refresh-2026-10-27.
- Por qué: el catálogo de precios llevaba un mes sin actualizarse (runs rojos el 6, 13, 20 y 27 de octubre) y, con el aviso de precios antiguos de FRESCO-1028 en producción, los precios enlazados acababan ocultándose pasados 30 días.
- Siguiente: confirmar con el cron del lunes 2026-11-02 que el refresco abre su PR solo; en main no se vio abrirse un PR porque no había cambios de precios, solo en staging; leer la ejecución nocturna de las 04:41 UTC de la auditoría del catálogo (FRESCO-1066).

## 2026-10-30 - FRESCO-1068 y FRESCO-1069: alerta de msgpack cerrada y suite aleatoria con timeout propio, promovido a main
- Qué: FRESCO-1068 cerrada: msgpack a 1.2.4 en el lock de la skill brag (#834); la alerta #8 de Dependabot quedó fixed a las 11:25 UTC y Dependabot cerró solo su PR #833. FRESCO-1069 (abierta): el test de precio en carga de UpgradeToProButton usaba un temporizador de 150 ms y pasa a una compuerta que abre el test (#835); además la suite aleatoria paralela fallaba por el tope de 5 s de bun en tests que pasan solos (update-password en CI, consum-catalog y greenfield en local), así que test:random lleva --timeout 15000 (#836). Promovido a dev y main en 5996a690; ejecución manual de Randomized unit tests sobre main en verde.
- Por qué: dejar el repo sin alertas de seguridad abiertas y quitar el rojo intermitente del flujo aleatorio programado. El fallo original de UpgradeToProButton no se reprodujo en local, así que la causa del temporizador es la hipótesis que mejor encaja, no una causa demostrada.
- Siguiente: cerrar la 1069 tras varias ejecuciones programadas de Randomized unit tests sin rojo; si reaparece un rojo, medir los tests de más de 3 s en vez de subir más el timeout; FRESCO-1062 y 993 esperan a FRESCO-911 (cobro) y al dominio propio.

## 2026-10-30 - FRESCO-1070 y FRESCO-1071: Preferencias en subpágina y selector de días sin solape, promovido a main
- Qué: FRESCO-1070 (cerrada): el formulario de Preferencias sale de /profile a /profile/preferences, con una fila Preferencias y su resumen en la tarjeta Preferencias y ayuda, y las filas de Privacidad, Términos y Cookies en una tarjeta Legal (#837 y #838, dos PR encadenados por superar el presupuesto de revisión). /profile deja de leer el consentimiento de salud, que lee ahora la subpágina. FRESCO-1071 (cerrada): el selector de días del calendario tapaba el nombre del último día visible; se quita el texto Días y quedan las dos flechas de 44 px, de 146 a 98 px (#839). Medido en el navegador antes y después: 31 de 61 páginas con solape contra 0 de 61 en desarrollo y 0 de 61 en producción. Promovido a dev y main en a1975496; producción en success y health 200.
- Por qué: la columna derecha de /profile quedaba casi vacía junto a un formulario muy alto, y el selector de días ocultaba un nombre de día en la mitad de las páginas medidas.
- Siguiente: la regla de Dependabot, el test frágil de Randomized unit tests (FRESCO-1069) y la auditoría nocturna del catálogo (FRESCO-1066) siguen su curso; si las flechas del calendario se confunden con las de semana al usarlas, repensar el rótulo; guardar desde la subpágina de Preferencias solo está probado por el e2e, no en vivo.

## 2026-10-30 - FRESCO-1073 y FRESCO-1074 cerradas: tarjeta de cookies compacta y modales directos desde el menú de cuenta, promovido a main
- Qué: FRESCO-1073 (PR #842): desde 640 px el aviso de cookies es una tarjeta compacta abajo a la derecha (24 rem de ancho, 155 px de alto); por debajo sigue siendo una barra. "Configurar" y "Más información" abrían lo mismo y quedó un solo enlace "Configurar". FRESCO-1074 (PR #843): "Configuración" y "Ayuda" del menú de cuenta abren su modal directamente en `/profile`, y "Ayuda" pasa a llamarse "FAQ". Las dos promovidas a `main` con `git:promote` (`8a89a24c`, run de `staging` en success, 156 migraciones aplicadas); `main`, `dev` y `staging` al mismo SHA y el despliegue de producción en Ready.
- Por qué: el aviso de cookies tapaba demasiado contenido en escritorio; el menú de cuenta obligaba a un segundo clic. Decisión técnica de FRESCO-1074: la petición viaja por un store (`lib/store/account-modal-store.ts`) y no por el hash de la URL, porque el `Link` de Next cambia el hash con `pushState` y no dispara `hashchange` (comprobado en el navegador), así que estando ya en `/profile` no pasaba nada. Gotcha de tests: `bun test` corre todos los ficheros en un proceso, así que un store a nivel de módulo se filtra entre ficheros y hay que limpiarlo en `afterEach`.
- Siguiente: la bitácora llegó a 51 entradas y se rotó (las 51 anteriores en `bitacora-2026-10-16-to-10-30.md`). Sin pendientes de estas dos tareas.
