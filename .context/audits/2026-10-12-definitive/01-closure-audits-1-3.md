# Cierre de las auditorías 1, 2 y 3 (verificación contra el código a 2026-10-12)

Base: rama `perf/FRESCO-906-exclude-sharp` (HEAD `43c363e3`, árbol limpio). Fuentes leídas: `README.md`, `audit-process.md`, `2026-08-14-audit-1-initial.html`, `2026-08-21-audit-2-reauditoria.html`, `2026-08-29-audit-3.html`. Criterio: el código/config/CI actual manda; Jira (consultado en solo lectura con `acli`) solo se usa para medir relleno de campos, que no existe en el repo.

## 1. Resumen

| Clase | A1 | A2 | A3 | Total |
|---|---|---|---|---|
| RESUELTO | 8 | 14 | 18 | 40 |
| PARCIAL | 0 | 4 | 4 | 8 |
| NO RESUELTO | 1 | 0 | 1 | 2 |
| REGRESIÓN | 0 | 0 | 0 | 0 |
| NO VERIFICABLE | 1 | 0 | 0 | 1 |
| Total hallazgos | 10 | 18 | 23 | 51 |

Notas de método: A3 tiene hallazgos con subpuntos (accesibilidad 6a-e, desajustes 9a-k); se cuentan por subpunto. Las puntuaciones de las tres auditorías no son comparables entre sí (ver `README.md`); aquí solo se mide cierre.

## 2. Evidencia clave transversal

- Protección de ramas (comando en vivo, `gh api .../branches/{main,staging,dev}/protection`): las tres exigen `repo:check, test:unit, test:e2e, test:db-integration, deno:check`; `strict:false`, `enforce_admins:false`.
- Ajustes del repo (`gh api repos/BasiMontes/fresco`): `allow_squash_merge=true`, `allow_merge_commit=false`, `allow_rebase_merge=false`, `delete_branch_on_merge=true`.
- Jira (acli, JQL `--count`): 874 items en FRESCO; 161 Error. Error con Severity 63, Root Cause 16, Error Type 24, Evidence 28. ATP (cf10191) = 0 y ATR (cf10177) = 0 sobre los 874. Story Points 123 (25 de 215 historias creadas desde 2026-09-01). Errores creados desde 2026-09-01: 28, todos con Severity.

## 3. Auditoría 1 (14-ago, informal, 4,7)

| ID | Sev. | Hallazgo | Clase | Evidencia |
|---|---|---|---|---|
| A1-01 | Alto | Sin CI; la suite no protege nada | RESUELTO | `.github/workflows/pr-check.yml` (jobs repo-check, unit, deno, db-integration, e2e) + required checks en las 3 ramas (comando anterior). Última ejecución de `pr-check` en main/staging: success. |
| A1-02 | Medio | Cobertura declarada vs ejecutada (18 %) | RESUELTO | `.context/qa/regression.feature`: 193 escenarios, 142 etiquetas `@automatizado` (~74 %), 3 `@pendiente`, 2 `@no-implementado`. Unit: `scripts/check-coverage.ts` con suelo ratchet en CI (`pr-check.yml` job unit). |
| A1-03 | Medio | Boilerplate congelado | RESUELTO | `.template/boilerplate.lock.json` (schemaVersion 7, `templateCommit` 7ede94e7), `.template/last-apply.json`; ADR-0016 superado por ADR-0038/0039 (decisión escrita). |
| A1-04 | Bajo | Áreas táctiles < 24 px (menú, FAQ, footer) | RESUELTO | `components/landing/site-nav.tsx:170` (`min-h/min-w-[44px]`), `components/landing/faq.tsx:26` (`min-h-[44px]`), `components/legal/legal-links.tsx` (`py-3`, FRESCO-478). |
| A1-05 | Bajo | `/qa`: bloques de código desbordan sin señal | RESUELTO | `components/qa/scroll-fade-wrapper.tsx`, `components/qa/code-block.tsx`. |
| A1-06 | Bajo | Login: tarjeta sin centrar | RESUELTO | `app/login/page.tsx:148` pasó a alineación superior con `pt-[clamp(...)]`: el espacio muerto desapareció, pero por rediseño y no por centrado. |
| A1-07 | Medio | Campos ATP/ATR creados y vacíos | NO RESUELTO | Jira: 0 de 874 con ATP o ATR (JQL `cf[10191]`, `cf[10177]` is not EMPTY). Ver gap G1. |
| A1-08 | — | Decidir BDD vs KATA con un ADR | RESUELTO | `ADR-0014` (superado por `ADR-0018`, trigger numérico) y `ADR-0018`; `playwright.config.ts` ya usa `workers: 2/4`. |
| A1-09 | Medio | Falta mapa de pantallas (`master-design-plan`) | RESUELTO | `.context/design/master-design-plan.md` existe (último cambio 2026-10-09); Regla 14 de `AGENTS.md` suavizada (live-UI-first). |
| A1-10 | — | Experimento shift-left contigo mismo (comparar tasa de defectos) | NO VERIFICABLE | Es una recomendación de método, sin artefacto definido; no hay evidencia de que se haya medido. |

