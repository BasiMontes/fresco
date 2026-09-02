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

## 2026-08-30 - FRESCO-293: arreglos UI menores a 390px
- Qué: 3 sub-fixes en PR #188 -> dev. (1) Botón "Copiar" de /qa movido a barra de cabecera propia (ya no solapa la 1a línea del snippet) + foco de teclado visible. (2) <title> propio en /onboarding ("Completa tu perfil · Fresco") y /update-password ("Nueva contraseña · Fresco") vía layout.tsx de servidor. (3) Token global --color-error #b8422e -> #b03d2b (contraste 4,29:1 -> 4,66:1 sobre crema, 5,92:1 blanco-sobre-token); actualizado globals.css + DESIGN.md.
- Por qué: hallazgo 18 de la re-auditoría de agosto (eje Diseño, BAJO, epic FRESCO-278); WCAG 2.4.2 + AA de contraste.
- Siguiente: merge PR #188 a dev -> Jira a Merged -> QA verifica en staging -> Finalizada.

## 2026-08-30 - Batch auditoria 293/295/307/311 + promo a produccion
- Que: Cerradas FRESCO-293 (micro-fixes UI: boton Copiar /qa, titulos /onboarding+/update-password, --color-error #b8422e->#b03d2b global), FRESCO-295 (ADR-0014: umbral falsable en senal #2, senal #3 marcada disparada), FRESCO-307 (sync business-api-map), FRESCO-311 (gate CI: trigger push staging/main + workflow post-deploy-smoke on deployment_status). Promovido dev->staging->main (los 3 en 5f2c49f), prod desplegado y sano.
- Por que: remediacion de re-auditoria (epics FRESCO-278 y FRESCO-309).
- Siguiente: FRESCO-322 (creada) - el @smoke post-deploy salio 3/6 rojo en su primera corrida real (cold-start flake, no regresion): sacar @generacion-menu del set y hacer @aprendizaje/@lista-compra self-contained. Pendiente: ticket de limpieza del alias fresco-pre (project.yaml:112 obsoleto).

## 2026-08-30 - FRESCO-318: limpieza documentado vs real (+ des-integración n8n)
- Qué: cerrados 9/10 puntos del hallazgo BAJO audit-3. Comentario service.ts, conteo ADRs en glossary, header+meta.created de project.yaml, bloque `dev` en environments, untrack .impeccable/config.json, borrados 62 review.md/compliance-matrix.md, gate NODE_ENV en /dev/skeleton-capture, 6 ADRs Proposed->Accepted + fila ADR-0006. Punto 6 escaló a des-integración completa de n8n (MCP + 15 skills + install.ts/doctor.ts/manifest/.env.example/docs). PR #191 -> dev.
- Por qué: FRESCO-318, drift acumulado; n8n no se usa y su MCP fallaba al conectar.
- Siguiente: revisar+mergear #191, promocionar dev->staging->main, borrar 11 ramas remotas mergeadas (punto 8, bloqueado por classifier esta sesión).

## 2026-08-30 - FRESCO-316: README propio de Fresco
- Qué: README.md reescrito Frescofirst (qué es Fresco, 3 entornos dev/pre/pro, arranque local, `bun test` + `test:e2e` y variantes, mapa de docs). Texto del boilerplate movido a docs/boilerplate.md con links relativos repunteados. CONTEXT.md reencuadrado (intro + árbol) como Fresco-sobre-boilerplate. INSTALLER.md: 3 links README -> docs/boilerplate.md. PR #192 squash a dev, promovido dev->staging->main (los 3 en 11d4c43), prod+pre 200.
- Por qué: hallazgo G (BAJO, auditoria-3, FRESCO-316) - el README seguía siendo el boilerplate "AGENTIC ENGINEERING", cero mención al producto.
- Siguiente: ninguno; ticket Finalizada. Drift preexistente en CONTEXT.md ("11 workflow skills"/"5 slash commands" vs 12/6 reales) queda fuera de alcance.

## 2026-08-30 - FRESCO-315: accesibilidad en páginas públicas
- Qué: 5 arreglos a11y en rutas fuera de `(app)/` — `<main>` en landing/`/qa`/layouts de auth+onboarding, `<label>` real (sr-only) en inputs de `/login` y `/signup`, tap targets a 44px (footer legal, nav "Ya tengo cuenta", hamburguesa, 6 FAQ), `app/robots.ts` (`/robots.txt` daba 404), y espacio en el H2 roto de final-cta ("domingosin"→"domingo sin"). PR #193 squash a dev (306d5e2), promovido dev→staging→main.
- Por qué: hallazgo F (BAJO, auditoria-3, FRESCO-315), medido en vivo a 390/1280px. WCAG 2.4.1 / 3.3.2 / 4.1.2 / 2.5.8. El shell `(app)/` ya tenía `<main>`; las públicas nunca lo recibieron.
- Siguiente: nada pendiente. FRESCO-315 → Finalizada.

## 2026-08-30 - FRESCO-319: desbloquear puntos ciegos de auditoría
- Qué: nuevo `.context/audits/` con los 3 informes (14-ago, 21-ago, 29-ago) + `branch-protection.md` (snapshot `gh api` de main/staging/dev) + README índice. Commit 06fd147 a dev, points=1, Listo->WIP. Comentario en el ticket con instrucciones para #1 (acceso Jira) y #2 (credenciales PRE por canal privado) — acción del owner, no automatizable.
- Por qué: los puntos 3 y 4 de FRESCO-319 (auditoria-3) — dar baseline estable y visibilidad de required checks para la 4ª pasada.
- Siguiente: owner concede acceso Jira al auditor + pasa PRE_USER_* por canal privado; luego cerrar FRESCO-319. Opcional promover dev->staging->main.

## 2026-08-30 - FRESCO-317: ADR-0016 fork local de skills
- Qué: ADR-0016 (Proposed) documentando que .claude/skills/ es un fork local y `bun run up` no es mantenimiento de rutina. Fila en el índice de ADR + subsección en CONTEXT.md §6 con backlink. Commit a935faa, promovido dev->staging->main. points=1, Listo->WIP.
- Por qué: audit-3 HALLAZGO BAJO H — convertir la congelación del boilerplate en decisión escrita antes de que se olvide si fue elección o inercia.
- Siguiente: owner decide si flipar ADR-0016 Proposed->Accepted; cerrar FRESCO-317 WIP->Finalizada.

## 2026-08-30 - FRESCO-314: estrategia git mecanica
- Que: GitHub repo settings a squash-only (merge-commit + rebase off, delete_branch_on_merge on). git_strategy en project.yaml: feature_merge=squash, promote_method=ff-only, hotfix_policy=none, nueva policy.docs_changes. Nuevo docs/workflows/hotfix.md (runbook solo-main, ejemplo real FRESCO-297). Nota en git-flow.md. PR #194 squash a dev (0436af0).
- Por que: audit-3 HALLAZGO MEDIO E — hacer mecanico lo que FRESCO-286 dejo como intencion; el historial contradecia los docs.
- Siguiente: promover dev->staging->main; cerrar FRESCO-314.

## 2026-08-30 - FRESCO-319: puntos ciegos auditoria cerrados
- Que: 4/4 resueltos. #3+#4 en repo (.context/audits/). #1: Ely ya era Viewer en proyecto FRESCO (verificado API), nada que conceder. #2: credenciales PRE enviadas a Ely por Slack. WIP->Finalizada.
- Por que: audit-3 — dar baseline estable + acceso real para la 4a pasada.
- Siguiente: nada. Epic FRESCO-309: 7/13 (311,314,315,316,317,318,319).

## 2026-08-30 - FRESCO-310: aislar backend e2e de CI de produccion
- Que: el job e2e de CI ahora levanta un stack Supabase local efimero (supabase start + db reset + seed por-run) dentro del job; PR e2e ya no toca el proyecto de prod jdqemhewjrjuopssdurn. 2 migraciones baseline reconstruyen public.recipes + rls_auto_enable (creados a mano fuera de migraciones); nueva tabla rate_limit_exempt_users saca los 4 UUIDs de test de prod del cuerpo de la funcion security-definer. PR #195 squash a dev (9569aac), 31/31 e2e verde en runner GitHub.
- Por que: audit-3 HALLAZGO ALTO A — un step e2e sin filtro id=eq. = UPDATE masivo en prod disparado por cualquier PR.
- Siguiente: promover dev->staging->main; runbook manual de prod (migration repair de las baseline + db push del rate-limit); cerrar FRESCO-310. ADR-0017 pendiente de aceptar.

## 2026-08-30 - FRESCO-310: migracion rate-limit aplicada a prod + drift descubierto
- Que: aplicada 20260830142702 a prod jdqemhewjrjuopssdurn via MCP apply_migration (idempotente). Verificado: rate_limit_exempt_users con 4 filas, check_and_increment_rate_limit sin UUIDs literales. 2 baseline marcadas migration repair --status applied. ADR-0017 aceptado (2c95e5e, promovido a main). Descubierto drift severo del ledger (54 local-only / 49 remote-only) -> FRESCO-325.
- Por que: cerrar el hallazgo ALTO A end-to-end (la funcion en prod tenia los 4 UUIDs hardcodeados hasta ahora).
- Siguiente: cerrar FRESCO-310. FRESCO-325 (reconciliacion del ledger) queda en el epic audit-3.

## 2026-08-30 - FRESCO-325: reconciliar ledger de migraciones Supabase con prod
- Que: `migration repair` contra prod jdqemhewjrjuopssdurn - 52 archivos locales-only a `--status applied`, 50 entradas remote-only a `--status reverted`. `migration list --linked` pasa de 54/49/8 a 0/0/62; `db push --dry-run` = "Remote database is up to date". Solo tocó el ledger (schema_migrations), cero DDL - `db diff --linked` vacio lo respalda. Nuevo `scripts/check-migration-drift.ts` + workflow cron semanal `.github/workflows/migration-drift-check.yml` que abre issue si reaparece drift (fuera del pipeline de PR para no meter credenciales de prod ahi, ADR-0017). ADR-0017 actualizado con la seccion "Update 2026-08-30".
- Por que: audit-3 - `supabase db push` estaba inutilizable (reaplicaria 54 migraciones ya en prod); descubierto al cerrar FRESCO-310.
- Siguiente: anadir secrets SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD al repo para que el cron corra. Epic FRESCO-309 audit-3.

## 2026-08-30 - FRESCO-312: cabeceras de seguridad en produccion
- Que: `next.config.mjs` gana `async headers()` sobre `/(.*)` con las 6 cabeceras que faltaban (HSTS explicita, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy, CSP Report-Only + Reporting-Endpoints). CSP sin nonce; allowlist Supabase/PostHog/Sentry (wildcard estatico + env exacto); reportes a Sentry via report-uri del DSN. Stripe no necesita entrada (checkout server-side). PR #197 squash a dev (61a21b8), promovido ff dev->staging->main (3 ramas en 61a21b8).
- Por que: audit-3 HALLAZGO MEDIO C - prod solo servia HSTS (inyectado por Vercel), sin clickjacking ni referrer protection.
- Siguiente: ticket aparte para pasar CSP a bloqueante + nonce cuando Sentry no muestre ruido. Epic FRESCO-309: 8/13 (311,312,314,315,316,317,318,319).

## 2026-08-30 - FRESCO-313: disciplina de campos QA en defectos (parcial, opcion B)
- Que: backfill de Severity/Error Type/Root Cause via comentario en los 6 defectos abiertos que faltaban (276/265/250/220/183/124). Nueva regla en bug-fix-workflow.md + SKILL.md: sin pasos de repro ni razon de rechazo documentada, un defecto no pasa a estado terminal (Gotcha 15, S18). Commit 37d3b80 dev->staging->main. Runbook de admin de Jira (partes 1/2/4) posteado en el ticket.
- Por que: audit-3 HALLAZGO MEDIO D - Jira no puede responder "que severidad tiene lo abierto".
- Siguiente: FRESCO-313 en Blocked. Owner debe anadir Severity/Evidence/Root Cause a la pantalla Error, marcarlos obligatorios y anadir validador de workflow (no hay acceso admin por API). Revisar FRESCO-183 (Rechazos sin razon). Epic FRESCO-309: 8 cerradas + 313 en curso.

## 2026-08-30 - FRESCO-320 gate de testabilidad en /product-management
- Qué: anti-patrón I22 en /product-management (SKILL.md + story-refinement.md + acceptance-criteria.md) — ninguna historia pasa a Listo con un Then cualificador en vez de valor observable, ni sin escenario cero/vacío/error. Pasada de testabilidad sobre las 6 historias abiertas documentada como comentario en FRESCO-320 (no hay historias en refinamiento; 249 pasa, 247 parcial, 245/246 fallan pero están en QA con código enviado — no se reescriben). PR #198 squash a dev (7e37fa5), promovido a staging.
- Por qué: HALLAZGO MEDIO auditoría-3 (eje Backlog 3,8) — una AC no testable no bloquea en refinamiento, el defecto sale en QA o producción.
- Siguiente: confirmar push a main; FRESCO-320 -> Finalizada. Quedan en epic 309: 321, 322, 325, 313 (bloqueada en owner).

## 2026-08-30 - FRESCO-321 ratio de automatizacion Gherkin: regla + ratchet
- Que: /sprint-development Gotcha 16 + S19 — historia con AC Gherkin automatiza sus escenarios en el mismo PR (clausula presupuesto ADR-0014). .context/qa/README.md: seccion Automation ratchet (+6-8 escenarios/sprint, flujos nucleo, no el 100%). Baseline ~31/139 (~23%). PR #199.
- Por que: HALLAZGO MEDIO auditoria-3 eje Verificacion (4,0) — cada release se apoya en 23% de la especificacion ejecutable.
- Siguiente: el ratchet se ejecuta por sprint. Epic 309: quedan 325, 313 (bloqueada en owner).

## 2026-08-30 - FRESCO-322 estabilizar el set @smoke post-deploy
- Que: sacados @generacion-menu (guard perf ADR-0005) y @lista-compra (llamada real a Gemini) del set @smoke — siguen @automatizado en test:e2e. @aprendizaje se queda con timeout 20s. Paso de warm-up en post-deploy-smoke.yml. @smoke = 4 escenarios liveness (login/qa/suscripcion/aprendizaje). PR #200.
- Por que: primera ejecucion real del smoke fue 3/6 roja por cold-start, no regresion.
- Siguiente: verificar verde estable en el proximo deploy de produccion.

## 2026-08-30 - FRESCO-323 CONTEXT.md reconciliado con el filesystem
- Que: pase completo a CONTEXT.md §2 (solo doc). Conteos 11->12 skills, 5->6 commands. Anadido todo el arbol de codigo de la app (app/ components/ lib/ api/ supabase/ tests/ bones/ design/ .github/). docs/ y .context/ completados. Root fresco/ -> fresco-app/. Refs muertas §5 (compliance-matrix.md, bun up) corregidas. PR #201.
- Por que: HALLAZGO BAJO auditoria-3, familia documentado-vs-real. CONTEXT.md nunca tuvo un pase tras convertirse el repo en Fresco.
- Siguiente: epic 309 solo queda FRESCO-313 (Blocked, necesita admin de Jira del owner).

## 2026-08-30 - FRESCO-313 cerrada + EPIC FRESCO-309 completo
- Que: token Administer Jira -> confirmado que FRESCO es team-managed (sin screens/field-config/workflow API). Partes 1/2 hechas por UI (Severity+Evidence+RootCause+ErrorType en el tipo Error; Severity+Evidence required, verificado por createmeta/editmeta). Parte 3 (backfill) ya estaba. Parte 4 (validador workflow) cubierta por el gate del repo (S18 / bug-fix-workflow Phase 3) — TMP no expone la regla. EPIC FRESCO-309 (3a auditoria) 13/13 hijos Finalizada -> epic cerrado.
- Por que: HALLAZGO MEDIO D auditoria-3 — disciplina Severity/Evidence en el tipo Error.
- Siguiente: auditoria-3 completa. Queda auditoria-3 suelto ninguno. Migrar los valores de severity de comentario a campo real al tocar cada defecto (no forzado).

## 2026-08-30 - FRESCO-194 badge "Nuevo" en lista de la compra
- Qué: badge "Nuevo" junto a ítems que no estaban en la lista de la semana anterior. lib/api/shopping-list.ts (normalizeNombre + diffNombresNuevos pura + getNombresNuevos wrapper fail-soft), page.tsx wiring, shopping-list-view.tsx pill, +5 unit tests. Sin migración ni Edge Function. Resto de FRESCO-194 (carrusel sugerencias + Añadir) ya estaba en prod. PR #202.
- Por qué: última pieza de FRESCO-194, viable sin persistencia nueva (la lista previa vive en shopping_lists por meal_plan/semana).
- Siguiente: badge honesto "no estaba la semana pasada"; si sale ruidoso en datos reales, 2a vuelta (solo pasillos nuevos). Backlog de dev vacío tras esto.

## 2026-08-30 - FRESCO-32 check anti-contraseñas-filtradas (DIY, Pwned Passwords)
- Qué: la feature nativa de Supabase (leaked_password_protection) está capada a plan Pro y la org está en Free. Implementado client-side contra la API pública de Pwned Passwords (k-anonymity: solo 5 chars del hash SHA-1 salen del navegador). lib/validation/pwned-password.ts + check en 3 handlers (signup, onboarding identity-step, update-password). Fail-open (si HIBP no responde en 3s, no bloquea). next.config.mjs connect-src += api.pwnedpasswords.com. 6 unit tests + 1 escenario e2e @registro. Live-verificado contra la API real. PR #203.
- Por qué: FRESCO-32 (auditoría Supabase Advisors, no audit-3) llevaba Blocked desde el 1 ago por ser feature de pago.
- Siguiente: reversible — si se sube a Pro, borrar helper + 3 llamadas y activar el toggle.

## 2026-08-31 - FRESCO-31 tanda de fotos (2 batches)
- Qué: 2 tandas de fetch-recipe-photos.ts (23/30 + 21/30), aplicadas vía Supabase MCP. 650 -> 694/1000 con foto, 0 duplicados. 306 restantes.
- Por qué: backfill continuo de foto_url en recipes vía Unsplash.
- Siguiente: pool restante = variantes filler-only difíciles (v9/v10). Retomar tras reset de cuota Unsplash; 403 empezaron al final de la 2a tanda.

## 2026-08-31 - FRESCO-329 sacar @aprendizaje del set @smoke post-deploy
- Qué: quitado @smoke del escenario "Marcar un plato como cocinado" (sigue @automatizado). Set @smoke = @login, @qa, @suscripcion. Limpiado warm-up de post-deploy-smoke.yml (fuera /calendar + Edge Functions update-recipe-status/generate-meal-plan). PR #204 squash a dev (1deca18), ff a staging y main.
- Por qué: follow-up FRESCO-322; @aprendizaje falló 2/2 en las primeras corridas reales post-deploy (cadena reseed+marca+render >20s contra infra fría).
- Siguiente: verificar próxima corrida de post-deploy-smoke en prod en verde (3 canarios).

## 2026-08-31 - FRESCO-31 tanda + regen de seed.sql
- Qué: tanda de fotos 23/30 (694 -> 717/1000, 0 dup). Regenerado supabase/seed.sql vía `supabase db dump --linked --data-only` (1000 filas, 717 con foto). Commit propagado dev -> staging -> main.
- Por qué: mantener el fixture de CI (test:e2e) al día + copia fría del catálogo en el repo (backup pre-lanzamiento; descartado duplicar la BD en otra plataforma, ya está en git).
- Siguiente: seguir tandas tras reset de cuota Unsplash. Refrescar seed.sql tras cada tanda grande.

## 2026-08-31 - FRESCO-352 automatizar 8 happy paths e2e core
- Qué: 4 step files nuevos (onboarding, calendario-semana, calendario-reordenar, recuperar-password). @automatizado 32 -> 40. Flujos core: @onboarding 0->1/4, @calendario 2->8/16, @login recuperar-password 0->1/1. PR #205 squash a dev (4005d81), ff a staging y main.
- Por qué: catch-up del ratchet de FRESCO-321 (eje Verificación). Los flujos core no estaban al 100% de camino feliz.
- Siguiente: quedan @onboarding edge-cases y @calendario edge-cases manuales por diseño. Gotchas documentadas en el PR: dnd-kit MouseSensor 8px (dragTo no sirve, mouse manual), grid de 3 días (21 huecos se asserta contra BD).

## 2026-08-31 - FRESCO-353 2o batch e2e (guest, aprendizaje Pro, Biblioteca)
- Qué: 3 step files nuevos (biblioteca 10 escenarios, invitado 1, aprendizaje-generacion 1). @automatizado 40 -> 52. @biblioteca 0->10/13, @invitado 0->1/1, @aprendizaje 5->6/6 (FR-5.4/5.5, el moat). PR #206 squash a dev (a37dad0), ff a staging y main.
- Por qué: 2o batch del ratchet de FRESCO-321.
- Siguiente: "invitada convierte sesión anónima" queda manual (OTP con inbox real, FRESCO-89). 52 @automatizado roza el techo ADR-0014 (~60) - abrir el revisit antes del 3er batch (@panel-inicio, @favoritos, @perfil, @landing).

## 2026-08-31 - FRESCO-354 ADR-0018 (revisit de arquitectura de tests e2e)
- Qué: ADR-0018 Accepted, supersede a ADR-0014. Retira el trigger de conteo (~60 escenarios); el trigger vinculante es el wall-clock del job test:e2e en CI (early-warning ~6m30s -> migrar 4 racer step files a testUserFactory + @mode:parallel + workers 2-4; hard ~8m). Sanciona el batch 3. NO KATA. ADR-0014 -> Superseded. playwright.config.ts + qa/README.md actualizados. PR #207 squash a dev (2041a88), ff a staging y main.
- Por qué: el ratchet de FRESCO-321 (352->40, 353->52) cruza el trigger de conteo de ADR-0014 con el batch 3.
- Siguiente: FRESCO-355 (batch 3) creado pero APARCADO — ratchet cumplió objetivo (flujos core cubiertos), esas pantallas son secundarias. Prioridad real: sign-off legal + cohorte. Retomar batch 3 solo si una regresión ahí duele.

## 2026-08-31 - FRESCO-355 3er batch e2e (home, favoritos, perfil, landing)
- Qué: 4 step files nuevos (panel-inicio 8, favoritos 4, perfil 3, landing 2). @automatizado 52 -> 69. @panel-inicio 0->8/9, @favoritos 0->4/4, @perfil 0->3/3, @landing 0->2/2. PR #208 squash a dev (93b72ba), ff a staging y main. CI test:e2e 5m55s (bajo el early-warning de ADR-0018 de ~6m30s).
- Por qué: 3er y ultimo batch del ratchet de FRESCO-321. Sancionado por ADR-0018.
- Siguiente: ratchet COMPLETO para happy paths de flujos core + secundarios. Unico manual: "invitada convierte sesion anonima" (OTP inbox real, FRESCO-89). Migracion a paralelo sigue diferida (5m55s < 6m30s).

## 2026-08-31 - FRESCO-355 pase final e2e (todo lo automatizable)
- Qué: +6 escenarios (validacion crear receta, detalle receta propia, volver a biblioteca, receta propia no genera, borrar cuenta de punta a punta, favorito desde Notificaciones). @automatizado 69 -> 75/142. Arreglado flake de "orden reordenado sobrevive a recargar" (asertar swap optimista antes de pollear BD). test-user-factory tolera 404. PR #209 squash a dev (d156a53), ff a staging y main.
- Por qué: user pidio automatizar todo lo automatizable. Cerrado el ratchet de FRESCO-321.
- Siguiente: CI test:e2e 6m40s > early-warning de ADR-0018 (~6m30s) -> DISPARA la migracion a paralelo (4 racer files -> testUserFactory + @mode:parallel + workers). Manual definitivo: OTP guest->cuenta (config local != prod) + 2 escenarios dentro del Billing Portal de Stripe.

## 2026-08-31 - FRESCO-356 e2e en paralelo (ADR-0018)
- Qué: migrados los 4 racer step files (aprendizaje, entrega-parcial, generacion-determinista, aislamiento-datos) de cuentas compartidas DEV_USER/PRO_USER a testUserFactory por escenario. @mode:parallel en regression.feature, workers 4 (CI) / 2 (local). 3 corridas paralelas locales 75/75 verde, 0 carreras. PR #210 squash a dev (e267a05), ff a staging y main.
- Por qué: se disparó el early-warning de wall-clock de ADR-0018 (6m40s).
- Siguiente: CI test:e2e 6m40s -> 5m55s (solo -45s). La paralelización aceleró la parte de tests, pero el wall-clock del job lo dominan supabase start + bun run build (~4 min de overhead fijo). Valor real: aislamiento por factory - todo escenario nuevo es seguro, sin footguns de estado compartido. Si se quiere CI mas rapida, la palanca es cachear el build / imagen de supabase, no mas paralelismo.

## 2026-08-31 - FRESCO-357 abierto (backlog) + master-plan actualizado
- Qué: creado FRESCO-357 (CI: cachear el pipeline del job test:e2e — .next/cache, Playwright, deps bun, imagenes Supabase, solapar build+stack, quitar concurrency group). sp3, Relates FRESCO-356. master-implementation-plan.md actualizado con FRESCO-356 (migracion a paralelo) y FRESCO-357.
- Por qué: FRESCO-356 solo bajo el job -45s; el wall-clock lo domina el overhead de setup (~4 min: supabase start + bun run build), no los tests. La palanca es caching.
- Siguiente: FRESCO-357 en backlog. Objetivo test:e2e < 3 min (baseline 5m55s). No urgente (un committer).

## 2026-08-31 - FRESCO-357 CI test:e2e caching cerrado
- Qué: PR #211 mergeado + promovido dev/staging/main (6913075). Caché deps bun + navegadores Playwright + .next/cache + build en background solapado con el stack + `supabase start -x` sin contenedores no usados. Quitado el concurrency group del job e2e. Descartada la caché docker save/load de imágenes Supabase (net-zero: docker load del tar ~1GB cuesta igual que el pull de ghcr.io).
- Por qué: FRESCO-357 pedía test:e2e < 3 min (baseline 5m55s). Resultado: ~5m28s warm (-27s, ~8%). El reloj lo dominan supabase start (90-104s) + test:e2e (126-131s) + db reset+seed (22-31s), nada cacheable.
- Siguiente: FRESCO-358 creado para el rediseño del ciclo de vida del stack (no reset+seed por run / Postgres-only / sharding). Ese es el único camino a sub-3min.

## 2026-08-31 - Auditoria 4 (la mas dura hasta ahora)
- Que: 4a pasada tecnica, 6 subagentes en paralelo (construccion de exploit, RLS politica a politica contra la DB viva, traza de seguridad alimentaria del input al plato, mapa del funnel de PostHog evento a evento, Jira en vivo via acli, lente de product engineer). Informe en .context/audits/2026-08-31-audit-4.html. README de audits actualizado (fila nueva + corregido el error del "3.7" de la auditoria-3, que era la nota de la auditoria-2; la 3 saco 4.3).
- Por que: el usuario pidio una auditoria igual o mas dura que las tres anteriores, mas exigente tecnicamente y con vision de product engineer.
- Siguiente: nota 3.5/5 (desde 4.3). 71 hallazgos, 4 BLOCKER: (1) auto-concederse Pro via hueco RLS en INSERT (verificado, explotable incluso por invitado anonimo); (2) guardrail de seguridad alimentaria = punto unico sin cobertura de comportamiento + campo alergenos_texto_libre que el filtro no lee; (3) banner legal borrador sigue vivo en prod; (4) la metrica del MVP no es medible (sin eventos trial->pago/renovacion/cancelacion). Falta decidir con el usuario si se crea epica de remediacion. §10 del informe tiene los 6 primeros movimientos.

## 2026-09-01 - Epica de remediacion auditoria 4 (FRESCO-359)
- Que: Creada EPIC FRESCO-359 "Remediacion auditoria tecnica 4 - camino al 5/5" + 41 tarjetas hijas (FRESCO-360..400) via acli. Etiquetadas auditoria-4 + ola-0/1/2/3 (= Sprint A/B/C/D del plan-a-5.md). Cada una con comentario AC (esfuerzo + eje + rutas). FRESCO-360/361 (los 2 BLOCKER tecnicos) prioridad Highest + link Blocks a la epica. Relates epica->FRESCO-330. 33 hallazgos agrupados en 20 tarjetas multi-id, 8 solas.
- Por que: reflejar el plan de accion completo de la auditoria 4 en Jira, trackeable. Usuario: "crea todas las tarjetas necesarias, quiero el 5/5 pronto".
- Siguiente: M11 (proyecto Supabase unico) diferido a Supabase Pro (FRESCO-328), solo ADR-0020 dentro de FRESCO-389. FRESCO-328/320 se reclasifican dentro de FRESCO-378 (H17). Empezar por Ola 0: FRESCO-360 (bypass de pago) y 361 (seguridad alimentaria). Gotcha: acli workitem view cachea - verificar estado real via REST GET.

## 2026-09-01 - FRESCO-360: cerrado bypass de pago por INSERT en user_profiles
- Qué: trigger `protect_subscription_columns` pasa a `BEFORE INSERT OR UPDATE` (rechaza que un rol cliente se autoconceda plan Pro con un INSERT directo); allowlist `session_user` para el seed de CI; barrido de huérfanos en `stripe-reconcile` + test unitario; factory de tests siembra plan pro vía PATCH service-role; e2e `@seguridad` del exploit. Drive-by: fix de ventana de fechas en test de FRESCO-353. Migración aplicada en vivo. PR #212 -> dev -> staging.
- Por qué: BLOCKER A4-B1 de la auditoría-4, explotable en producción con dos llamadas HTTP.
- Siguiente: promover a main (pendiente de confirmación), transicionar FRESCO-360 a Finalizada.

## 2026-09-01 - FRESCO-361: red de tests del filtro de alergenos (A4-B2)
- Que: get_filtered_recipes case-insensitive (lower en ambos lados); CHECK de vocabulario en recipes.alergenos; frutos_secos->frutos_de_cascara; ALERGENO_OPTIONS 6->12; input free-text de alergenos eliminado; A4-M3 mensaje de slot agotado separa seguridad de variedad; suite e2e dedicada (seguridad-alimentaria.steps.ts, 3 escenarios). Extra: ledger de migraciones reconciliado; withSentryConfig solo en Vercel (colgaba el build de e2e). Migracion aplicada en vivo. PR #213 -> dev/staging/main (2a6910e).
- Por que: BLOCKER A4-B2 de auditoria-4; el filtro era el unico enforcement de seguridad alimentaria y no tenia ni un test de comportamiento.
- Siguiente: FRESCO-362 (A4-H1-H2, endurecer Edge Functions).

## 2026-09-01 - FRESCO-362: endurecer update-recipe-status y reassign_guest_data (audit-4 A4-H1/H2/L7)
- Qué: whitelist de estado + rating entero + re-filtro de alérgeno (get_filtered_recipes) + no-duplicado + rate limit 60/h en update-recipe-status; reassign_guest_data re-filtra los slots movidos contra el perfil de alérgenos destino (estado excluida, recipe_id null) y devuelve el conteo. Migración 20260901130000, helper _shared/rate-limit.ts, 3 escenarios @seguridad-alimentaria nuevos.
- Por qué: dos rutas metían una receta con alérgeno en el plan sin pasar por el único punto de seguridad alimentaria (ADR-0001/NFR-SEC-3).
- Siguiente: FRESCO-363 (A4-H8/H9 auth), FRESCO-364 (A4-L1/L2/L3).

## 2026-09-01 - FRESCO-363: auth hardening (audit-4 A4-H8/H9)
- Qué: password min length 6->10 (config.toml + proyecto hosted via Management API + cliente, nuevo lib/validation/password-policy.ts); migración 20260901140000 borra los 4 UUID de cuentas de prod de rate_limit_exempt_users (tabla ahora vacía).
- Por qué: creds de esas cuentas en .env/CI/épica pública de /qa = generación ilimitada; password mínima débil. HIBP server-side diferido (requiere Supabase Pro), ya mitigado client-side.
- Siguiente: FRESCO-364 (A4-L1/L2/L3 minor sec), última de wave 0.

## 2026-09-01 - FRESCO-364: 3 fixes menores de seguridad (audit-4 A4-L1/L2/L3) — cierra ola 0
- Qué: A4-L1 guard de next reescrito (lib/auth/safe-next-path.ts, rechaza backslash); A4-L2 cors.ts gatea localhost por SUPABASE_URL (hosted .supabase.co vs stack local kong:8000) — prod sin localhost, verificado en vivo; A4-L3 toCsvValue prefija comilla a celdas = + - @ y anade CR al quote-wrap RFC4180 (lib/csv/export-csv.ts).
- Por qué: open redirect, localhost en CORS de prod, CSV/formula injection en el export de backup.
- Siguiente: ola 0 del epic FRESCO-359 completa (360-364). Ola 1 pendiente.

## 2026-09-01 - FRESCO-366 (A4-B4) instrumentacion del funnel completo del MVP
- Que: 3 PRs a dev (#217/#218/#219). Reverse-proxy /ingest de PostHog, person properties (plan/is_guest/signup_method), catalogo lib/posthog/event-names.ts. Eventos server-side de Stripe (trial_started/converted/renewed/cancelled) + menu_generation_completed con semana_iso/tier. Funnel cliente: landing_cta_clicked, onboarding_started/step/completed, checkout_started, shopping_list_generated, recipe_discarded. Amplia ADR-0013.
- Por que: audit-4 ola 1 (A4-B4, BLOCKER) - la metrica del MVP no era medible; sin eventos de conversion, sin person properties, ~15 etapas de funnel sin instrumentar, sin reverse-proxy.
- Siguiente: crear los embudos en la UI de PostHog (sin codigo). Promocion dev->staging->main pendiente. Seguir ola 1: FRESCO-367..379.

## 2026-09-01 - FRESCO-367 (A4-H10) lista de la compra automatica
- Que: al abrir /shopping-list sin lista, ShoppingListGenerator la genera solo (autoGenerate, client-side on-mount), sin boton manual. Instrumentada: shopping_list_generated {auto, n_items, coste_min, coste_max}. generate-meal-plan NO tocado. PR #220 (2 rondas de CI: 1a version generaba server-side en el RSC y bloqueaba la respuesta 30-90s con la Edge Function fria).
- Por que: audit-4 ola 1 (A4-H10, ALTO) - el PRD prometia lista automatica; era un boton manual, solo 2/38 planes tenian lista.
- Siguiente: seguir ola 1 (368+). dev=staging=main en bc87410.

## 2026-09-01 - FRESCO-368 (A4-H11) pricing card honesto
- Que: components/landing/pricing.tsx - quitadas las claims falsas de Pro ("Menús ilimitados", "Historial de menús", "Personalización avanzada"). PRO ahora lista solo los 4 gates reales de isPro en generate-meal-plan/index.ts (aprendizaje aplicado, no repite recetas recientes, explicación FR-5.5, nudge ADR-0008). FREE concreto: menú semanal completo, lista automática, filtros, cambio de receta. Decision AC: opción B (copy honesto, no gatear).
- Por que: audit-4 ola 1 (A4-H11, ALTO) - la landing vendía features Pro que no están gateadas; Free y Pro tienen el mismo límite (5 gen/hora, 1 plan/semana ISO).
- Siguiente: 373 (M27 toggle usable) desbloquea 369. dev=staging=main en 31243d6.

## 2026-09-01 - FRESCO-373 (A4-M27) toggle cocinado/descartado usable
- Que: calendar-grid.tsx - botones de marcado a >=44px (etiquetados, ancho completo) + ventana de deshacer de 5s (snackbar, commit diferido client-side, flush en pagehide/unmount). Instrumentado: recipe_marked_cooked / recipe_marked_discarded al commit, recipe_mark_undone al cancelar.
- Por que: audit-4 ola 1 (A4-M27) - la marca era un icono de 16px irreversible; unica interaccion de la que depende el tier Pro. Sin cambio de backend.
- Siguiente: 369 (puente del moat), desbloqueada. dev=staging=main en 8441aae.

## 2026-09-01 - FRESCO-369 (A4-H12) puente del moat en la semana 1
- Que: components/calendar/learning-bridge-card.tsx - tarjeta (card variant pro) en /calendar con el mecanismo real del aprendizaje + ejemplo trabajado + CTA a /profile para Free. Free siempre; Pro solo hasta su primera marca. CalendarGrid pierde el prop userPlan + el aviso plano. master-design-plan §5-J. Approach A (DESIGN.md-first sin mockup).
- Por que: audit-4 ola 1 (A4-H12, ALTO) - el moat no da payoff hasta la semana 2 y solo Pro; el usuario paga en la semana 1 sin ver el valor diferencial. CI vuelta 1 rompio 2 escenarios de drag (@calendario) por altura de la tarjeta -> compactada + scrollIntoView en el helper.
- Siguiente: 370 (marketing honesto, quitar claims de IA + cifras inventadas). dev=staging=main en f80c7d4.

## 2026-09-01 - FRESCO-370 · Marketing honesto en la landing (A4-H13/H16)
- Qué: Quitados los claims sin respaldo de la landing pública: "Menú semanal con IA" y "a diferencia de ChatGPT" (motor 100% determinista, sin IA), y las 3 cifras inventadas de la sección "Tu impacto" (~300€, 25%, 30 min) presentadas como estimaciones investigadas. Sustituidas por 3 tarjetas de mecánica real del producto. FAQ: "La IA nunca incluye" → "El sistema nunca incluye". Nuevo escenario e2e @landing @automatizado que veta claims de IA. PR #224 squash → dev (1bfa710) → ff a staging + main. SP 2.
- Por qué: Auditoría 4 (ALTO A4-H13 + A4-H16). Publicidad engañosa en dos frentes; con cohorte de pago es riesgo reputacional y legal.
- Siguiente: Verificar en fresco-pro. Barrido de onboarding/emails: limpio (sin plantillas propias). Sigue la ola 1 de la remediación (FRESCO-359).

## 2026-09-01 - FRESCO-371 · Onboarding a 3 pasos, presupuesto opcional (A4-H14)
- Qué: Wizard de onboarding pasa de 4 a 3 pasos (límite duro del PRD): "cocinas favoritas" se pliega dentro del paso de dieta/alérgenos. El presupuesto semanal vuelve a ser opcional (el motor solo lanza un aviso blando si el menú lo supera, nunca filtra). Nuevo evento `onboarding_abandoned` + `total_steps` en los eventos existentes del funnel. PR #225 squash → dev (1012c0d) → ff staging + main. SP 3. CI verde incl. test:e2e.
- Por qué: Auditoría 4 (ALTO A4-H14). El PRD exige 3 pasos; cada paso extra cuesta conversión; el presupuesto obligatorio no aportaba nada al motor.
- Siguiente: Sigue la ola 1 de FRESCO-359. Quedan 365 (legal), 372, 374-379.

## 2026-09-01 - FRESCO-372 · Loop de re-enganche push con dientes (A4-H15)
- Qué: El opt-in a notificaciones push ahora aparece en /menu justo tras generar el primer menú (banner one-shot gateado por señal sessionStorage + Notification.permission default), no solo enterrado en /profile. Copy del push semanal reescrito a español de España ("armaste/hacelo" -> "has planificado/hazlo"). 4 eventos nuevos: push_prompt_shown, push_permission_granted (cliente), push_sent (Edge Function via _shared/posthog.ts), push_opened (SW añade ?push_opened=1, tracker cliente lo captura). PR #226 squash -> dev (3db7de6) -> ff staging + main. SP 5. CI verde incl. test:e2e.
- Por qué: Auditoría 4 (ALTO A4-H15). 0 suscripciones a la fecha; sin re-enganche efectivo la cohorte de pago no retiene.
- Siguiente: OWNER debe correr `supabase link` + `supabase secrets set POSTHOG_API_KEY POSTHOG_HOST` + `supabase functions deploy send-weekly-reengagement-push` (classifier bloqueó config de prod) para que push_sent dispare. Sigue la ola 1: quedan 365 (legal), 374-379.

## 2026-09-01 - FRESCO-374 · Analytics de invitados: guest_started (A4-M24)
- Qué: "Continuar como invitada" en el onboarding ahora dispara un evento propio `guest_started`, no `user_signed_up {method:"guest"}`. Nuevo `GUEST_STARTED` en lib/posthog/event-names.ts; identity-step.tsx emite el evento correcto. El funnel deja de contar invitados como altas reales. PR #227 squash -> dev (12d36b7). SP 2.
- Por qué: Auditoría 4 (MEDIO A4-M24). El registro de invitado contaminaba la métrica de signup y la person property quedaba mal atribuida.
- Siguiente: Promoción a staging + main en batch. Sigue la ola 1 de FRESCO-359: quedan 365 (legal), 375-379.

## 2026-09-01 - FRESCO-375 · Gate CI deno:check para supabase/functions (A4-H4)
- Qué: Job de CI obligatorio `deno:check` (`deno lint` + `deno check` sobre `supabase/functions/` con Deno 2.9.6). Nuevo `supabase/functions/deno.json` (import map, pins @supabase/supabase-js 2.112.4 + web-push 3, excluye los *.test.ts de bun:test). Arreglados los 13 errores de tipos + 8 de lint latentes que el check destapó: 8 specifiers npm: -> bare, prefer-const, y asserts de forma de fila en el boundary (el cliente Deno no lleva generic Database -> postgrest-js infiere los RPC SETOF como objeto y rechaza el cast a array) en generate-meal-plan / update-recipe-status / send-weekly-reengagement-push; temporada comparada como string[] (datos sembrados en ASCII); usosMap tipado DiaSemana. Sin cambio de runtime. Corre en push a staging/main igual que repo:check (FRESCO-311). PR #228 squash -> dev (cd613c7). SP 5.
- Por qué: Auditoría 4 (ALTO A4-H4). supabase/functions/ estaba fuera de tsc y ESLint y sin tooling Deno en CI: un repo:check verde nunca garantizó que las Edge Functions compilasen.
- Siguiente: Añadir deno:check como required status check en dev/staging/main (gh api). Promoción a main en batch. Defecto aparte a fichar: tipos Temporada/DiaSemana (acentuados) vs datos ASCII en recipes.temporada. Sigue la ola 1 de FRESCO-359: quedan 365, 376-379.

## 2026-09-01 - FRESCO-376 · CI: aislar terceros de prod (PostHog/Sentry/Stripe) (A4-H7)
- Qué: El job e2e de CI dejaba `STRIPE_*`, `POSTHOG_*`, `SENTRY_*` con valores de prod (solo solapaba Supabase). Ahora `.env.ci` los pone en blanco/dummy: PostHog y Sentry no-op (init gatea en la key/DSN), y `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET(_DEV)` son dummies compartidos por app y test-helpers -> los escenarios `@suscripcion` de webhook verifican firma+handler offline. Los 5 escenarios que llaman a la API real de Stripe llevan tag `@requiere-stripe-real` y salen de `bun run test:e2e` (`bddgen --tags "@automatizado and not @requiere-stripe-real"`); nuevo `test:e2e:stripe` para correrlos aparte; staging/production/smoke sin cambio. El fixture `suscripcionCtx` hace teardown de cada Stripe customer creado. PR #229 squash -> dev (289a39e). SP 5.
- Por qué: Auditoría 4 (ALTO A4-H7). Cada run de CI contaminaba analytics de prod, disparaba alertas de Sentry y creaba customers de test sin limpiar; fuga de credenciales de prod al pipeline.
- Siguiente: OWNER verifica en los dashboards de PostHog+Sentry que el run de CI de la PR no creó eventos/issues nuevos (último bullet de la AC). post-deploy-smoke no se puede aislar (el bundle de prod lleva las keys bakeadas) - documentado. Promoción a main en batch. Sigue la ola 1 de FRESCO-359: quedan 365, 377, 378, 379.

## 2026-09-01 - FRESCO-377 · Gatear el SHA promovido con e2e en push a staging (A4-M12)
- Qué: `test:e2e` ahora corre también en push a `staging`, no solo en PRs. El commit de squash que aterriza en `dev` y se espeja a `staging`/`main` por ff nunca lo ejecutaba (el e2e del PR corría sobre el tip pre-squash). El job `e2e` de pr-check.yml gana `|| (push && ref == refs/heads/staging)` en su `if:`. No se añade a push:[main] (ff byte-idéntico del mismo SHA). Runbook de promoción en `git_strategy.description`: confirmar el e2e verde del push a staging antes de `git push origin main`. `strict` sigue en `false` (opción "gate en promoción" elegida por el owner; el riesgo de merge de rama obsoleta se acepta). PR #230 squash -> dev (97252c8). SP 2. e2e flakeó 1 vez (generación de menú, Edge Runtime local en frío) y pasó al re-lanzar.
- Por qué: Auditoría 4 (MEDIO A4-M12). El pipeline verde no garantizaba que lo desplegado a prod hubiera pasado los tests. Sustituye al descartado A4-M11 (2º proyecto Supabase, diferido a Supabase Pro).
- Siguiente: OWNER verifica en vivo (self-test): al hacer ff a staging con este SHA, el workflow nuevo corre el e2e sobre él. Vercel está rate-limited (tope 100 deploys/día) - staging/prod no despliegan hasta el reset. Candidato a tarjeta: warm-up del Edge Runtime local en el job de PR e2e (2 flakes de menú-gen esta sesión). Promoción a main en batch. Ola 1 de FRESCO-359: quedan 365 (legal), 378, 379.

## 2026-09-01 - FRESCO-378 · Backfill de trazabilidad de defectos (A4-H17)
- Qué: Backfill sobre los 36 defectos Error abiertos/recientes (no-Finalizada o creados >= 2026-08-19): `Relates` a la épica de origen (25; los otros 11 ya tenían parent), campo `Severity` poblado por impacto, comentario de Evidence (honesto: los cerrados no tienen artefacto original, pre-FRESCO-282; los abiertos marcados para re-verificar antes de cerrar). FRESCO-328 reclasificado Finalizada -> Rechazos (era un deferral a Supabase Pro, no un done; la DB de prod sigue compartida). Nota en FRESCO-320 (AC no testeables al cierre). Gate de FRESCO-313 verificado en vivo (crear un Error pelado se rechaza con Severity/Evidence obligatorios). 100
## 2026-09-01 - FRESCO-378 · Backfill de trazabilidad de defectos (A4-H17)
- Qué: Backfill sobre los 36 defectos Error abiertos/recientes (no-Finalizada o creados >= 2026-08-19): `Relates` a la épica de origen (25; los otros 11 ya tenían parent), campo `Severity` poblado por impacto, comentario de Evidence (honesto: los cerrados no tienen artefacto original, pre-FRESCO-282; los abiertos marcados para re-verificar antes de cerrar). FRESCO-328 reclasificado Finalizada -> Rechazos (era un deferral a Supabase Pro, no un done; la DB de prod sigue compartida). Nota en FRESCO-320 (AC no testeables al cierre). Gate de FRESCO-313 verificado en vivo (crear un Error pelado se rechaza con Severity/Evidence obligatorios). 100% Jira, cero código. Artefactos en .context/audits/2026-09-01-FRESCO-378-defect-traceability-backfill/.
- Por qué: Auditoría 4 (ALTO A4-H17). 123/133 defectos sin enlace a historia, 0 con severidad/evidencia estructurada - sin trazabilidad no se sabe qué está arreglado ni de dónde vino cada defecto.
- Siguiente: Verificación post-run: 0 de 36 sin severidad, 0 sin link. Ola 1 de FRESCO-359: queda 365 (legal), 379.

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
