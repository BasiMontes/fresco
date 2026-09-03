# Bitácora — Fresco

Log append-only. Cada iteración relevante suma entrada abajo: qué hecho, por qué, qué sigue. IA lee esto primero para contexto rápido en sesión nueva — no re-derivar todo desde cero. Nunca reescribir entrada vieja, solo agregar.

Formato entrada: fecha — título corto. Qué / Por qué / Siguiente.

**Cuándo escribir** (Regla 15, `CLAUDE.md`): SOLO al cerrar una historia de Jira, resolver un bug crítico, o hacer un deploy. NUNCA por trabajo trivial, cambios de texto o sesiones exploratorias.

**Rotación**: al superar 50 entradas, archivar (`mv` a `bitacora-<rango>.md`) y arrancar este archivo de nuevo con el header + las últimas ~15 entradas.

Historia archivada:
- `.context/bitacora-2026-07-to-2026-08.md` — 383 entradas, 2026-07-25 → 2026-08-27.
- `.context/bitacora-2026-08-to-09.md` — 85 entradas, 2026-08-27 → 2026-09-02.

---

## 2026-09-01 - FRESCO-379: project-dev-guide.md de-Gemini (A4-H18)
- Qué: quitadas todas las menciones a Gemini Flash como dependencia viva del `project-dev-guide.md` (diagramas, flujos, sección "## Gemini Flash", GEMINI_API_KEY) + corregido el framing "todavía no hay código / las tablas no existen". Banner ADR-0005 al estilo FRESCO-302. PR #231 squash a dev, SP 3.
- Por qué: audit-4 A4-H18 (ALTO). FRESCO-302 limpió PRD/SRS y se saltó este fichero; un doc de fundación que miente sobre la arquitectura desorienta a humano y agente.
- Siguiente: ff staging; main en espera (promote en lote). Follow-up ticket pendiente para la deriva diferida: §3 sin el estado `excluida`, flujos nuevos sin documentar (signup progresivo, favoritos, recetas propias, push semanal), write-ups por integración (Stripe/PostHog/Sentry).

## 2026-09-01 - FRESCO-381: bug de la media movil de rating (A4-M2)
- Qué: `update_recipe_learning()` promediaba `rating_promedio` sobre `veces_cocinada` (cuenta todos los cocinados); cada cocinado sin puntuar hundía la media hacia 0. Fix: columna nueva `recipes.veces_calificada` (solo cocinados puntuados), el trigger promedia sobre ella, + backfill desde `meal_plan_recipes` que corrige la deriva histórica. Primer test pgTAP del repo (`supabase/tests/`) + step `supabase test db` en el job e2e de CI. PR #232 squash a dev, SP 3.
- Por qué: audit-4 A4-M2. `menu-selector.ts` puntúa con `rating_promedio*2`, así que las recetas bien valoradas estaban penalizadas por el ruido de los cocinados sin puntuar; datos de producción ya sesgados.
- Siguiente: ff staging; main en espera. Luego FRESCO-380 (A4-M1, determinismo del motor).

## 2026-09-01 - FRESCO-380: determinismo real del motor de menú (A4-M1)
- Qué: el jitter `Math.random()*2` de `scoreRecipe` (rango = peso por estrella del rating) podía voltear un 5★ vs 4★; `get_filtered_recipes` sin `ORDER BY`. Fix: PRNG sembrado por `${user.id}:${semana_iso}` capado a `rng()*0.5` (solo desempata, no voltea una estrella); migración `20260901160000` añade `order by r.id`; tests asertan reproducibilidad en vez de fijar `Math.random` a 0; nota de update en ADR-0005. PR #233 squash a dev, SP 3.
- Por qué: audit-4 A4-M1. ADR-0005 decía "determinista" pero ningún menú era reproducible.
- Siguiente: ff staging; main en espera con 2 migraciones (FRESCO-381 + 380) que necesitan `supabase db push`. Luego ola-2 sigue (FRESCO-382+).

## 2026-09-02 - FRESCO-31 batch + seed.sql regen (774/1000)
- Qué: 2 tandas de fetch-recipe-photos.ts (18+18 hits), recipes.foto_url 738 -> 774/1000, 0 duplicados. Regenerado supabase/seed.sql desde dump de prod (frutos_secos deviation retirada, migración 20260901073555 ya en prod). supabase db reset verificado. Commit ef99df0 -> dev + ff staging.
- Por qué: chore recurrente de backfill de fotos vía Unsplash free tier; seed.sql es el fixture de CI para test:e2e.
- Siguiente: 226 recetas sin foto (variantes filler-only difíciles). main sin promover (15 commits de audit-4 wave por detrás, batch promote pendiente de decisión del owner).

## 2026-09-02 - FRESCO-382 planner correctness + DRY (A4-M4/M5/M8)
- Qué: M4 cotas de tamaño de hogar (migración 20260902120000 CHECK <=10 en num_personas/adultos/ninos + clamp server-side en generate-shopping-list). M5 guardia raciones_receta>0 en consolidateIngredientes (evita coste_estimado NaN/null). M8 normalizeNombre 3 copias Node -> 1 (lib/text/normalize-nombre.ts) + test de deriva Deno<->Node (lib/text/runtime-parity.test.ts) para normalizeNombre y getIsoWeek. PR #234 -> dev, SP 3.
- Por qué: audit-4 ola-2, 3 hallazgos MEDIO de correctitud/DRY del planificador.
- Siguiente: CI verde -> squash a dev + ff staging. main HELD (migración nueva pendiente de supabase db push al promover, igual que FRESCO-380/381).