## 4. Auditoría 2 (27-ago, 3,7)

| ID | Sev. | Hallazgo | Clase | Evidencia |
|---|---|---|---|---|
| A2-01 | Alto | CI existe pero ninguna rama la exige | RESUELTO | Protección en las 3 ramas (sección 2); `.context/audits/branch-protection.md`. |
| A2-02 | Alto | Tests unitarios no se ejecutan | RESUELTO | `package.json` `"test": "bun test"`; job `unit` en CI; `.husky/pre-push` corre `bun test`. |
| A2-03 | Alto | Campos QA estructurada de Jira al 0 % | PARCIAL | Error nuevos (28 desde 09-01): Severity 28/28. Pero Root Cause 16/161, Evidence 28/161, ATP/ATR 0/874, Story Points 14 % global. Solo hacia adelante. |
| A2-04 | Alto | 120/122 defectos huérfanos (sin enlace) | PARCIAL | Jira: 136/161 Error sin `parent`; 14/28 de los creados desde 09-01 sin parent. Enlaces (`issueLinks`) no consultables por JQL; cierre forward-only en `.context/audits/2026-09-02-FRESCO-392-forward-only-closeout/`. |
| A2-05 | Alto | CTA ámbar falla contraste AA | RESUELTO | `components/ui/button.tsx:35` `bg-secondary text-on-warning`; `app/globals.css:253` `--raw-color-on-warning: #201e1d` (≈6,3:1 sobre `#df8c26`). |
| A2-06 | Medio | Deriva de la fundación (PRD/SRS/glosario) | RESUELTO | `.context/business/domain-glossary.md:65-81` (suscripción, Stripe, webhook, analytics, push, avisos); `mvp-scope.md` con "scope reversal" y medición (último cambio 2026-10-11); mapas regenerados 2026-10-05/11. |
| A2-07 | Medio | Token de texto atenuado falla AA | RESUELTO | `DESIGN.md:8` y `app/globals.css:211`: `--raw-color-tertiary: #6f5f43` (~4,9:1 / ~5,6:1). |
| A2-08 | Medio | Estrategia git declarada no se respeta | RESUELTO | `.agents/project.yaml` `strategy: solo-main` (chosen, 2026-08-29) + solo squash en GitHub (sección 2) + `docs/workflows/hotfix.md`. Declaración y práctica coinciden. |
| A2-09 | Medio | Tablero Kanban genérico de 7 estados | PARCIAL | `Merged` dead-letter reducido a 1 item (JQL). El catálogo `.agents/jira-workflows.json` sigue nombrando "Software workflow for project KAN"; no se pudo enumerar la configuración real de workflow (requiere admin REST). |
| A2-10 | Medio | Touch targets en layout auth / checkbox signup | RESUELTO | `components/legal/legal-links.tsx` (`py-3`); `components/legal/consent-checkboxes.tsx:41,60` (envoltorio `size-6` = 24 px). |
| A2-11 | Medio | E2E de CI muta Supabase compartido | RESUELTO | `pr-check.yml`: stack local efímero por run, `.env` desde `.env.ci`, sin `secrets.*` (FRESCO-310/802); ADR-0017. |
| A2-12 | Medio | Caché PBI y `review.md` desincronizados | RESUELTO | `.context/PBI` solo tiene 2 ficheros versionados (`git ls-files`); `AGENTS.md` §9 la declara caché gitignorada. Único `review`/`compliance` restante: `.agents/skills/sprint-development/references/spec-compliance-matrix.md` (doc de skill, no un review por historia). |
| A2-13 | Medio | Docs de planificación caducados; cero estimación | PARCIAL | `master-implementation-plan.md` (10-05), `dev-roadmap.md` (10-04) al día. Estimación: Story Points en 25 de 215 historias nuevas (12 %). |
| A2-14 | Bajo | Bitácora sin rotar | RESUELTO | `.context/bitacora.md`: 36 entradas, 196 líneas; archivos `bitacora-*.md` rotados. |
| A2-15 | Bajo | `master-design-plan.md` no existe | RESUELTO | Existe y Regla 14 suavizada (ver A1-09). |
| A2-16 | Bajo | Hueco ADR-0010 | RESUELTO | `ADR-0010-postgres-atomic-counter-rate-limiting.md` Accepted; numeración 0001-0042 sin huecos. |
| A2-17 | Bajo | `trace: 'on-first-retry'` con `retries: 0` | RESUELTO | `playwright.config.ts:55` `retries: process.env.CI ? 1 : 0`. |
| A2-18 | Bajo | Detalles UI (botón Copiar, `<title>`, contraste error) | RESUELTO | `components/qa/code-block.tsx:37` (copy ya no `absolute`); `app/onboarding/layout.tsx:11` y `app/update-password/layout.tsx:10` con `title`; `--raw-color-error` `#b03d2b` (~4,66:1). |

