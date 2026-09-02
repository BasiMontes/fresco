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