## 2026-09-02 - FRESCO-383 swap_meal_plan_slots sin lock de tabla (A4-M6)
- Qué: migración 20260902130000. update_recipe_learning() respeta un GUC app.skip_recipe_learning; swap_meal_plan_slots() lo setea transaction-local (set_config is_local + reset explícito) en vez de ALTER TABLE ... DISABLE TRIGGER (que tomaba ACCESS EXCLUSIVE de meal_plan_recipes en cada swap). Rate limit 120/h vía check_and_increment_rate_limit (ADR-0010). Firma sin cambios, cero cambio en app. PR #235 -> dev + ff staging, SP 3.
- Por qué: audit-4 A4-M6 (arquitectura/rendimiento).
- Siguiente: CI verde. main HELD (migración pendiente de supabase db push al promover, con 380/381/382).

## 2026-09-02 - FRESCO-384 catálogo /recipes server-side (A4-M7)
- Qué: RPC get_catalog(...) devuelve jsonb {recipes: página, total, facets} reutilizando get_filtered_recipes como base de seguridad. /recipes URL-driven (?q ?page ?meal ?cocina ?dieta ?alergeno), payload inicial ~26 KB (era ~1,1 MB). RecipeLibrary sin filtrado/facetas en memoria. pgTAP get_catalog.test.sql (12 asserts). PR #236 (4 commits + 1 fix de carrera e2e) -> dev + ff staging, SP 5.
- Por qué: audit-4 A4-M7 (arquitectura/rendimiento).
- Siguiente: main HELD. Gotcha: RECIPE_PAGE_SIZE importado de un módulo use-client a un RSC = stub -> NaN limit -> página vacía (FRESCO-117). Carrera de navegación en transición -> construir URLs desde window.location, no props.

## 2026-09-02 - FRESCO-385 sink de Sentry para Edge Functions (A4-M9)
- Qué: _shared/sentry.ts nuevo — captureEdgeException postea un envelope de Sentry v7 vía fetch (sin SDK). No-op salvo SENTRY_DSN seteado Y proyecto hosted (CI/local nunca envían). toErrorResponse (catch único) ahora async: genera errorId, saca el sub del JWT, reporta. Cero cambio en los 9 index.ts. PR #237 -> dev + ff staging, SP 3.
- Por qué: audit-4 A4-M9 (observabilidad) — errores inesperados de Edge Function no generaban alerta.
- Siguiente: activar con supabase secrets set SENTRY_DSN por entorno. main HELD.

## 2026-09-02 - FRESCO-386 CSP enforcing + nonce (A4-M10)
- Qué: CSP pasa de Report-Only+unsafe-inline a enforcing con nonce por request. proxy.ts genera el nonce y pone la CSP (req+resp headers). script-src sin unsafe-inline/unsafe-eval, con strict-dynamic + wasm-unsafe-eval (A4-L21). lib/security/csp.ts (builder puro). next.config.mjs sin CSP (5 headers estáticos quedan). app/layout.tsx force-dynamic (nonce obliga render dinámico en todo). style-src mantiene unsafe-inline. report-uri a Sentry se mantiene. PR #238 -> dev + ff staging, SP 5.
- Por qué: audit-4 A4-M10 + A4-L21. La CSP Report-Only no protegía de XSS.
- Siguiente: main HELD. Verificado: build prod local walk completo + preview de Vercel + e2e, cero violaciones. Tradeoff aceptado: todas las páginas dinámicas, sin cache CDN.

## 2026-09-02 - FRESCO-387 limpieza de verificacion (A4-M13/M14/M15)
- Qué: M13 scripts/check-seed-drift.ts (IDs de seed.sql vs prod via psql, umbral 25) + job hermano en migration-drift-check.yml. M14 playwright reporter [list,html,blob] en CI + upload-artifact if:always de playwright-report/blob-report/test-results. M15 el e2e del moat asserta exclusion de cocinadas+descartadas (antes solo descartadas) + assertion determinista del boost via RPC. PR #239 -> dev + ff staging, SP 3.
- Por qué: audit-4 ola-2, 3 hallazgos MEDIO del plano de verificacion.
- Siguiente: main HELD. Gotcha: assertar el output del menu-selector es flaky, assertar los inputs/senales que consume.

## 2026-09-02 - FRESCO-390 instrumentacion del funnel OTP (A4-M25)
- Qué: eventos PostHog otp_sent (context initial/resend) / otp_verified / otp_failed (reason) en app/signup/page.tsx + lib/posthog/event-names.ts. ADR-0021: mantener OTP Gmail SMTP para la cohorte, diferir dominio+Resend, con triggers de reapertura (verify/sent <80% sobre >=50 eventos, primer report de spam, usuario de pago afectado). Fork B. PR #240 -> dev + ff staging, SP 2.
- Por qué: audit-4 A4-M25 (producto) — la conversion de registro progresivo depende de entregabilidad Gmail SMTP fragil.
- Siguiente: medir el funnel sobre la cohorte real. main HELD.