## 5. Auditoría 3 (29-ago, 4,3)

| ID | Sev. | Hallazgo | Clase | Evidencia |
|---|---|---|---|---|
| A3-01 | Alto | E2E de PR escribe con service-role en la BD de producción | RESUELTO | `pr-check.yml` construye `.env` desde `.env.ci` (stack local); `supabase/migrations/20260901140000_remove_prod_test_accounts_from_rate_limit_exempt.sql`; ADR-0017. Residuo: ver G6. |
| A3-02 | Alto | Gate no cubre el commit que llega a producción | RESUELTO | `pr-check.yml` `on: push: [staging, main]` (e2e en push a staging); `.github/workflows/post-deploy-smoke.yml` (última ejecución success); 6 etiquetas `@smoke`. |
| A3-03 | Medio | Campos QA al 0 % y calidad dispar de defectos | PARCIAL | Igual que A2-03: Severity en 63/161 Error (28/28 de los nuevos), Root Cause 16, Evidence 28, ATP/ATR 0. Regla "sin pasos no se cierra" en `.context/backlog/definition-of-done.md`. |
| A3-04 | Medio | Estrategia git declarada ≠ practicada | RESUELTO | Ver A2-08. Matiz: 249 de 619 commits first-parent en main desde 09-01 no llevan `(#PR)`. Es coherente con `solo-main`, pero ver G5. |
| A3-05 | Medio | Solo HSTS; faltan 5 cabeceras | RESUELTO | `next.config.mjs:12-16` (HSTS, XFO DENY, nosniff, Referrer-Policy, Permissions-Policy); CSP movida a `proxy.ts` (ADR-0019/0029-0031). No se midió en vivo con `curl`. |
| A3-06a | Bajo | Sin `<main>` | RESUELTO | `app/page.tsx:43`, `app/login/layout.tsx:21`, `app/qa/page.tsx:52`, resto de layouts públicos. |
| A3-06b | Bajo | Inputs de login sin `<label for>` | RESUELTO | `app/login/page.tsx:184,195`. |
| A3-06c | Bajo | 12 controles < 44 px | RESUELTO | `min-h-[44px]` en nav, FAQ, enlaces legales (A1-04). |
| A3-06d | Bajo | `/robots.txt` 404 | RESUELTO | `app/robots.ts`, `app/sitemap.ts`, `app/manifest.ts`. |
| A3-06e | Bajo | H2 "domingosin agobios" | RESUELTO | `components/landing/final-cta.tsx:14-19` (espacio explícito). |
| A3-07 | Bajo | README del repo es el del boilerplate | RESUELTO | `README.md` (108 líneas) abre con "# Fresco" y describe producto, stack y arquitectura. |
| A3-08 | Bajo | Boilerplate congelado y skills bifurcadas sin ADR | RESUELTO | ADR-0016 y ADR-0039 (`skills-sync-with-protected-doctrine`), `updater.protected_paths` en `project.yaml`. |
| A3-09a | Bajo | Comentario de `service.ts` ("one caller") | RESUELTO | `lib/supabase/service.ts` lista los dos callers; coincide con `rg` (webhook + stripe-reconcile). |
| A3-09b | Bajo | Glosario cuenta mal los ADR | PARCIAL | `domain-glossary.md:29` dice 39 (ADR-0001-0039); existen 42. Se desactualizó de nuevo. |
| A3-09c | Bajo | `project.yaml:7` "TEMPLATE" / `created` anterior al primer commit | RESUELTO | `project.yaml:1-9` ya dice "live config"; `meta.created: 2026-07-24`. |
| A3-09d | Bajo | Sin bloque `dev` en `environments` | RESUELTO | `project.yaml` `environments.dev` presente (FRESCO-297/804). |
| A3-09e | Bajo | `.impeccable/config.json` trackeado | NO RESUELTO | `git ls-files .impeccable` devuelve `.impeccable/config.json`. No verifiqué si `eslint.config.js` aún lo documenta como local-only. |
| A3-09f | Bajo | 14 directorios `n8n-*` en `.agents/skills` | RESUELTO | `fd n8n .agents .claude` sin resultados. |
| A3-09g | Bajo | 47 `review.md`/`compliance-matrix.md` | RESUELTO | Ver A2-12. |
| A3-09h | Bajo | 8 ramas remotas obsoletas | PARCIAL | 32 ramas remotas hoy (dependabot, `docs/*`, `feat/*`, `fix/*`); existe `stale-branch-cleanup.yml`. No medí antigüedad. |
| A3-09i | Bajo | `app/dev/skeleton-capture` público en prod | RESUELTO | `app/dev/skeleton-capture/page.tsx:22-23` `notFound()` si `NODE_ENV==='production'`. |
| A3-09j | Bajo | ADRs en `Proposed` con decisión implementada | PARCIAL | Los antiguos están `Accepted`. Hoy quedan `Proposed` ADR-0040 (consent registry) y ADR-0042; no verifiqué si ya están implementados. |
| A3-09k | Bajo | Bitácora 4.357 líneas sin rotar | RESUELTO | Ver A2-14. |

