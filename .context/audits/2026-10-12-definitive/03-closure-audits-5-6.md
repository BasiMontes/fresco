# 03. Cierre de las auditorías 5 y 6 (interna y externa) y de la checklist de lanzamiento

> Fecha: 2026-10-12. Solo lectura. Código auditado: `origin/main` = `f4a93ab` (producción `fresco-pro` responde ese mismo commit en `/api/health`). La rama de trabajo `perf/FRESCO-906-exclude-sharp` va un commit por delante (`43c363e3`, solo trazas de `sharp`; no afecta a ningún hallazgo).
> Criterio: el código actual es la verdad; Jira y la bitácora son pistas. Cuando la única evidencia es la bitácora lo marco como NO VERIFICABLE o lo digo en la nota.

## 0. Cómo se verificó (y qué no)

| Comprobación | Resultado |
|---|---|
| Migraciones locales frente a remoto (`supabase migration list --linked`) | 109 locales = 109 remotas, ninguna sin aplicar |
| Edge Functions (`supabase functions list --project-ref`) | 8 de 8 `ACTIVE`; la fecha de despliegue de cada una es posterior a su último commit (la más reciente, `generate-shopping-list`, v46 el 2026-10-09 09:58 UTC frente a commit 09:57 UTC) |
| Catálogo vivo (solo `SELECT` con `supabase db query --linked`) | `pg_proc`, `pg_policies`, `role_table_grants`, `pg_constraint`, `pg_trigger`, `cron.job`, `recipes`, `supermarket_chain` |
| `eslint .` y `knip` | exit 0 / exit 0 |
| `bun audit` | 2 vulnerabilidades (1 high, 1 low). Eran 13 (7 high) |
| Branch protection (`gh api`) | `main`, `staging`, `dev`: `repo:check`, `test:unit`, `test:e2e`, `test:db-integration`, `deno:check`; `strict:false`; `enforce_admins:false`; solo `dev` exige PR |
| Producción (`curl -I`) | CSP enforcing, HSTS preload, XFO DENY, sin `x-powered-by`; `/favicon.ico`, `/llms.txt`, `/robots.txt`, `/sitemap.xml`, `/opengraph-image` 200; ruta inexistente 404; `http` a `https` 308 |
| No se ha hecho | Ejecutar exploits (no se reprodujo ningún ataque, solo se leyeron definiciones vivas y migraciones). No se corrió `bun test` completo (se usó el historial de CI). No se leyó `.env`. No se consultó Jira. No se ve el panel de Supabase (captcha hosted, plan, backups) ni Stripe |
| Bloqueado por el clasificador | Decodificar/inspeccionar las claves de `.env.ci` (A6-S12): lo dejo NO VERIFICABLE con evidencia secundaria |

Datos de contexto que cambian la urgencia: `user_profiles` tiene 4 filas, las 4 `free`; la consulta `scripts/queries/mvp-success-bar.sql` devuelve 0 pagadores y 0 semanas repetidas. Hoy no hay usuarios reales de pago.

## 1. Resumen

| Fuente | Hallazgos | RESUELTO | PARCIAL | NO RESUELTO | REGRESIÓN | NO VERIFICABLE |
|---|---|---|---|---|---|---|
| Audit-5 (12 puntos: B1-B3, H1-H8, M1) | 12 | 8 | 3 | 0 | 1 | 0 |
| Audit-6 interna: Seguridad | 14 | 11 | 2 | 0 | 0 | 1 |
| Audit-6 interna: Testing | 13 | 13 | 0 | 0 | 0 | 0 |
| Audit-6 interna: DevOps | 14 | 8 | 6 | 0 | 0 | 0 |
| Audit-6 interna: App en vivo | 11 | 8 | 3 | 0 | 0 | 0 |
| Audit-6 interna: Arquitectura | 15 | 12 | 3 | 0 | 0 | 0 |
| Audit-6 interna: Producto | 15 | 7 | 6 | 0 | 0 | 2 |
| **Audit-6 interna, total** | **82** | **59** | **20** | **0** | **0** | **3** |
| Audit-6 externa (10 con peso + 10 de la lista "para cuando pases cerca") | 20 | 18 | 2 | 0 | 0 | 0 |

- Los dos BLOCKER de audit-6: A6-S1 queda RESUELTO (función eliminada, verificado en vivo); A6-P1 queda PARCIAL (los entregables de ingeniería están; la revisión de abogado sigue sin existir).
- "PARCIAL" incluye los riesgos aceptados por escrito (ADR o decisión del fundador) que no son una corrección: A6-S11, A6-D10, A6-L11, A5-H8b.
- No hay ningún NO RESUELTO limpio: lo que no se cerró está a medias o aparece como residuo nuevo (sección 7).
- La única REGRESIÓN es A5-H2 (ramas remotas: 4 el 2026-10-02, 32 hoy).

## 2. Audit-5 (2026-09-28)