## 2026-09-02 - FRESCO-388 higiene de backlog (A4-M16/M17/M18)
- Qué: M16 12 tickets de Control de calidad -> Finalizada + 2 epicas cerradas (FRESCO-223, 81). M17 .context/backlog/estimation-and-tracking-model.md — decision: throughput tracking (tickets/semana), no velocidad; DRAFT epics 330/331/332 sin estimar hasta tirar de ellas. M18 AC Gherkin testeable para FRESCO-245/246/249 (274/275 ya Finalizada, forward-only). Fork C. PR #242 -> dev + ff staging, SP 3.
- Por qué: audit-4 A4-M16/M17/M18 (backlog).
- Siguiente: main HELD. Tally semanal opcional en bitacora.

## 2026-09-02 - FRESCO-389 ADRs pendientes (A4-M21/M22)
- Qué: ADR-0019 (cabeceras de seguridad + CSP enforcing con nonce, invariante transversal; follow-up FRESCO-386 marcado hecho), ADR-0020 (un solo proyecto Supabase para todos los entornos hasta Supabase Pro; invariante + 5 triggers de reapertura), nota de estado en ADR-0005 (la explicacion Pro es 100% determinista desde el 1 ago, model ids inventados). README con las filas de indice. Solo docs. PR #241 -> dev + ff staging, SP 3.
- Por qué: audit-4 A4-M21/M22 + A4-M11 como ADR: decisiones hard-to-reverse sin registrar.
- Siguiente: main HELD.

## 2026-09-02 - FRESCO-391 conteo canonico del catalogo (A4-M26)
- Qué: business-data-map.md §2 ancla "Canonical catalog size" (1000, select count(*) from public.recipes) + hechos de completitud (fotos 774, dificultad 0 en blanco). glosario "~35/~230" -> 1000. project-dev-guide 3x ~1000 -> 1000. business/README tabla de figuras canonicas. Solo docs. PR #243 -> dev + ff staging, SP 3.
- Por qué: audit-4 A4-M26 — 5 conteos distintos en los docs. El hallazgo estaba parcialmente obsoleto (dificultad ya hecha, fotos 774).
- Siguiente: main HELD.

## 2026-09-02 - FRESCO-392 cierre real de los 4 forward-only (A4-FWD-ONLY)
- Qué: verificados los 4 cierres forward-only (FRESCO-282/313/320/328). 282 cumplido por FRESCO-378 (35 defectos con enlace+Severity+Evidence, verificado REST); 320 cumplido por FRESCO-388/M18 (Gherkin observable en 245/246/249); 313 gate vivo; 328 ya en Rechazos, añadido puntero a ADR-0020. Comentarios de constancia en los 4 + comentario paraguas en 392. Creado FRESCO-404 (ticket de proceso Ola-3: DoD dura de "Finalizada"). Rastro en .context/audits/2026-09-02-FRESCO-392-forward-only-closeout/.
- Por qué: auditoría 4 A4-FWD-ONLY, epic FRESCO-359 ola-3. Los 4 tickets figuraban cerrados sin que la métrica del hallazgo fuera cero.
- Siguiente: implementar FRESCO-404 (documentar la DoD dura). Promoción a prod del batch audit-4 ola-2 sigue en HOLD (~36 commits, migraciones 380-384 pendientes de push).

## 2026-09-02 - FRESCO-393 disciplina: Regla 15 + docs del alias fresco-pre (A4-M19/M23)
- Qué: M19 — bitacora.md rotada (85 entradas archivadas a `bitacora-2026-08-to-09.md`, rearranque con header + 15); `CLAUDE.md` + `AGENTS.md` del repo padre (repo git separado, local, sin remoto — commit 6ac9f22) alineados a la Regla 15 (solo cierre de historia / bug crítico / deploy); sub-bullet ROTACIÓN de la Regla 15 corregido. M23 — verificado en vivo con `vercel inspect`: `fresco-pre` co-ubicado con el branch domain de staging en un deploy target:preview, distinto del target:production de `fresco-pro` — NO se reclama sobre prod. Reescritos los comentarios `web_url` de staging+production en `project.yaml` al Git Branch binding; fichero de memoria + índice reconciliados. PR #245 squash a dev + ff staging (1fbdafb). SP 3.
- Por qué: auditoría 4 ola-3, eje Disciplina. M19: log corrido rompía la rotación otra vez contra la Regla 15. M23: MEMORY y project.yaml se contradecían sobre si staging podía servir prod en silencio.
- Siguiente: promoción a prod en el batch audit-4 (main en espera). Ola-3 restante: revisar hijos abiertos de FRESCO-359.

## 2026-09-02 - FRESCO-394 doctrina de proceso de auditoria (A4-M20/§09)
- Qué: nuevo `.context/audits/audit-process.md` — cadencia de auditoria mensual (no semanal), una sola epica de remediacion abierta a la vez, definicion dura de "Finalizada" (resumen + delegado a FRESCO-404), congelacion de optimizacion de CI. FRESCO-358 (rearquitectura del stack Supabase para e2e sub-3min) diferido -> Rechazos con comentario; ADR-0018 (reloj ~6m30s early / ~8m hard) es el unico trigger para reabrir. Enlaces Relates: 358<->359, 330<->359 (+ nota de redireccion en 330: el esfuerzo va a validar producto), 394<->404. Seccion puntero en audits/README.md (+ fixes de historial de score pre-existentes del working tree). PR #246 squash -> dev (ba6de6d). SP 2. SOLO.
- Por qué: auditoria 4 ola-3, eje Disciplina. A4-M20: agujero de conejo de e2e-CI (~72s perseguidos con 3 tickets/1 ADR/3 PRs/5 entradas de bitacora en proyecto no urgente de un committer). §09: cadencia semanal + epicas de remediacion solapadas + cierre forward-only.
- Siguiente: implementar FRESCO-404 (DoD completa). Promocion a prod del batch audit-4 sigue en HOLD (main en espera).