## 6. Gaps residuales (ordenados por severidad sugerida)

| # | Severidad | Gap | Origen | Acción sugerida |
|---|---|---|---|---|
| G1 | Media | ATP/ATR (y casi todos los campos estructurados) siguen a 0 sobre 874 items; Root Cause 10 % y Evidence 17 % de los Error. La tesis shift-left sigue sin métrica consultable en Jira. | A1-07, A2-03, A3-03 | Decidir: poblarlos en historias nuevas (Definition of Done) o eliminar los campos y documentar el hueco. |
| G2 | Media | Trazabilidad de defectos: 136/161 Error sin `parent`; mitad de los nuevos también. No se pudo medir `issueLinks`. | A2-04 | Hacer obligatorio el parent/link al crear Error (pantalla de creación) y medir con REST. |
| G3 | Media | Estimación: Story Points en 12 % de historias nuevas. | A2-13 | Regla de estimar al pasar a Listo. |
| G4 | Baja | Workflow de Jira sin verificar en vivo (catálogo aún "KAN"; estados reales no enumerados). | A2-09 | Revisión de admin de workflow o retirar los alias ricos de `.agents/`. |
| G5 | Baja | 40 % de commits first-parent en main desde 09-01 sin PR, en tensión con la regla vigente de promoción por PR con checks verdes. | A3-04 | Revisar si `docs/**` + fixes directos son política aceptada; escribirlo en `git_strategy.policy`. |
| G6 | Baja | `post-deploy-smoke.yml` aún lee `secrets.LIVE_E2E_ENV_FILE \|\| secrets.ENV_FILE` (entorno real). Contenido del secreto no verificado. | A3-01 | Confirmar que no incluye service-role de producción; borrar el fallback a `ENV_FILE`. |
| G7 | Muy baja | Deriva menor de docs: glosario cita 39 ADR (hay 42), `.impeccable/config.json` trackeado, 32 ramas remotas, ADR-0040/0042 en Proposed. | A3-09b/e/h/j | Una pasada de limpieza. |
| G8 | Informativa | A1-10 (experimento shift-left) sin artefacto de medición. | A1-10 | Cerrar como no accionable o definir la métrica. |

No hay regresiones respecto a lo que las auditorías 1-3 daban por cerrado.