| ID | Hallazgo | Clase | Evidencia |
|---|---|---|---|
| A5-B1 | Aviso legal de borrador quitado sin abogado (FRESCO-434) | PARCIAL | Ver A6-P1. Registro de consentimientos, casilla 14+, resumen precontractual y renuncia al desistimiento implementados; textos siguen provisionales y el abogado está aplazado (`.context/launch-plan.md:22-23`, `:80`) |
| A5-B2 | `meal_plan_recipes`: `GRANT UPDATE` salta las RPC | RESUELTO | Trigger `protect_meal_plan_recipes_integrity` (UPDATE) vigente; la RPC que lo reabría está eliminada (`supabase/migrations/20261002065911_drop_apply_recipe_status_update.sql`); en vivo `pg_proc` no devuelve `apply_recipe_status_update`; test del ataque en `tests/db/meal-plan-recipes-integrity.test.ts:60-89` |
| A5-B3 | Métrica MVP marcada alcanzada sin evidencia | RESUELTO | `.context/PRD/mvp-scope.md:88` "Bar NOT reached"; consulta reproducible `scripts/queries/mvp-success-bar.sql` |
| A5-H1 | Dependabot no cubre npm/bun | RESUELTO | `.github/dependabot.yml` con `bun` y `github-actions`; `dependabot_security_updates: enabled`; alertas de vulnerabilidades activas (HTTP 204). Residuo: sus PRs fallan en CI (sección 7) |
| A5-H2 | 82 ramas de PR mergeadas sin borrar | REGRESIÓN | `git branch -r`: 32 ramas remotas (eran 4). ~25 son ramas de PR ya mergeadas (p. ej. PR #607, #593, #604). `stale-branch-cleanup.yml` solo barre PRs cerrados sin merge. Causa probable (no verificada): merges que llegan por `git:promote` (ff) y no por el botón, así que `delete_branch_on_merge` no dispara |
| A5-H3 | `resolveBaseUrl`, `triggerLikeBurst`, `capitalize`/`formatUnidad` duplicados | RESUELTO | Un solo `lib/utils.ts:49 capitalize`, `lib/seo/resolve-base-url.ts`, `components/recipe/like-burst.ts` |
| A5-H4 | ADR 0022-0026 en `Proposed` | RESUELTO | Los cinco `Accepted`. Recurrencia en 0040 y 0042 (sección 7) |
| A5-H5 | Suite `@requiere-stripe-real` sin CI | PARCIAL | `.github/workflows/stripe-e2e.yml` cableado y con issue automática; ejecuciones programadas: 2026-10-05 verde, 2026-10-12 rojo. Rojo desde el 2026-10-07 (issue #610): "Checkout anual" falla por precio esperado distinto |
| A5-H6 | Mensajes distintos en swap/copy; comparación no constante | RESUELTO | `20260928180000_no_disclosure_swap_and_copy.sql`; comparación en tiempo constante en `supabase/functions/_shared/timing-safe.ts` y `lib/auth/timing-safe-equal.ts` |
| A5-H7 | Pro promete recordatorio inexistente | RESUELTO | Copy de `pricing.tsx` reescrita; los botones Cocinado/Descartar existen (audit-6 live lo confirma) |
| A5-H8 | `/admin/recipes` sin gate; cookie sin httpOnly | PARCIAL | (a) RESUELTO: `app/(app)/admin/recipes/page.tsx` usa `isAdminUser()` y `notFound()`; FRESCO-840 corrige el código de estado. (b) Aceptado: ADR-0035 `Accepted` (2026-10-02); la cookie `sb-*-auth-token` sigue legible desde JS |
| A5-M1 | God-components y `createMockClient` x7 | RESUELTO | `lib/fixtures/mock-supabase-client.ts` único; `eslint.config.js:235-236` `complexity` 25 y `max-lines` 450 como error |

Los puntos "sin ticket" de audit-5 (`enforce_admins:false`, `strict:false`) siguen igual y aceptados: ver A6-D10.

## 3. Audit-6 interna: fila por hallazgo

### 3.1 Seguridad (14)

| ID | Sev. original | Clase | Evidencia actual |
|---|---|---|---|
| A6-S1 | BLOCKER | RESUELTO | Función eliminada (`20261002065911_drop_apply_recipe_status_update.sql`), aplicada (ledger 109/109) y ausente en `pg_proc` vivo. `authenticated` solo conserva `UPDATE` de tabla y el trigger rechaza `estado/rating/recipe_id/sustitucion_ingrediente` (`P0001`). Test `tests/db/meal-plan-recipes-integrity.test.ts:78`. Comprobado también `assign_recipe_to_slot` (nueva, FRESCO-878): `SECURITY INVOKER`, activa el GUC pero valida antes (RLS, `get_filtered_recipes`, tipo de plato, día futuro, rate limit); no reproduce el patrón |
| A6-S2 | ALTO | RESUELTO | CHECK vivo `push_subscriptions_endpoint_allowed` (host de push permitido, https, longitud <= 2048; `20261002085259_validate_push_subscription_endpoints.sql:29-31`), sin invitados anónimos (L60-64), `SEND_TIMEOUT_MS = 10_000` y envío acotado (`supabase/functions/send-weekly-reengagement-push/index.ts:44-49`) |
| A6-S3 | ALTO | RESUELTO | `app/api/stripe/checkout/route.ts`: invitado rechazado (L57), 409 si ya es Pro, rate limit, reutiliza `customer`, `payment_method_collection:'always'` sin trial si ya hubo cliente/suscripción (L98-107). Límite residual: el marcador de "trial usado" lo escribe el webhook al completar el primer checkout; cuentas reales distintas siguen pudiendo repetir (inherente) |
| A6-S4 | MEDIO | RESUELTO | `20261002072502_close_meal_plan_insert_paths.sql`: `INSERT` revocado a `authenticated` en `meal_plans` y `meal_plan_recipes` y políticas borradas. Vivo: grants `authenticated` solo SELECT/UPDATE(/DELETE en `meal_plans`); sin política INSERT |
| A6-S5 | MEDIO | RESUELTO | Mismo fichero: `shopping_insert_own` y `shopping_update_own` exigen `exists(meal_plans ... user_id = auth.uid())`; vivo: las cuatro políticas presentes |
| A6-S6 | MEDIO | RESUELTO | `20261002200000_supermarket_rls_permission_gate.sql`: helper `private.supermarket_chain_activa`, `supermarket_chain` y `history` sin SELECT para `authenticated`. Vivo: `authenticated` solo lee `supermarket_price/product/zone/zone_postcode/ingredient_product_match` bajo la puerta |
| A6-S7 | MEDIO | PARCIAL | Hecho: CHECKs de tamaño, cuotas por trigger (`recetas_propias_enforce_quota`, `favorites_enforce_quota` vivos), `rate_limit_endpoints` con tope (`20261005073630_...`). Captcha Turnstile: código en `lib/auth/captcha.ts` y formularios, pero es opt-in por `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `supabase/config.toml:226` sigue comentado; que el captcha esté activo en el proyecto hosted no se puede ver desde aquí (la bitácora menciona "Login con Turnstile", indicio no prueba) |
| A6-S8 | BAJO | RESUELTO | `_shared/timing-safe.ts`, `lib/auth/timing-safe-equal.ts` usados en `_shared/auth.ts` y `app/api/cron/stripe-reconcile/route.ts` |
| A6-S9 | BAJO | RESUELTO | Vivo: 0 tablas `public` con `TRUNCATE`/`TRIGGER` para `authenticated`/`anon`; las funciones trigger DEFINER (`protect_meal_plan_recipes_integrity`, `prevent_client_subscription_writes`, `handle_updated_at`, `update_recipe_learning`) sin EXECUTE para `anon`/`authenticated` |
| A6-S10 | BAJO | RESUELTO | `app/api/stripe/webhook/route.ts` (L39-43, L70-73, L120): idempotencia por `event.id` en `stripe_webhook_events` (sin grants a roles de cliente, comprobado en vivo), `payment_status` y `async_payment_succeeded`. Test `tests/db/stripe-webhook-events.test.ts` |
| A6-S11 | BAJO | PARCIAL | Aceptado y documentado: leaked-password protection requiere Supabase Pro; mitigado con HIBP en cliente y `minimum_password_length = 10` (`supabase/config.toml:194`) |
| A6-S12 | BAJO | NO VERIFICABLE | No pude inspeccionar las claves de `.env.ci` (acción denegada por el clasificador, correcto). Evidencia secundaria: bitácora de FRESCO-780 (commit `11914c7b`) dice que son dos JWT demo de Supabase local y Stripe `sk_test_`/`whsec_` dummy. Recomiendo un check automático sin imprimir (patrón `sk_live_`/`sb_secret_` en CI) |
| A6-S13 | BAJO | RESUELTO | `supabase/functions/reassign-guest-data/index.ts:20,82` usa `isTokenRecent` (`_shared/token-recency.ts`) |
| A6-S14 | BAJO | RESUELTO | `get_catalog` con `least(..., 1000)` (`20261007120000_...:90`); vivo: solo `rls_auto_enable` (de Supabase, `search_path=pg_catalog`) queda sin `pg_temp`; `components/seo/json-ld.tsx` serializa con `serializeJsonLd`. Límite conocido: catálogo activo hoy 538 recetas, tope 1000 |

### 3.2 Testing/CI (13)

| ID | Sev. | Clase | Evidencia actual |
|---|---|---|---|
| A6-T1 | ALTO | RESUELTO | `tests/db/meal-plan-recipes-integrity.test.ts:60-89` (PATCH directo de las 4 columnas = 400 `P0001`; la RPC antigua = 404) + `supabase/tests/meal_plan_recipes_integrity.test.sql` + `tests/db/meal-plan-insert-paths.test.ts` |
| A6-T2 | ALTO | RESUELTO | `tests/db/edge-functions/{delete-catalog-recipe,get-shopping-list-suggestions,send-weekly-reengagement-push}.test.ts` y `supabase/functions/_shared/admin.test.ts` |
| A6-T3 | ALTO | RESUELTO | Required checks vivos incluyen `test:db-integration` y `deno:check` en las 3 ramas; `tests/db/harness.ts:161` lanza error (no salta) si se pide `RUN_DB_INTEGRATION=1` y la pila no responde; `pr-check.yml:162-179` rechaza `skip` y exige un suelo de tests pasados |
| A6-T4 | MEDIO | RESUELTO | `scripts/check-coverage.ts:101,108`: suelo cargado 85,5/87,0 y suelo "honesto" (ficheros sin importar cuentan como 0) 49,0 |
| A6-T5 | MEDIO | RESUELTO | `.github/workflows/test-randomized.yml` nocturno: 6 de 6 ejecuciones verdes (2026-10-07 a 10-12) |
| A6-T6 | MEDIO | RESUELTO | `playwright.config.ts:82-95` proyectos `mobile` (360x740) y `tablet` (768x1024); escenarios `@mobile @tablet` en `.context/qa/regression.feature:897,2107,2121,2127` |
| A6-T7 | MEDIO | RESUELTO | `scripts/e2e-flaky-budget.ts` invocado en `pr-check.yml:405-417` |
| A6-T8 | MEDIO | RESUELTO | `tests/steps/aprendizaje-pro.steps.ts:94-105` aserción incondicional del banner; DoD actualizada (commit `8d6f2f61`) |
| A6-T9 | BAJO | RESUELTO | `scripts/refresh-supermarket-prices.test.ts` + secretos `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` ya existen en el repo; un `workflow_dispatch` en dry-run en verde el 2026-10-05 (el `--apply` nunca se ha ejecutado: `supermarket_product` tiene 0 filas, ver D5) |
| A6-T10 | BAJO | RESUELTO | `proxy.test.ts:47-50` comprueba la cabecera CSP con nonce |
| A6-T11 | BAJO | RESUELTO | `.context/qa/coverage-ratchet.md:72-74` alineado con el script; ADR-0018 actualizado (L59-60); comentarios de Gemini en `regression.feature` corregidos |
| A6-T12 | BAJO | RESUELTO | 0 `test.skip(true` en `tests/steps`; la única espera fija restante (`calendario.steps.ts:106`) es un muestreo de desbordamiento, no una espera antes de una aserción negativa |
| A6-T13 | BAJO | RESUELTO | Issue automática en `stripe-e2e.yml`/`post-deploy-smoke.yml`; el aviso se ha ejercitado de verdad (issue #610 abierta por el fallo del 2026-10-12) |

### 3.3 DevOps (14)

| ID | Sev. | Clase | Evidencia actual |
|---|---|---|---|
| A6-D1 | ALTO | PARCIAL | 13 vulnerabilidades pasan a 2 (`bun audit`: `source-map-js` high, `katex` low). Alertas y security updates activos. Pero el workflow `dependency-audit.yml` está **rojo hoy** (2026-10-12, programado) por esa high, y los PRs de Dependabot #617 y #495 fallan `PR Check`; #614 verde. Falta cerrarlo |
| A6-D2 | ALTO | PARCIAL | `db-backup.yml` semanal cifrado a R2 + `db-restore-drill.yml`; RTO de datos medido en 76 s (`.context/ADR/ADR-0020`, L126-128). Sigue siendo un único proyecto Free sin PITR: RPO hasta 7 días, aceptado por el fundador (ADR-0020 L173). `docs/workflows/hotfix.md:15` ya no promete down-migrations |
| A6-D3 | MEDIO | RESUELTO | `seed.sql` regenerado (`80aff7c6`); "Drift checks" en verde en las últimas 4 ejecuciones (push y programada) |
| A6-D4 | MEDIO | RESUELTO | Ver T3; `.agents/project.yaml:117` declara los 5 contextos y `git:checks verify` los compara |
| A6-D5 | MEDIO | PARCIAL | Secretos creados y runner probado en dry-run (2026-10-05); nunca se ha aplicado: 0 productos y 0 precios en `supermarket_*` (los enlaces vienen de los catálogos generados). Mercadona/Consum con `permiso = riesgo-aceptado` (vivo) |
| A6-D6 | MEDIO | PARCIAL | `pr-check.yml` ya no usa ningún `secrets.*` (`:274-300`, `scripts/ci-secrets-policy.test.ts`); `sha_pinning_required: true` en el repo. Siguen usando `LIVE_E2E_ENV_FILE \|\| ENV_FILE` (`.env` completo de producción) `post-deploy-smoke.yml:101` y `stripe-e2e.yml:70`; el PAT `SUPABASE_ACCESS_TOKEN` sigue siendo de cuenta |
| A6-D7 | MEDIO | PARCIAL | `/api/health` responde `{"status":"ok","commit":"f4a93ab",...}`; `release` de Sentry en `sentry.*.config.ts`; `docs/workflows/observability.md`; `uptime-monitor.yml` cada 5 min con issue automática. Aún no hay ninguna ejecución programada registrada (solo 3 `workflow_dispatch` de ensayo, acaba de entrar en `main`) |
| A6-D8 | MEDIO | RESUELTO | `vercel.json`: `ignoreCommand` (`scripts/vercel-ignore-build.sh`) y `deploymentEnabled.dev:false` (FRESCO-804) |
| A6-D9 | BAJO | RESUELTO | 0 commits con `test@example.com` desde 2026-10-03; `.husky/pre-commit:1` rechaza `*@example.com` |
| A6-D10 | BAJO | PARCIAL | `enforce_admins:false`, `strict:false`, `main`/`staging` sin PR obligatorio (vivo). Aceptado en `accepted_divergences` |
| A6-D11 | BAJO | RESUELTO | `.context/audits/branch-protection.md` regenerado el 2026-10-02 con los 5 contextos |
| A6-D12 | BAJO | RESUELTO | Rama huérfana borrada; `stale-branch-cleanup.yml` ejecutado en verde el 2026-10-12 |
| A6-D13 | BAJO | RESUELTO | `bun run vars:env:check` ya no avisa de `ATLASSIAN_URL` |
| A6-D14 | BAJO | RESUELTO | Ejecuciones programadas existen (2026-10-05 verde, 2026-10-12 rojo por A5-H5) |

### 3.4 App autenticada en vivo (11)

No se pudo entrar logueado (credenciales fuera de alcance); la verificación es por código, tests de CI y catálogo vivo.

| ID | Sev. | Clase | Evidencia actual |
|---|---|---|---|
| A6-L1 | ALTO | RESUELTO | `lib/grocery/product-compatibility.ts` (FRESCO-826) + plausibilidad FRESCO-785 (`c4b465ff`, `30c7c60e`): sin enlace ni precio si no hay match fiable |
| A6-L2 | ALTO | RESUELTO | FRESCO-786 (`c9284f87`): días según el ancho del contenedor; escenario `@tablet` "no desborda" en `regression.feature:897-903` |
| A6-L3 | MEDIO | RESUELTO | FRESCO-792 (`27ed69ea`): una sola fuente del gasto; `components/menu/savings-estimate-cards.tsx` sin cifras fijas |
| A6-L4 | MEDIO | RESUELTO | FRESCO-805 (`794a0b7c`) y FRESCO-864 (`65b6db68`, 44 px a 360 px). Pendiente de QA visual del fundador según la bitácora (FRESCO-864 en Control de calidad) |
| A6-L5 | MEDIO | RESUELTO | FRESCO-806 (`ad3393ad`): el asistente se rellena con el perfil guardado |
| A6-L6 | MEDIO | PARCIAL | La capa de lista filtra por dieta (L1), pero en la base de datos hay recetas etiquetadas `halal` que contienen cerdo: ver residuo R2 |
| A6-L7 | MEDIO | RESUELTO | FRESCO-807 (`7621dac1`): la lista suma solo hoy y días posteriores |
| A6-L8 | BAJO | RESUELTO | PR #543 (formatos es-ES, precio 0 oculto) y FRESCO-863 (cantidades en la ficha; columna `ingredientes_cantidades` en las 538 activas) |
| A6-L9 | BAJO | RESUELTO | FRESCO-861 (restricciones `recipes_nombre_sin_con_repetido`, `recipes_categoria_en_contrato`) y FRESCO-862 (un solo "Cerrar sesión" en escritorio) |
| A6-L10 | BAJO | PARCIAL | Zonas táctiles de 44 px corregidas en lista y perfil (#544) y en la rejilla (#593), con escenarios `@mobile @a11y`. El `<a>` con `<button>` dentro (nested-interactive) sigue tolerado: `tests/steps/a11y.steps.ts:51` |
| A6-L11 | BAJO | PARCIAL | Cookie de sesión sin `httpOnly` por diseño de `@supabase/ssr`; ADR-0035 `Accepted` + CSP con nonce + HSTS. Riesgo aceptado, no corregido |

### 3.5 Arquitectura/código (15)

| ID | Sev. | Clase | Evidencia actual |
|---|---|---|---|
| A6-A1 | ALTO | RESUELTO | `eslint.config.js:229` `'max-params': ['error', 2]` en `app/`, `components/`, `lib/`; `eslint .` exit 0. Fuera de la regla: `supabase/functions`, `scripts/`, `cli/` |
| A6-A2 | ALTO | RESUELTO | 0032/0033/0035 `Accepted`; ADR-0002 duplicado resuelto (solo queda `ADR-0002-position-swaps-bypass-learning-trigger.md`); `scripts/check-adrs.ts` falla si un ADR lleva más de 14 días `Proposed`. Recurrencia en 0040/0042 (R10) |
| A6-A3 | MEDIO | RESUELTO | Ya no hay `'mercadona'`/`'consum'` literales en `components/`, `app/` ni `lib/grocery/types.ts` (FRESCO-808, `e37806cf`) |
| A6-A4 | MEDIO | RESUELTO | `lib/grocery/supermarket/catalog-connectors.ts:82-110`: `productoDeCatalogo` y `productosParaCarga` devuelven vacío si el conector no puede ejecutarse |
| A6-A5 | MEDIO | RESUELTO | FRESCO-809: `complexity` 25 y `max-lines` 450 como error; un solo `createMockClient` en `lib/fixtures` |
| A6-A6 | MEDIO | PARCIAL | `loadPosthog` único (`lib/posthog/load.ts`), `readCssDurationMs` único (`components/ui/css-duration.ts`). Siguen dos `assertRateLimitAllowed` (`supabase/functions/_shared/rate-limit.ts:19`, `generate-meal-plan/rate-limit.ts:17`) |
| A6-A7 | MEDIO | RESUELTO | FRESCO-810 (`ea5dbd1e`): candados ESLint de capas; `bun run cycles:check` = 366 ficheros, sin ciclos |
| A6-A8 | MEDIO | PARCIAL | `knip` en `repo:check` (exit 0) y `matcher.ts` ya se usa en `scripts/gen-*-catalog.ts`. `lib/security/nonce-substitution.ts` sigue existiendo (solo test) |
| A6-A9 | MEDIO | RESUELTO | Los 7 paquetes de CLI pasaron a `devDependencies`; vulnerabilidades residuales contadas en D1 |
| A6-A10 | BAJO | RESUELTO | ADR-0036 L24 dice que el esquema está implementado por `20261001180000_...` |
| A6-A11 | BAJO | RESUELTO | jsonb validado con zod en la frontera (FRESCO-820, `7c2a80af`) |
| A6-A12 | BAJO | PARCIAL | `OBSERVADO_EN_DESCONOCIDO = '1970-01-01...'` sigue en `catalog-connectors.ts:25,56` (honesto, pero sin edad real del precio) |
| A6-A13 | BAJO | RESUELTO | Hooks fuera de `lib/` (FRESCO-810). Nota: ADR-0041:20 todavía describe nueve hooks en `lib/`; revisar si es una descripción del estado previo |
| A6-A14 | BAJO | RESUELTO | Mapeo de precios y enlaces en el servidor (FRESCO-808, `e37806cf`) |
| A6-A15 | BAJO | RESUELTO | `scripts/` y `cli/` marcados `linguist-vendored` (FRESCO-820) |

### 3.6 Producto/negocio (15)

| ID | Sev. | Clase | Evidencia actual |
|---|---|---|---|
| A6-P1 | BLOCKER (condicional) | PARCIAL | Hecho (FRESCO-794): casilla 14+, registro `user_consents` append-only (`20261004120000_user_consents.sql`, `lib/legal/consent.ts:14`), consentimiento explícito de salud (`components/onboarding/onboarding-step-diet.tsx`), resumen precontractual y renuncia al desistimiento (`components/profile/pro-checkout-summary.tsx:206`, `use-pro-checkout.ts:37`). Falta: revisión por abogado (aplazada, `.context/launch-plan.md:22-23`), `LEGAL_ENTITY` sigue diciendo "autónomo" sin alta (`lib/legal/entity.ts:4-5`, el propio comentario lo admite), y la renuncia solo se registra desde el cliente: `app/api/stripe/checkout/route.ts` no comprueba que exista ese consentimiento |
| A6-P2 | ALTO | PARCIAL | ADR-0037 con revisión fechada 2026-11-06, interruptor de Consum probado (FRESCO-790, `eb03c3c8`), cláusula de "precios orientativos" en `components/legal/legal-content-data.ts:109`. Sin dictamen de abogado (aplazado al 17 nov o salida sin Consum, `launch-plan.md:36`) y sin respuesta de Consum; vivo: `consum` y `mercadona` `habilitada=true`, `permiso=riesgo-aceptado` |
| A6-P3 | ALTO | PARCIAL | `components/landing/learns-pro.tsx:18` reescrita ("Marca lo que cocinas..."), con test de claims (`landing-claims.test.ts:39`). Pero `components/landing/how-it-works.tsx:26` mantiene "Fresco aprende de lo que cocinas y lo que rechazas. Sin que tengas que decir nada." (la misma frase falsa; necesita marcar) |
| A6-P4 | ALTO | RESUELTO | `components/landing/impact-stats.tsx:18`: "Sin comidas ni cenas repetidas dentro de la misma semana. En Pro, además..." |
| A6-P5 | ALTO | RESUELTO | Cifras fijas "~15 €"/"~3 h" eliminadas de `components/menu/` y `app/(app)/menu` (FRESCO-792) |
| A6-P6 | ALTO | RESUELTO | Casilla explícita no premarcada en el paso de dieta + registro versionado. FRESCO-856 (aviso de consentimiento ya dado) se revirtió a propósito hasta que el abogado confirme |
| A6-P7 | ALTO | PARCIAL | Medición reproducible `scripts/queries/mvp-success-bar.sql` + eventos `payment_failed`/`plan_downgraded` (FRESCO-793, `34154c90`). La barra no se ha alcanzado ni hay cohorte: 0 pagadores en vivo |
| A6-P8 | MEDIO | RESUELTO | Regla y medida: `.agents/skills/sprint-development/SKILL.md:33,650,709` y `bun run jira:closure-evidence` (manual, no es puerta de CI) |
| A6-P9 | MEDIO | RESUELTO | La política de privacidad declara la base contractual de los eventos de servidor (`legal-content-data.ts:160`, FRESCO-813 `b093085d`) |
| A6-P10 | MEDIO | RESUELTO | `lib/legal/pro-terms.ts:16-19` `trial_settings.end_behavior.missing_payment_method: 'cancel'`; plan anual existe (`getProPriceId`, `parseProInterval`) |
| A6-P11 | MEDIO | PARCIAL | Mapas refrescados (FRESCO-814 el 2026-10-05; FRESCO-847 el 2026-10-11), pero ya vuelven a faltar `waitlist_signups`, `ingredientes_cantidades`, `assign_recipe_to_slot` y `stripe_webhook_events` en los tres mapas |
| A6-P12 | MEDIO | NO VERIFICABLE | Salud del backlog de Jira: no consultado. Bitácora (FRESCO-815) dice 124 cerrada, 183 reabierta, 31 rechazada, 0 WIP viejos |
| A6-P13 | BAJO | PARCIAL | NIF y Gmail siguen publicados; aceptado, seguimiento en FRESCO-883 y dominio bloqueado por presupuesto (FRESCO-886) |
| A6-P14 | BAJO | RESUELTO | `.context/PRD/mvp-scope.md:13` recoge la excepción de la pantalla de resumen |
| A6-P15 | BAJO | NO VERIFICABLE | Estado de los `[DRAFT]` en Jira; la bitácora dice que pasaron a `Blocked` |

## 4. Audit-6 externa frente a la interna: solapes y estado

Comprobado el cruce de `2026-10-01-audit-6-externa-solapes.md` contra el código de hoy.

| # externa | Hallazgo | Solape con la interna | Clase | Evidencia |
|---|---|---|---|---|
| 1 | RPC `apply_recipe_status_update` sin guardas (bloqueante) | A6-S1, A6-T1 (idéntico) | RESUELTO | Ver A6-S1 |
| 2 | Promoción con staging en rojo | Sin solape | RESUELTO | `scripts/git-promote.ts:13-15,73-75` rechaza si el último `PR Check` del SHA en staging no es `success`; `test:db-integration` y `deno:check` ya son required checks. Límite: es una puerta de herramienta, no de plataforma (`enforce_admins:false`) |
| 3 | Gates de cierre perdidos en el sync de septiembre | Parcial (A6-P8, A6-P1) | RESUELTO | `.agents/skills/sprint-development/SKILL.md:645-650` gotchas 16-21; `.agents/project.yaml:173-180` `updater.protected_paths`; `scripts/skill-gates.test.ts`; ADR-0016 `Superseded by ADR-0039` |
| 4 | 78 commits con identidad `test@example.com` | Sin solape | RESUELTO | 0 commits con esa identidad desde 2026-10-03; hook `.husky/pre-commit:1` |
| 5 | Tarjetas de ahorro con cifras sin datos | A6-P5 (idéntico) | RESUELTO | Ver A6-P5 |
| 6 | Documentación parada en septiembre | A6-A2, A6-P11 | PARCIAL | Glosario y roadmap del 2026-10-04, mapas del 10-05/10-11; ya desfasados otra vez (A6-P11) |
| 7 | e2e contra `seed.sql` desfasado | A6-D3 (idéntico) | RESUELTO | Ver A6-D3 |
| 8 | ADR 0028/0032/0033/0035 `Proposed` | A6-A2, A6-A10 | RESUELTO | Solo 0040 y 0042 están `Proposed` |
| 9 | Gates de FRESCO-281/282/321 descartados | Sin solape | RESUELTO | `SKILL.md:647-649` (FRESCO-839, `94b11797`) |
| 10 | Patrón: reglas en una capa que el actor puede saltarse | Sin solape | PARCIAL | Cada instancia mitigada (SQL, `git:promote`, skills protegidas, hook); el patrón de fondo (`enforce_admins:false`, push directo a `main`/`staging` sin PR) sigue aceptado |

Lista "para cuando pases cerca" (10 puntos): todos RESUELTOS. `hotfix.md`/`dependabot.yml` apuntan a `staging`; `admin_bypass` anotado; los 16 tests de Edge entran en `types:check` (`types:check:edge-tests`, `8b12eebc`); `lib/supabase/service.ts:4` importa `server-only`; botones de 14 px corregidos (FRESCO-836); `/admin/recipes` no responde 200 a no admins (FRESCO-840; sin sesión hoy 307 a login); sin `x-powered-by` (curl); `brag-output*`, `tasks/` y `step2-vegano.yml` fuera del árbol; `DESIGN.md:4` ya no dice "IA"; ADR-0002 duplicado resuelto.

Resumen del cruce:
- Solapados 1:1 con la interna: externa 1, 5, 7 (y 8 con A6-A2).
- Parciales: externa 3 con A6-P8/P1 (la externa vio el síntoma, la interna el efecto), externa 6 con A6-A2/P11.
- Solo la externa: 2, 4, 9, 10 y 9 de los 10 puntos de la lista baja. Solo la interna: el 90 % restante (RLS de INSERT, SSRF de push, trials, legal, producto).
- Contradicción resuelta: la externa vio `/admin/recipes` con 200 y "no encontrada"; la interna un 404 real. FRESCO-840 unificó el comportamiento.

## 5. Checklist de lanzamiento (`2026-10-11-launch-checklist.md`) con evidencia de hoy

Recuento original: 16 cumple, 9 parcial, 10 falta de 35 aplicables. Hoy: **24 cumple, 9 parcial, 2 falta**. El documento original no se ha tocado (solo lectura); esta tabla es la actualización propuesta.

| Id | Punto | Estado hoy | Evidencia |
|---|---|---|---|
| b1 | Descripción de una línea | Cumple | `<meta name="description">` en la landing de producción |
| b2 | A quién va dirigido | Cumple | Persona en `.context/PRD/` y mensaje de la landing |
| b3 | Precio y plan de pago | Cumple | `id="pricing"` en `https://fresco-pro.vercel.app/` |
| b4 | Lista de espera | **Cumple (antes Falta)** | `components/landing/waitlist-form.tsx`, `lib/client-api/waitlist.ts`, migración `20261011140000_waitlist_signups.sql`; "waitlist" aparece 3 veces en el HTML de producción |
| b5 | Fecha de lanzamiento | **Cumple (antes Falta)** | `.context/launch-plan.md`: martes 1 de diciembre de 2026 (con la salvedad del presupuesto, L80) |
| p1 | Probar registro y onboarding | Cumple | Escenarios e2e con usuarios nuevos |
| p2 | Analítica y número clave | Cumple | PostHog con consentimiento + `scripts/queries/mvp-success-bar.sql` (ejecutada hoy: 0 pagadores) |
| p3 | Seguimiento de errores | Cumple | Sentry en cliente, servidor, edge, con `release` |
| p4 | Correo desde dominio propio | Parcial | Sin dominio (FRESCO-886 `Blocked`, `launch-plan.md:49`); SMTP de Gmail |
| p5 | Pagos de extremo a extremo y reembolso | Parcial (peor) | El e2e real de Stripe lleva rojo desde 2026-10-07 (issue #610, "Checkout anual"); reembolso sin probar (plan: T-4) |
| p6 | Privacidad y términos | Parcial | Páginas publicadas y rastreables; textos provisionales, abogado aplazado |
| w1 | HTTPS y redirecciones | Cumple | `http://` a `https://` con 308 (comprobado) |
| w2 | Título y descripción por página | Cumple | FRESCO-473 |
| w3 | Imagen Open Graph | Cumple | `/opengraph-image` 200 |
| w4 | Favicon | **Cumple (antes Parcial)** | `/favicon.ico` 200 (FRESCO-893) |
| w5 | Sitemap y robots | Cumple | `/robots.txt` y `/sitemap.xml` 200 |
| w6 | Página 404 útil | Cumple | 404 real con título propio (FRESCO-894) |
| w7 | Carga rápida en móvil | Parcial | FRESCO-892 midió Core Web Vitals (LCP/CLS bien, TBT alto en `/login` y `/signup`, card FRESCO-895); existe `lcp-budget.yml` |
| w8 | Search Console y Bing | Falta | Sin etiqueta de verificación en el HTML ni en el código; previsto en T-6 (19-25 oct, FRESCO-887) |
| w9 | Contacto al que escribir | Parcial | Gmail (FRESCO-883) |
| w10 | Legible por asistentes de IA | Cumple | `/llms.txt` 200 |
| a1 | Logo | Cumple | `public/brand/`, `docs/brand/index.html` |
| a2 | 3-5 capturas | **Cumple (antes Falta)** | `docs/brand/launch-kit/screenshots/` (3 capturas: menú, calendario, biblioteca; faltan lista de la compra y Pro) |
| a3 | Vídeo corto | Cumple | `public/video/fresco-brand.mp4` |
| a4 | Descripciones corta y larga | **Cumple (antes Parcial)** | `docs/brand/launch-kit/textos.md` |
| a5 | Primer comentario del autor | **Cumple (antes Falta)** | `textos.md`, sección "Primer comentario del autor" |
| a6 | Respuestas a preguntas habituales | **Cumple (antes Parcial)** | `components/landing/faq-data.ts` (10 preguntas; FRESCO-891) |
| g1 | Qué directorios aceptan el producto | Parcial | `launch-plan.md:14,67`: se evalúan en T-4 |
| g2 | Hueco en el pie para insignias | Falta | Sin insignias ni hueco en `components/landing` |
| g4 | Reservar fechas de lanzamiento programado | Parcial | Propuesta "no aplica sin Product Hunt", pendiente de confirmar (`launch-plan.md:14`) |
| d1 | Decidir si Product Hunt encaja | **Cumple (antes Falta)** | Decisión escrita: sin Product Hunt (`launch-plan.md:12`) |
| d4 | Publicar donde ya están tus usuarios | Parcial (antes Falta) | Canales decididos (Instagram, TikTok, comunidades); cuentas sin abrir (T-7, 12-18 oct) |
| t6 | Prueba o plan gratis | Cumple | Free permanente + 7 días Pro, una vez por cuenta (A6-S3) |
| t7 | Pagos fallidos | Parcial | Webhook marca `payment_failed_at`; correos de Stripe sin verificar |
| t8 | Página de precios | Cumple | `#pricing` con importes de Stripe y selector anual |

Los 12 puntos "no aplica aún" y los 19 "no aplica" no cambian. Nota: la afirmación de la checklist "Search Console... no necesita dominio propio" es coherente con el plan T-6 (verificación por prefijo de URL).

## 6. Estado de la regla "lo que llega a main"

- `main`, `staging`, `dev` y producción en el mismo commit (`f4a93ab`; `dev` también despliega: `fresco-dev` 200).
- Migraciones y funciones: sincronizadas (sección 0).
- Última tanda de CI en `main`/`staging`: `PR Check` verde en todas las ejecuciones; rojas solo los PRs de Dependabot #617/#495, `Dependency audit` (programada) y `Stripe e2e` (programada).

## 7. Brechas residuales (con severidad)

| # | Severidad | Brecha | Origen | Evidencia | Acción sugerida |
|---|---|---|---|---|---|
| R1 | ALTO (BLOCKER si se cobra a un usuario real) | Textos legales sin abogado; Consum con riesgo aceptado sin dictamen; `LEGAL_ENTITY` afirma "autónomo" sin alta; la renuncia al desistimiento no se verifica en el servidor | A5-B1, A6-P1, A6-P2 | `launch-plan.md:22-23,36-37`, `lib/legal/entity.ts:4-5`, `app/api/stripe/checkout/route.ts` (no lee `user_consents`) | Decidir camino 1 o 2 antes del 3 nov; corregir "autónomo" hasta el alta; exigir el consentimiento `withdrawal_waiver` en la ruta de checkout. Con 0 pagadores hoy, la urgencia depende de la fecha de lanzamiento |
| R2 | MEDIO-ALTO | 4 recetas activas etiquetadas `halal` contienen jamón (Revuelto de champiñones y jamón, Tostada con tomate y jamón serrano, Tostada francesa salada con jamón, Croissant con jamón y queso) y 3 más llevan vino (Mejillones al vapor, Conejo al ajillo, Ternera guisada). "Pastel de carne" (halal) usa "carne picada" sin especificar. Vegano/vegetariano/sin gluten: sin incoherencias reales (los 28 "vegano" con "leche" son leche de coco; "harina de maíz" en una arepa sin gluten) | A6-L6 | Consulta viva a `recipes.dieta` e `ingredientes_principales` (485 recetas halal) | Corregir la etiqueta o la receta; añadir un test de BD de coherencia dieta/ingredientes como el de alérgenos. Los alérgenos sí tienen red en 3 capas; las dietas no |
| R3 | ALTO (pre-lanzamiento) | El e2e real de Stripe está rojo desde el 2026-10-07: "Checkout anual crea una suscripción de Pro con cobro anual" espera otro `price_id` en staging. Issue #610 abierta. Es el único test del camino de pago real | A5-H5, A6-T13 | `stripe-e2e.yml` (runs 10-07 x2, 10-12 x3 en rojo), log: `Expected: "price_1U5pTQ..."` | Resolver el desajuste de precio anual entre `.env` de staging y la suite antes de probar el reembolso (T-4) |
| R4 | MEDIO | `Dependency audit` rojo hoy (high en `source-map-js`, transitiva de build); 3 PRs de Dependabot abiertos y fallando CI (#617, #495, más #451 de `uv`) | A6-D1 | `bun audit`: 1 high, 1 low; `gh run list` | Subir `source-map-js` por override o aceptar la excepción con fecha; resolver o cerrar los PRs |
| R5 | MEDIO | Copia de producción en `post-deploy-smoke.yml` y `stripe-e2e.yml` (`LIVE_E2E_ENV_FILE \|\| ENV_FILE`) y PAT de cuenta en `SUPABASE_ACCESS_TOKEN` | A6-D6 | `post-deploy-smoke.yml:101`, `stripe-e2e.yml:70` | Crear `LIVE_E2E_ENV_FILE` mínimo y token de proyecto; borrar el fallback |
| R6 | MEDIO | Recuperación: un único proyecto Free, RPO hasta 7 días, sin PITR; el RTO completo (Storage, Auth, secretos, Vercel, webhook) sigue sin medir | A6-D2 | ADR-0020 L126-128,173 | Aceptable con 4 usuarios; revisar antes del 1 dic o al primer pago real |
| R7 | MEDIO | Captcha: el código existe pero no se puede confirmar que esté activo en el Supabase hosted ni que la variable `NEXT_PUBLIC_TURNSTILE_SITE_KEY` esté en Vercel; el inicio de sesión anónimo sigue siendo gratis si no | A6-S7 | `lib/auth/captcha.ts:1-10`, `supabase/config.toml:226` | Verificar en el panel (Auth > Attack protection) y anotar el resultado en ADR-0003 |
| R8 | MEDIO | Copy falsa residual: "Cada semana mejora solo... Sin que tengas que decir nada" (el aprendizaje exige marcar recetas) | A6-P3 | `components/landing/how-it-works.tsx:26`; no está en `landing-claims.test.ts` | Reescribir y añadirla al test de claims |
| R9 | MEDIO | Patrón "reglas en capas que el actor salta": `enforce_admins:false`, `main` y `staging` sin PR; `git:promote` es voluntario | Externa #10, A6-D10 | `gh api .../protection` | Aceptado por escrito; reconsiderar con un segundo colaborador |
| R10 | BAJO | ADR-0040 (`Proposed` desde 2026-10-04) y ADR-0042 (desde 2026-10-08) con el código ya en producción. `adr:check` empezará a fallar el 2026-10-18 y el 10-22 | A6-A2 | `.context/ADR/ADR-0040...md:3-4`, `scripts/check-adrs.ts:13,23` | Aceptar o decidir antes de esas fechas |
| R11 | BAJO | REGRESIÓN de ramas: 32 remotas (25 ramas de PR ya mergeadas) | A5-H2 | `git branch -r` | Ampliar `stale-branch-cleanup.yml` a ramas con PR mergeado, o borrar en el flujo de `git:promote` |
| R12 | BAJO | Mapas de negocio otra vez desfasados 1 semana tras las migraciones de lista de espera, cantidades de ingredientes, `assign_recipe_to_slot` y `stripe_webhook_events` | A6-P11 | `rg` en `.context/business/*.md`: 0 coincidencias | Regla 17 de AGENTS (refrescar al cerrar un epic) |
| R13 | BAJO | Monitor de uptime sin ninguna ejecución programada observada (el workflow acaba de entrar en `main`) | A6-D7 | `gh run list --workflow uptime-monitor.yml`: solo `workflow_dispatch` | Mirar el primer cron; si no corre, revisar permisos y rama por defecto |
| R14 | BAJO | Capa de precios de supermercado inerte: runner solo probado en dry-run, `supermarket_product`/`price` con 0 filas; `observadoEn` fijo a 1970 | A6-D5, A6-A12 | Consulta viva; `catalog-connectors.ts:25` | Decisión de producto/legal (FRESCO-772 bloqueada); no urgente |
| R15 | BAJO | Duplicados menores (`assertRateLimitAllowed` x2), `nonce-substitution.ts` solo con test, `<a>` con `<button>` dentro | A6-A6, A6-A8, A6-L10 | Rutas arriba | Limpieza oportunista |

## 8. Notas de método y límites

- El clasificador bloqueó dos veces comandos que tocaban `.env.ci` y `head` encadenado; no se eludió ninguna. No se imprimió ni escribió ninguna credencial; los `supabase db query --linked` y `supabase migration list` usan la sesión ya enlazada.
- Las clases RESUELTO de los items de UI (A6-L*) se apoyan en código, tests de CI y el commit, no en un recorrido autenticado nuevo. Un recorrido móvil/tablet con Free y Pro sería la verificación que falta (FRESCO-864 sigue en Control de calidad según la bitácora).
- Estados de Jira y de la bitácora usados solo como pista; ninguna fila RESUELTO depende únicamente de ellos salvo las marcadas NO VERIFICABLE.