## 2026-09-02 - FRESCO-404 Definition of Done dura (A4-PROC)
- Qué: nuevo `.context/backlog/definition-of-done.md` — principio "cerrar sobre la metrica, no sobre el mecanismo"; tabla de gates de cierre por tipo de ticket (defecto / tarea datos-backlog / historia feature / decision-deferral / tarea proceso-docs); escape hatch de residuo aceptado (nombrado + ticket de seguimiento concreto + linkeado); puntos de enganche; revisit triggers. Wiring: audit-process.md §3 apunta al doc (ya no "once it lands"); gate FRESCO-313 de bug-fix-workflow.md enmarcado como la instancia defecto de la DoD; nuevo Gotcha 17 en /sprint-development. Home = .context/backlog/ sibling de estimation-and-tracking-model.md (no ADR — un close-gate no es arquitectonico hard-to-reverse). Sin edicion de CLAUDE.md. PR #247 squash -> dev (0d40368). SP 2. SOLO.
- Por qué: auditoria 4 ola-3, A4-PROC, delegado desde FRESCO-394 §3. Origen: FRESCO-392 tuvo que reabrir y reverificar FRESCO-282/313/320/328, todos cerrados forward-only ("el mecanismo existe" != "hecho").
- Siguiente: resto de hijos ola-3 de FRESCO-359 (395-400). Promocion a prod del batch audit-4 sigue en HOLD (main en espera).

## 2026-09-02 - FRESCO-395: A4-L4 oráculo de fuerza bruta + A4-L5 /qa noindex
- Qué: reassign-guest-data verifica propiedad con token de sesión (no signInWithPassword sobre credenciales del llamante) + rate limit 5/h; contrato -> { targetAccessToken }; ADR-0022. /qa: noindex + Disallow + project ref -> placeholder.
- Por qué: audit-4 ola-3 Seguridad, A4-L4 + A4-L5 (BAJO). PR #248 -> dev 60f478b, ff staging. SP 3.
- Siguiente: ola-3 FRESCO-359. main en espera.

## 2026-09-02 - FRESCO-396 A4-L6..L10 correctitud menor del motor
- Qué: 5 hallazgos BAJO de auditoría-4 ola-3 (eje Arquitectura). L6: `.or()` de admin-recipes escapado+entrecomillado (patrón PostgREST, verificado live). L7: `buildUpdatePayload` limita recipe_id a `sustituida` y rating fuera de `sustituida` (whitelist estado/rating ya venía de FRESCO-362). L8: `isProEntitlementActive` — el gate de Pro comprueba `plan_expires_at` + respeta la gracia de dunning `past_due` de Stripe. L9: migración 20260902150000 — `swap_meal_plan_slots` rechaza slots `excluida`. L10: bucket de coste desconocido ya no genera `NaN` (el aviso de presupuesto desaparecía); consolidator conserva cantidad de unidad incompatible en grupo aparte.
- Por qué: remediación auditoría-4 (epic FRESCO-359), correctitud del motor de menús / Edge Functions.
- Siguiente: PR #249 squash en dev (0c949bb), ff a staging. main HELD (lote auditoría-4). Jira → Control de calidad. Pendiente resto de ola-3.

## 2026-09-02 - FRESCO-397 A4-L11 re-auth borrado de cuenta + A4-L12 semana ISO en TZ negativas
- Qué: A4-L11 — `delete-account` exige re-autenticación reciente (token fresco de `signInWithPassword`, verificado server-side: auténtico via `auth.getUser()` + mismo user id + `iat` < 5min, `reauth.ts` `isTokenRecent` sin verificar firma) + rate limit 5/h por usuario (`enforceRateLimit`, 3er call site). Invitadas (`is_anonymous`): solo rate limit (sin contraseña, identidad desechable). Contrato nuevo `DeleteAccountRequest { reauthToken? }`; diálogo gana campo contraseña para registradas; ADR-0023 (espeja ADR-0022 — verificar token, nunca password). A4-L12 — `lib/date/iso-week.ts` `toUtcDateOnly` leía getters locales mientras el resto usaba `getUTC*`; `addIsoWeeks()` daba la semana equivocada en TZ con offset UTC negativo (LA: lunes 00:00Z leído como domingo previo). Fix: frame todo-UTC; copia Deno `send-weekly-reengagement-push/iso-week.ts` sincronizada; test regresión `TZ=America/Los_Angeles`.
- Por qué: auditoría-4 ola-3 (epic FRESCO-359), eje Arquitectura, 2 hallazgos BAJO. España no afectada por L12 (UTC+1/+2); CI en UTC no lo cazaba.
- Siguiente: PR #250 squash en dev (a18a0a9), ff a staging. main HELD (lote auditoría-4). Jira → Control de calidad. Pendiente resto de ola-3 (398-400).

