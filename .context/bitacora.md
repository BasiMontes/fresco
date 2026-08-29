# Bitácora — Fresco

Log append-only. Cada iteración relevante suma entrada abajo: qué hecho, por qué, qué sigue. IA lee esto primero para contexto rápido en sesión nueva — no re-derivar todo desde cero. Nunca reescribir entrada vieja, solo agregar.

Formato entrada: fecha — título corto. Qué / Por qué / Siguiente.

**Rotación**: al superar 50 entradas, archivar (`mv` a `bitacora-<rango>.md`) y arrancar este archivo de nuevo con las últimas ~15 entradas (Regla 15, CLAUDE.md).

Historia anterior a 2026-08-27 (383 entradas, 2026-07-25 → 2026-08-27) archivada en `.context/bitacora-2026-07-to-2026-08.md`.

---

## 2026-08-27 - Barrido de cabos sueltos post-sesión
- Qué: PR #166 (glosario "one ADR"->13, texto obsoleto alias fresco-pre/pro en /qa) mergeado+promovido. PR #167 (FRESCO-266 + gap re-auditoría #2): suite unit cableada -- script test, hook pre-push, job test:unit blocking en CI (verde Linux); stub posthog-js + NEXT_PUBLIC en bun-test-setup.ts; CI e2e pasa a next build+start. PR #149 cerrado (superseded). Regen de business-data-map + business-api-map: subagente en marcha (PR pendiente).
- Por qué: el usuario pidio cerrar todos los pendientes que quedaban del barrido de fin de sesion.
- Siguiente (bloqueado en el usuario): actualizar secrets.ENV_FILE de GitHub con los nombres nuevos de test-user (CI e2e da 28/31 hasta entonces) -> luego flip test:e2e a blocking + required_status_checks en dev/staging/main (cierra gap #1). Tambien: .env.example, Vercel _PROD scope, review PR #118.

## 2026-08-27 - FRESCO-243 rate limiting: rehabilitado y mergeado (PR #168)
- Qué: PR #118 estaba 136 commits detras y su migracion nunca aplicada (mergearlo habria roto generate-meal-plan con 500). Rebase sobre dev, migracion re-datada 20260823180000->20260827210808 y APLICADA a Supabase (rate_limits + check_and_increment_rate_limit + cron cleanup-expired-rate-limits verificados). Anadido barrido de retencion pg_cron (diario 03:15, poda ventanas >2h). ADR-0010 Proposed->Accepted. Reconciliados domain-glossary.md (13->14 ADRs) y non-functional-requirements.md NFR-SEC-6. PR #168 mergeado, promovido dev->staging->main (b896b81). #118 cerrado.
- Por que: el usuario pidio el pase completo de /sprint-development para desatascar la deuda.
- Siguiente: la Edge Function generate-meal-plan sigue en la version 24 (SIN el check de rate-limit) -- hay que DESPLEGARLA para activar el rate limiting. La migracion y el codigo ya estan; solo falta el deploy de la funcion (mcp deploy_edge_function o supabase functions deploy generate-meal-plan).

## 2026-08-27 - Discovery gaps de PR #169: acciones
- Qué: (1) delete-catalog-recipe DESPLEGADA (v1, ADR-0005 FRESCO-237 — estaba en repo + UI pero sin desplegar); OJO: falta el secret ADMIN_USER_ID en el runtime de la Edge Function -> devuelve 403 a todo hasta que se ponga. (2) PR #170: borrado lib/urls.ts (codigo muerto, 0 imports desde el scaffold), migracion 20260827212133 DROP de user_profiles.centro_avisos_* (drift, sin migracion) + meal_plans.completado (vestigial) -- aplicada, types regenerados (tambien recogen rate_limits de #168). (3) Jira FRESCO-301 (reconciliacion Stripe) + FRESCO-302 (de-scope Gemini en PRD/SRS), ambos hijos de FRESCO-278. snack en el enum tipo_plato: anotado, no tocado. Promovido dev->staging->main (cda7678).
- Por que: cerrar los gaps verificables del regen de mapas.
- Siguiente (usuario): poner ADMIN_USER_ID en secrets de Supabase (bunx supabase secrets set ADMIN_USER_ID=<uid-founder>). GEMINI_API_KEY sigue en secrets pero sin uso (ADR-0005) - limpieza menor.

## 2026-08-27 - Gap ALTO #1 cerrado: required_status_checks
- Qué: secret ENV_FILE de GitHub actualizado con los nombres nuevos de test-user. PR #171 quitó continue-on-error del job e2e (su CI: test:e2e PASS con el secret nuevo, prod build). Mergeado + promovido (318d0c0). Branch protection en dev/staging/main: required_status_checks = [repo:check, test:unit, test:e2e], preservando lo existente (dev: PR review 0 approvals; todas: no force-push, no deletions). enforce_admins=false -> el owner sigue pudiendo hacer el ff-promote dev->staging->main; PRs de flujo normal quedan bloqueados si un check está rojo.
- Por qué: re-auditoría hallazgo 01 (ALTO) — todos los checks eran advisory.
- Siguiente: n/a para este gap. Pendientes de sesión: ADMIN_USER_ID en secrets Supabase, deploy generate-meal-plan, review PR #169.

## 2026-08-27 - delete-catalog-recipe activada (ADMIN_USER_ID)
- Qué: no había cuenta de admin en auth.users. El usuario creó hola.frescoapp+admin@gmail.com (UID 3174e4d5-b4d6-4be9-968a-2372a52337b0). ADMIN_USER_ID puesto en secrets de la Edge Function + delete-catalog-recipe redesplegada (v2). Smoke test: 401 sin auth / 401 JWT inválido (routing OK).
- Por qué: gap de PR #169 — la función estaba desplegada pero el allowlist vacío devolvía 403 a todo.
- Siguiente: verificar el flujo completo de borrado desde /admin/recipes con la cuenta admin (requiere la contraseña, la tiene el usuario).

## 2026-08-28 - FRESCO-243 rate limiting ACTIVO
- Qué: generate-meal-plan desplegada (v26) con el check de rate-limit 5/hora/usuario. Pillado y arreglado: la suite e2e (blocking) hace ~12 llamadas/corrida -> habria dado 429 en cada PR. Migracion 20260827215620 (aplicada): check_and_increment_rate_limit exime los 4 UIDs de cuentas de test (array hardcoded, tech-debt anotado en ADR-0010). PR #172 mergeado -- su test:e2e PASO con el limite vivo + exencion. Promovido dev->staging->main (fdd0a4d).
- Por qué: cerrar el ultimo paso de FRESCO-243 (deploy) tras el rehab de #168.
- Siguiente: QA. FRESCO-243 -> Merged.

## 2026-08-28 - Mapas de negocio regenerados (PR #173)
- Qué: business-data-map + business-api-map reconstruidos desde el código actual (subagente #169, rebased + reconciliado contra los ~19 commits posteriores). Gemini fuera del narrativo (ADR-0005), rate_limits documentado como infra viva, columnas borradas quitadas, gaps de delete-catalog-recipe/lib/urls resueltos, reconciliación Stripe enlazada a FRESCO-301, 5 marcadores Stub del template eliminados. business-feature-map sin tocar (ya bueno). #169 cerrado, PR #173 mergeado + promovido (4b9589a).
- Por qué: los mapas estaban congelados en 2026-07-25 con premisa "no hay código aún" (re-auditoría MEDIO Fundación).
- Siguiente: FRESCO-302 (de-scope Gemini en PRD/SRS) sigue pendiente - los mapas ya están, PRD/SRS no.

## 2026-08-28 - FRESCO-301 job de reconciliación Stripe (deploy 3 envs)
- Qué: nueva ruta `GET /api/cron/stripe-reconcile` + helper `resolveReconciledState` en `lib/stripe.ts` + migración `20260828174500` que agenda `pg_cron`+`pg_net` diario (04:17 UTC) contra la URL de prod. ADR-0015 (Proposed). PR #174 mergeado a dev, ff-promote a staging y main (commit 45a0a95), 3 deploys Vercel READY (HTTP 200; la ruta responde 500 "no configurado" hasta que exista CRON_SECRET). Jira FRESCO-301 -> Merged, story points 2.
- Por qué: ADR-0007 deja el webhook como único escritor del estado de suscripción; un webhook perdido desincroniza `user_profiles` de Stripe de forma silenciosa. Ruta Next (no Edge Function) para reutilizar los helpers testeados de `lib/stripe.ts` en vez de duplicarlos en Deno.
- Siguiente: activación manual (comentada en el ticket) - (1) `CRON_SECRET` en Vercel scope Production, (2) `vault.create_secret(..., 'stripe_reconcile_cron_secret', ...)` en Supabase con el mismo valor, (3) aplicar la migración al proyecto compartido. Hasta el paso 3 el job no está agendado.

## 2026-08-28 - FRESCO-301 activado (cron Stripe reconciliation LIVE)
- Qué: completada la activación manual - CRON_SECRET en los 3 scopes de Vercel, secreto `stripe_reconcile_cron_secret` en Supabase Vault, migración `20260828174500` aplicada (cron.job id 7, `17 4 * * *`, active), prod redeployed. Verificado end-to-end: el SQL exacto del cron (`net.http_get` + secreto de Vault) devuelve `200 {"checked":1,"reconciled":0,"drifted":[]}`. `checked:1` = hay 1 fila con `stripe_subscription_id` y Stripe coincide con la DB.
- Por qué: cerrar FRESCO-301 - el job de reconciliación ya corre a diario, el estado de suscripción deja de poder desincronizarse de Stripe de forma indetectable.
- Siguiente: nada bloqueante. La versión de la migración en remoto se ajustó a `20260828174500` para casar con el archivo local (MCP apply_migration la había grabado con su propio timestamp). `.env.example` sigue sin CRON_SECRET ni seccion Stripe - pendiente del cleanup de .env.example.

## 2026-08-28 - FRESCO-285 contraste WCAG AA del token de texto atenuado
- Qué: 8 archivos, `text-neutral-500` (`#a39372`, ~2,5:1 como texto) -> `text-tertiary` (`#6f5f43`, AA-safe). Landing (hero, how-it-works eyebrow, impact-stats caption, final-cta, learns-pro badges) + `ui/dropdown` + placeholders de `ui/input` y `create-recipe-form`. Sin tocar el token ni DESIGN.md - la rampa `neutral-*` queda para bordes/iconos. PR #175 -> dev -> staging -> main (09f07d9). Live-UI verificado en dev server local (3 capturas). FRESCO-285 -> Merged, parent EPIC-278, Relates FRESCO-299, evidencia adjunta.
- Por qué: re-auditoria ago 2026 hallazgo 07 (MEDIO). FRESCO-299 solo oscurecio `--color-tertiary`; `neutral-500` como texto quedo sin tocar.
- Siguiente: fuera de scope y anotado - chevron FAQ + iconos `neutral-400` (decorativos, exentos); `✓` de pricing con `neutral-600` (`#847456`, otro token, glifo casi decorativo) candidato a ticket aparte.

## 2026-08-28 - FRESCO-303 contraste del ✓ en pricing (Free)
- Qué: `components/landing/pricing.tsx` - variante no destacada de `PlanFeature`: `text-neutral-600` (`#847456`, ~3,6:1 sobre `bg-neutral-200`) -> `text-tertiary` (`#6f5f43`, ~4,6:1). Una línea. PR #176 -> dev -> staging -> main (f616974). Live-UI verificado. FRESCO-303 (tipo Error, Low, parent EPIC-278, Relates FRESCO-285) -> Merged.
- Por qué: hallazgo lateral durante FRESCO-285 - otro token (`neutral-600`) que FRESCO-299 dejó sin tocar a propósito.
- Siguiente: nada. Cierra la serie de contraste de la re-auditoría (283, 299, 285, 303).

## 2026-08-28 - FRESCO-279 verificado y cerrado: required status checks
- Qué: el grueso ya estaba (PR #171, 27 ago). Verificación en vivo: PR #177 vs dev con test:unit rojo a propósito -> mergeStateStatus=BLOCKED, `gh pr merge` rechazado ("base branch policy prohibits the merge"). PR cerrado + rama borrada sin mergear. Comentario con evidencia en Jira; FRESCO-279 -> Finalizada.
- Por qué: re-auditoría hallazgo 01 (ALTO), paso 3 del plan (verificar bloqueo real) faltaba; ticket seguía en Listo sin enlazar al trabajo.
- Siguiente: rama local test/FRESCO-279-verify-required-checks quedó sin borrar (permiso denegado) — borrado manual trivial.

## 2026-08-28 - FRESCO-288 accesibilidad: áreas táctiles footer auth + checkbox signup
- Qué: FRESCO-267 subió a 24x24px el footer de landing + FAQ pero dejó fuera el footer del layout de auth (legal-links.tsx) y el checkbox de consentimiento de /signup. legal-links.tsx: inline-block py-1.5 en los 3 botones. signup/page.tsx: <input> envuelto en span size-6 centrado, checkbox visual sigue size-4, cursor-pointer al label. Verificado a 390px (Playwright): footer ~26,3px alto, checkbox target 26,4x26,4. PR #178 -> dev -> ff staging -> ff main (250c17a). Jira -> Finalizada.
- Por qué: re-auditoría hallazgo 10 (MEDIO), eje Diseño. Regresión de cobertura WCAG 2.5.8.
- Siguiente: n/a. OJO cabo suelto: el sync dejó un fichero mal ubicado .context/PBI/defects/DEFECT-FRESCO-288-.../defects/DEFECT-FRESCO-267-...md (defects/ anidado) que ya se mergeó a main — limpieza menor.

## 2026-08-28 - FRESCO-280 + FRESCO-290 (re-auditoria)
- Qué: FRESCO-280 (e2e bloqueante + unit tests en CI) ya estaba hecho (PR #167 cableó test:unit + e2e blocking, PR #171 quitó continue-on-error residual, FRESCO-279 los hizo required, PR #149 cerrado superseded) -> comentario evidencia + Finalizada. FRESCO-290 (contexto/planificación): (1) re-sync completo del cache PBI vía jira:sync-issues jql (e16b980, 108 nuevos + 244 actualizados); (2) master-implementation-plan.md UPDATE + epic-tree.md +FRESCO-244/278 (86de990); (3) review.md + compliance-matrix.md RETIRADOS del flujo /sprint-development, ahora solo en el PR (1c7cf21, editados SKILL.md + review-pr.md + spec-compliance-matrix.md + topic-key-conventions.md + .context/README.md); (4) Story Points a las 6 historias abiertas (245:5 246:5 247:3 249:2 274:2 275:3 = 20 pts). Promocionado dev->staging->main ff-only, 3 ramas en 86de990. Ambos -> Finalizada.
- Por qué: re-auditoría hallazgos 02 (ALTO), 12 y 13 (MEDIO).
- Siguiente: gaps detectados por el subagente de planes, no accionados: epic-tree status drift (jira:sync-issues pull), FRESCO-278 no en dev-roadmap, master-design-plan.md ausente (FRESCO-294), PRD/SRS Gemini (FRESCO-302), business-feature-map.md regen pendiente.

## 2026-08-29 - FRESCO-304/305/306 + 294/302 (re-auditoría, hijos de FRESCO-278)
- Qué: 5 tickets de contexto/planificación, 3 en paralelo (worktrees) + 2 más. (304) `jira:sync-issues pull` reconcilió deriva de status en epic-tree.md (227 + 7 historias -> Finalizada). (305) `/dev-roadmap` añadió EPIC-278 + 24 hijos (cluster plano, sin links reales). (306) regen completa de business-feature-map.md (61->86 features, todos los epics de agosto). (294) creado master-design-plan.md retroactivo (20 pantallas, 43 historias en §8, 9 divergencias ratificadas) + Regla 14 suavizada (fila §8 ausente = LIVE-UI-FIRST fallback, no hard-STOP). (302) SRS de-scopeado de Gemini per ADR-0005 (diagrama Mermaid, FR-2/4/5/8, NFR-PERF/SEC/REL, api-contracts con banners SUPERSEDED; PRD sin cambios). Commits 1511869/2e3a23f/b31d411/5653c72/f5f7b03/3aaf5dd en dev.
- Por qué: re-auditoría hallazgos 06/12/13/15, gaps detectados en FRESCO-290.
- Siguiente: promover dev->staging->main; enlazar FRESCO-273/274/275 (_orphans) a EPIC-64; business-api-map + business-data-map con ~1 dia de retraso (delete-catalog-recipe, FRESCO-301).

## 2026-08-29 - FRESCO-286/287/289/291/292 (re-auditoría, 5 agentes en paralelo)
- Qué: 5 tickets BAJO/MEDIO de la re-auditoría, uno por agente en worktree propio, ramas contra dev. (286) `.agents/project.yaml` git_strategy `enterprise`->`solo-main`, alineado a la práctica real (single-maintainer, direct-push mayoritario). (287) `.agents/README.md` documenta que los alias de `jira-workflows.json` son shorthand local sobre los 7 estados reales de Jira (Listo/WIP/Control de calidad/Merged/Blocked/Rechazos/Finalizada) — no estados distintos; renombrar el board/workflow "KAN" queda como follow-up manual (fuera de alcance de acli/MCP). (289) `concurrency` group `e2e-shared-supabase-backend` (cancel-in-progress:false) en el job e2e de pr-check.yml para serializar runs contra el único proyecto Supabase compartido. (291) `bitacora.md` rotado: histórico a `bitacora-2026-07-to-2026-08.md` (383 entradas), nuevo `bitacora.md` con índice + últimas 15. (292) retries CI en playwright.config.ts (trace-on-first-retry ahora dispara), tag muerto `@no-implementado` fuera de regression.feature; el hallazgo de ADR-0010 ya estaba resuelto (FRESCO-243 mergeado antes de tocar el ticket) -> sin cambio, documentado. PRs #179-183 mergeados a dev (squash), Jira: los 5 -> Finalizada.
- Por qué: cierre de otro bloque de hijos de EPIC-FRESCO-278 (re-auditoría 27 ago).
- Siguiente: gotcha de CI descubierto en vivo -- el concurrency group de 289 no hace cola FIFO: cuando dos runs quedan en espera (no arrancados) en el mismo group, GitHub cancela los más viejos y deja solo el más nuevo ("Canceling since a higher priority waiting request exists"); con 5 PRs empujando casi a la vez, 3 de los 5 e2e se cancelaron una o dos veces y hubo que esperar a que la cola se vaciara + reintentar (`gh run rerun`). Si se vuelve a lanzar un lote grande de PRs en paralelo, contar con esto. Pendiente: promover dev->staging->main (no hecho aún, a la espera de confirmación); 2 ramas locales squash-mergeadas (fix/FRESCO-289-*, fix/FRESCO-292-*) sin borrar (permiso denegado, borrado manual trivial).

## 2026-08-29 - FRESCO-308 (E2E data factories)
- Qué: PR #185 (commit 78ea171) mergeado a dev. Nueva `tests/test-user-factory.ts` (factory de usuarios efímeros vía GoTrue admin API, teardown garantizado por fixture, ON DELETE CASCADE verificado). 4 step files migrados de cuentas compartidas `DEV/PRO_USER_EMAIL` a usuario propio por escenario. Jira -> Finalizada.
- Por qué: fix de raíz del race del backend Supabase compartido — FRESCO-289 solo lo serializó con `concurrency`. Race producía RLS 403 / 500 "Error guardando el plan" / timeouts de shopping-list en vivo.
- Siguiente: la 310 (Supabase local en CI) elimina la escritura a producción que la factory todavía hace; los usuarios `hola.frescoapp+e2e-*` huérfanos (si el teardown falla) desaparecen entonces.