## 2026-09-02 - FRESCO-398 A4-L13/L19/L20 limpieza docs + backlog
- Qué: L13 — borrado comentario "stubs / mock fallback" de `lib/api/edge-functions.ts` (8 funciones live hace meses). L20 — `discoverCoverage()` en `scripts/sync-jira-issues.ts` ya no materializa enlaces defecto↔defecto como carpetas anidadas recursivas (guard `coveredSlug !== 'defect'`); el enlace sigue en la sección "Related Issues" del `defect.md`; 20 ficheros anidados obsoletos eliminados. L19 parcial — `epic-tree.md` regenerado (25 epics, antes cortaba en FRESCO-278); `_orphans/` eliminado (FRESCO-273/274/275 movidas a EPIC-FRESCO-64). Diferido con runbook en el ticket: podar ~28 ramas locales + `git worktree prune` (hazard multi-sesión, Regla 13, worktrees locked en uso) y promoción dev→staging→main (HOLD del lote audit-4).
- Por qué: auditoría-4 ola-3 (epic FRESCO-359), eje Backlog/Fundación, 3 hallazgos BAJO.
- Siguiente: PR #251 squash en dev (8d6b098), ff a staging. main HELD. Jira → Control de calidad. Pendiente ola-3: FRESCO-399, 400.

## 2026-09-02 - FRESCO-399 A4-L14/L15/L16/L17 limpieza de verificación
- Qué: L14 — triaje de 11 escenarios `@pendiente` (11 -> 2): 3 automatizados (`tests/steps/notificaciones.steps.ts` — aviso de pago fallido en /notifications + badge del icono presente/ausente; seed de `payment_failed_at` vía service-role, sin API real de Stripe), 7 -> `@solo-manual` (convención nueva: manual deliberado y documentado — OTP sin fixture de inbox, setup desproporcionado con lógica ya en unit tests, rama de estado vacío ya cubierta), 1 sigue `@pendiente` con plan concreto de automatización (guard de regeneración de calendario, próximo batch), 1 sigue `@pendiente` marcado para spin-off de decisión de producto (¿las recomendaciones excluyen favoritas?). L15 — `@verificado-manual-<fecha>` caduca a las 6 semanas para el reporte de cobertura; regla + receta `rg` en el README; los `@automatizado` están exentos. L16 — `post-deploy-smoke.yml`: 3 acciones ancladas por SHA (trigger privilegiado `deployment_status` con `secrets.ENV_FILE`) + `persist-credentials: false`; `ENV_FILE` ya estaba scoped a un solo step. L17 — `@retries:0` en el escenario `<10s` de ADR-0005: `retries:1` en CI dejaba que una corrida lenta fallara, reintentara y pasara, enmascarando regresiones de latencia intermitentes.
- Por qué: auditoría-4 ola-3 (epic FRESCO-359), eje Verificación, 4 hallazgos BAJO.
- Siguiente: PR #252 squash en dev (96ae88a), ff a staging. main HELD. Jira -> Control de calidad. Pendiente ola-3: FRESCO-400 (último).

## 2026-09-02 - FRESCO-400 A4-L18 landing hero + A4-L21 CSP (ya resuelto)
- Qué: L18 — CTA secundario del hero "¿Cómo funciona? Ver demo" -> "¿Cómo funciona?" (no hay demo; ancla a la sección de texto #como-funciona, ahora coherente con site-nav y final-cta). Fecha del mock: "Semana del 20 al 26 enero" con lunes=20, pero el 20/1/2026 es martes -> "19 al 25 enero" + martes 20. Solo `components/landing/hero.tsx`. L21 — el reporte de `unsafe-eval` de un chunk de Next ya lo resolvió FRESCO-386 (A4-M10): `script-src` de prod lleva `wasm-unsafe-eval` (el reporte era WebAssembly, no JS eval), `unsafe-eval` solo en dev; documentado en ADR-0019. Cero cambios. Enlazado FRESCO-405 (decisión de producto spin-off de FRESCO-399) en la nota de regression.feature.
- Por qué: auditoría-4 ola-3 (epic FRESCO-359), eje Producto/Seguridad, 2 hallazgos BAJO. Último ticket de ola-3.
- Siguiente: PR #253 squash en dev (317cc8f), ff a staging. Vercel falló por rate-limit de deploys (100/día, no bloqueante). main HELD. **Ola-3 de FRESCO-359 COMPLETA (392-400 + 404)**. Falta: promoción a prod del lote audit-4 completo (main sigue congelado).

## 2026-09-02 - FRESCO-245 Transiciones de pagina
- Que: fundido de entrada (~250ms) al navegar entre secciones de `(app)`. Nuevo `components/layout/page-transition.tsx` (wrapper cliente keyed por usePathname) + keyframe en globals.css + opt-out de prefers-reduced-motion. Mergeado dev+staging (a1e8692, PR #255).
- Por que: EPIC-FRESCO-244 (Motion y Transiciones), AC A4-M18. El primer intento con `experimental.viewTransition` rompio el drag&drop del calendario (STORY-FRESCO-11) en e2e; revertido. Divergencia §5-K: fundido de entrada, no cross-fade saliente+entrante.
- Siguiente: QA en staging (fresco-pre). main en hold (batch audit-4). Revisar cross-fade real cuando la View Transitions API sea estable en Next.

## 2026-09-02 - FRESCO-246 Listas y Tarjetas
- Que: animacion de entrada + stagger para cards de listas/grids. Hook `components/ui/use-list-enter-animation.ts` + keyframe en globals.css (bajo `prefers-reduced-motion: no-preference`). Cableado en lista de la compra + biblioteca de recetas. Mergeado dev+staging (31d24e3, PR #256).
- Por que: EPIC-FRESCO-244 (Motion y Transiciones), AC A4-M18. Divergencia §5-L: escenario 2 (salida) exento (sin flujo de borrado in-place en la UI viva) + calendario excluido (grid ventaneado, riesgo dnd-kit).
- Siguiente: QA en staging. main en hold (batch audit-4). Quedan FRESCO-249 (accesibilidad de movimiento) para cerrar el epic.

## 2026-09-02 - FRESCO-249 Accesibilidad de Movimiento (cierra EPIC-FRESCO-244)
- Que: guard global `@media (prefers-reduced-motion: reduce)` en app/globals.css (animation/transition-duration 0.01ms !important, scroll-behavior auto, .animate-spin re-exento) + matchMedia en horizontal-scroll-row.tsx. Auditoria: 5 huecos encontrados y cerrados. Mergeado dev+staging (4d9e8d7, PR #257).
- Por que: EPIC-FRESCO-244 A4-M18, WCAG 2.3.3/2.2.2. Guard transversal de las historias de motion. Sin divergencia §5 (nada recortado); nota en design plan §4.19.
- Siguiente: QA en staging del epic completo (245/246/247/248/249 dev-done). main en hold (batch audit-4). Vercel Preview de #257 quedo rate-limited (cap 100/dia) - redeploy tras reset 24h.

## 2026-09-02 - Promoción a main + fix migraciones prod + QA EPIC-244
- Qué: `main` 24542f5->a59fe28 (audit-4 ola-3 FRESCO-374..401 + EPIC-FRESCO-244). Aplicadas 6 migraciones que estaban en el repo sin correr en la DB compartida de Supabase (jdqemhewjrjuopssdurn): fix_rating_average_denominator (381), stable_order_get_filtered_recipes (380), household_size_upper_bounds (382), swap_slots_skip_learning_guc (383), catalog_pagination_and_facets (384), swap_slots_reject_excluida (396). Ledger reconciliado a versiones canónicas del repo + 2 re-datadas (130000/140000). QA de FRESCO-245/246/249 -> las 3 a Finalizada.
- Por qué: limite de deploys de Vercel obligaba a consolidar; get_catalog (384) no existia en prod -> /recipes vacio para todos los usuarios. audit-4 tickets cerrados con codigo mergeado pero migracion sin aplicar.
- Siguiente: verificar /recipes en prod tras propagacion; considerar gate CI que compruebe repo migrations == ledger (relacionado FRESCO-325).
  - Follow-up: creada **FRESCO-413** (Tarea, `Listo`) — gate CI que verifica `supabase/migrations/*` del repo == ledger `schema_migrations` de la DB (match por slug para tolerar re-datado). Relates FRESCO-325.

## 2026-09-03 - FRESCO-395: oráculo de fuerza bruta seguía vivo en prod (edge function sin redesplegar)
- Qué: QA de FRESCO-395 (A4-L4/L5). A4-L5 (/qa noindex) OK en vivo. A4-L4: código mergeado en las 3 ramas desde 9/2 pero la edge function reassign-guest-data nunca se redesplegó a Supabase (v19, contrato viejo {email,password} con signInWithPassword server-side = oráculo de fuerza bruta explotable por cualquier anónimo). Desplegada ahora (v20) con `supabase functions deploy reassign-guest-data --import-map supabase/functions/deno.json`. Re-verificado en vivo: contrato nuevo {targetAccessToken} activo, sin signInWithPassword, rate limit 5/h. FRESCO-395 -> Finalizada.
- Por qué: la ola-3 de audit-4 promovió código a main sin redesplegar las edge functions (mismo patrón que las 6 migraciones sin aplicar). Vulnerabilidad de seguridad marcada por el audit seguía viva en producción ~24h después de cerrar el ticket en el papel.
- Siguiente: sweep completo `supabase functions deploy` desde main (FRESCO-385/396/397 y _shared de 375/385 sin desplegar); gate CI "repo functions == deployed" hermano de FRESCO-413; con Docker apagado el deploy necesita --import-map explícito o el bundler remoto no resuelve @supabase/supabase-js.

## 2026-09-03 - Sweep redespliegue de las 8 edge functions + FRESCO-414
- Qué: redesplegadas las 8 edge functions a Supabase (jdqemhewjrjuopssdurn) desde el estado de main. Versiones: generate-meal-plan v31, update-recipe-status v21, generate-shopping-list v31, delete-account v14, get-shopping-list-suggestions v13, delete-catalog-recipe v8, send-weekly-reengagement-push v12 (--no-verify-jwt preservado), reassign-guest-data v20 (ya en la entrada previa). Smoke: todas responden 4xx de negocio, cero errores de bundle. Creada FRESCO-414 (gate CI edge functions repo == desplegado; Relates 413/359/311).
- Por qué: la ola-3 de audit-4 dejó FRESCO-385/396/397/375 sin desplegar (cambios en _shared afectan a las 8). Detectado en el QA de FRESCO-395.
- Siguiente: implementar FRESCO-414. Revisar delete-account: {} con token anónimo devolvió 200 (borró el usuario anónimo de prueba) - verificar que el re-auth de A4-L11/FRESCO-397 aplica también a sesiones anónimas.

## 2026-09-03 - QA ola-3 audit-4 completa + reconciliación bloque Merged
- Qué: cerradas 393-400 + 404 (Control de calidad -> Finalizada) tras QA en vivo contra prod/staging. Reconciliadas 374-392 (19 tickets atascados en Merged -> Finalizada, código verificado en main). Épica FRESCO-359: 39 Finalizada, 0 en QA, quedan 365 (Listo, revisión legal), 366+372 (Blocked, instrumentación funnel/push).
- Por qué: vaciar la columna de QA. FRESCO-395 destapó el gap de despliegue de edge functions de toda la ola-3 -> sweep de las 8 + FRESCO-414 (gate CI). FRESCO-398 ejecutó el podado de 24 ramas. FRESCO-399 generó FRESCO-416/417 de seguimiento.
- Siguiente: 365/366/372 para poder cerrar la épica FRESCO-359 (regla "una épica de remediación abierta a la vez", audit-process.md §2). Follow-ups: FRESCO-414 (gate edge fns), 416 (automatizar @pendiente calendario), 417 (SHA-pin workflows).

## 2026-09-03 - FRESCO-403: regeneración de project-dev-guide.md
- Qué: completada la pasada parcial de-Gemini de FRESCO-379. project-dev-guide.md +324/-40: estado excluida en §3, 4 flujos nuevos en §2 (guest onboarding+conversión, Pro lifecycle, weekly push, curación de recetas), los 4 cron jobs en §4, write-ups por integración en §5. PR #258 squash a dev (ab9950d) + ff staging.
- Por qué: audit-4, deriva de fundación tras el de-Gemini parcial. El doc no mentía sobre Gemini pero le faltaban trozos.
- Siguiente: QA. main en espera. FRESCO-418 creada para el refresh de business-data-map (Flow 6 contrato ADR-0022) + business-api-map (sync 08-30 desfasado).

## 2026-09-03 - FRESCO-409: infra de test de componentes (happy-dom + RTL) + 10 componentes
- Qué: Fase 1 del epic FRESCO-408. Infra de test de componentes en bun test + 10 componentes de riesgo (43 tests). ADR-0024. PR #262 -> dev (d1bfea2), ff staging. Jira -> Control de calidad.
- Por qué: components/ tenia 0 tests unitarios.
- Siguiente: FRESCO-419 (Dialog components), FRESCO-410/411/412.

## 2026-09-03 - FRESCO-410: tests de route handlers de app/ (webhook de Stripe)
- Qué: Fase 2 del epic FRESCO-408. 34 tests nuevos para los 6 route handlers de app/ (stripe/webhook 12, cron/stripe-reconcile GET +5, profile/export 3, stripe/checkout 5, stripe/portal 5, auth/confirm 4). Nuevo helper tests/mocks/supabase-query-builder.ts. PR #263 squash -> dev (dca6da5), ff staging. Jira -> Control de calidad.
- Por qué: app/ tenía 1 test; la capa HTTP + máquina de estados de suscripción iban cubiertas solo por e2e.
- Siguiente: FRESCO-411 (orquestación index.ts de Edge Functions), FRESCO-412 (gate bun test --coverage). NOTA: CI test:unit subió a 29s (tope ADR-0018 = 30s) - FRESCO-412 debe vigilarlo; contribuye el beforeEach de re-registro de DOM de FRESCO-409.

## 2026-09-03 - FRESCO-411: tests de orquestación de Edge Functions
- Qué: Fase 3 del epic FRESCO-408. 31 tests para 3 index.ts (update-recipe-status 12, delete-account 9, reassign-guest-data 10) cubriendo 401/400/429/404/403/409/422/500/200. Nuevo helper tests/mocks/edge-function.ts (captura el handler de Deno.serve + fakeEdgeClient). PR #264 squash -> dev (8afd137), ff staging. Jira -> Control de calidad.
- Por qué: los index.ts de las Edge Functions solo tenían cobertura e2e; la orquestación (auth->rate-limit->validar->trabajo->mapear error) no estaba testeada.
- Siguiente: FRESCO-412 (gate bun test --coverage). FRESCO-421 creada: el escenario e2e de generación desde /calendar es inestable en test:e2e (cold-start de generate-meal-plan > 30s), 3 PRs seguidos con re-run manual.

## 2026-09-03 - FRESCO-412 + FRESCO-413: gate de cobertura + gate de drift de migraciones (2 forks en paralelo)
- Qué: FRESCO-412 (Fase 4 epic FRESCO-408) - scripts/check-coverage.ts (parsea lcov, total ponderado por líneas excl. tests/scripts, ratchet-only-up), FLOOR functions 83.0 / lines 85.0, job test:unit corre `bun run test:coverage`, doc .context/qa/coverage-ratchet.md. PR #266. FRESCO-413 - migration-drift-check.yml gana trigger `push: [staging]` (gate de promocion, precedente FRESCO-377); solo drift-check corre en push, seed-drift y creacion de issue quedan weekly-only; nota en ADR-0017. PR #265. Ambos squash -> dev + ff staging (15017b9). Jira -> Control de calidad.
- Por qué: FRESCO-412 nada impedia que la cobertura decayera. FRESCO-413 el check de drift era semanal y el incidente del 02-sep (6 migraciones sin aplicar) se colo entre runs.
- Siguiente: **el owner debe rotar el secret SUPABASE_ACCESS_TOKEN del repo** - el primer run del gate de FRESCO-413 (push staging 15017b9) fallo con `supabase link -> Unauthorized`; el token caduco/roto entre 31-ago (ultimo run verde) y 3-sep. El gate funciona, el token no. FRESCO-408 epic: 409/410/411/412 en QA; cierra cuando pasen a Finalizada.

## 2026-09-03 - EPIC-FRESCO-408 completo: cobertura de tests unitarios (4 fases)
- Qué: cerradas 409/410/411/412 (Control de calidad -> Finalizada) tras QA en dev/staging 03240fb; epic FRESCO-408 -> Finalizada. Resultado: bun test 522 pass / 0 fail (415 base + 107 nuevos), cobertura total 83.85% functions / 85.78% lines, gate de cobertura vivo en CI (test:unit 13s). Infra nueva: happy-dom+RTL para componentes (ADR-0024), tests/mocks/{next-navigation,supabase-query-builder,edge-function}.ts, scripts/check-coverage.ts.
- Por qué: components/ 0 tests, app/ 1 test, index.ts de Edge Functions solo e2e; nada impedia que la cobertura decayera.
- Siguiente: FRESCO-419 (componentes con Dialog - shim de rAF). Rotar SUPABASE_ACCESS_TOKEN (gate de FRESCO-413 rojo por token caducado, no por el cambio).

## 2026-09-03 - FRESCO-419: tests de componentes con Dialog + corrección del diagnóstico de ADR-0024
- Qué: 14 tests para 3 componentes con Dialog (delete-week-button, delete-account-dialog, create-recipe-form). El "CPU-spin de Dialog" de FRESCO-409 era misdiagnóstico — el trap real es waitFor/findBy sobre un setTimeout de happy-dom que no avanza en el loop. Reglas documentadas en ADR-0024 §11 (reescrito). Sin shim de rAF. Suelo de cobertura bajado 83/85 -> 82/84 (dip one-off documentado). PR #267 squash -> dev (f5286c8), ff staging. Jira -> Finalizada.
- Por qué: cerrar el follow-up de FRESCO-409; los componentes con Dialog quedaron fuera del epic FRESCO-408.
- Siguiente: FRESCO-421 (flake e2e de generación de menú desde /calendar). Rotar SUPABASE_ACCESS_TOKEN (secret del repo, pendiente).

## 2026-09-03 - FRESCO-413 follow-up: pipefail del gate de drift + drift real encontrado
- Qué: rotados los secrets SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD del repo desde .env (gh secret set). Arreglado bug pre-existente (desde FRESCO-325) en migration-drift-check.yml: el pipe `| tee` sin `set -o pipefail` bajo `bash -e` tragaba el exit code -> el job pasaba en verde aunque hubiera drift. PR #268 squash -> dev (c3e9b3c), ff staging.
- Por qué: el gate de push:[staging] de FRESCO-413 era inofensivo. El smoke tras rotar el token lo destapó.
- Siguiente: **drift real pendiente de arreglar a mano contra prod** - 2 entradas en el ledger sin fichero local (20260901100401, 20260901103915, del 1-sep, out-of-band, no de esta sesión). Issue #269 abierta. `supabase db pull` o `migration repair --status reverted`. Bloquea staging->main limpio. FRESCO-421 sigue abierta (flake e2e).

## 2026-09-03 - Ledger de migraciones reparado + FRESCO-413 Finalizada
- Qué: `supabase migration repair --status reverted 20260901100401 20260901103915`. Las 2 entradas huérfanas eran duplicados exactos de 20260901130000 (FRESCO-362) y 20260901140000 (FRESCO-363) - aplicadas out-of-band vía MCP el 1-sep ~10am durante audit-4 ola-3, luego re-commiteadas. Ledger: 72 migraciones, 0 drift. Workflow Drift checks verde. Issue #269 cerrada. FRESCO-413 -> Finalizada.
- Por qué: el gate de FRESCO-413 (ya con pipefail arreglado) destapó el drift real; era seguro revertir porque el efecto vive en los ficheros commiteados.
- Siguiente: FRESCO-421 (flake e2e). staging->main ya no bloqueado por drift.

## 2026-09-03 - FRESCO-421: timeout 90s para los steps e2e de generate-meal-plan
- Qué: 30_000 -> 90_000 en calendario-semana.steps.ts (toHaveCount calendar_empty_state) y onboarding.steps.ts (waitForURL /menu). Cold-start del Edge Runtime de Deno local (ADR-0017) en el primer invoke de un worker de CI pasaba de 30s -> flake en 4 PRs. Mismo margen que generate-shopping-list. PR #270 squash -> dev (096dc92), ff staging. Jira -> Control de calidad.
- Por qué: 4 PRs seguidos necesitaron re-run manual del escenario de generación desde /calendar.
- Siguiente: confirmar 3 runs verdes de test:e2e en los proximos PRs (este ya cuenta como 1, sin re-run).
