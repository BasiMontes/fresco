# Auditoría 6 — Eje Testing/CI (rúbrica v1)

Commit auditado: `3fe02a95` (origin/main == HEAD, árbol limpio salvo `brag-output/` sin trackear). Fecha: 2026-10-02. Solo lectura sobre el repo; las mediciones se hicieron con salidas en el scratchpad.

## Puntuación: **3,5 / 5** (auditoría 5: 4 / 5)

Baja medio punto porque aparecen **2 ALTO** nuevos: el BLOCKER de auditoría 5 se cerró sin test de regresión del ataque, y la función edge destructiva de admin no tiene ningún test. Además, el 87,8 % de cobertura está inflado por un denominador que excluye los ficheros que ningún test importa. La base (suite verde, e2e rápido, aislamiento, gates de drift) sigue siendo sólida.

## Mediciones (reproducibles)

| Medida | Resultado |
|---|---|
| `bun test` | 1558 pass / 0 fail / 117 skip (los 117 son `tests/db/**` gateados por `RUN_DB_INTEGRATION`) — 26 s |
| `bun run types:check` | exit 0 |
| `bun run lint:check` | exit 0 |
| Cobertura (líneas ponderadas, mismo cálculo que `scripts/check-coverage.ts`) | 87,79 % líneas (suelo 86,2) · CI: 86,28 % funciones (suelo 84,5) · margen 1,6 pp |
| Ficheros fuente que ningún test carga | 132 de 278 en `app/ components/ lib/ supabase/functions/` (fuera del denominador de lcov) |
| Tests sin ningún `expect` (heurística, 1128 bloques `test()`) | 1 (`lib/api/push-subscriptions.test.ts:75`) |
| Skips/fixme estáticos | 1 `describe.skipIf` de caché (`lib/grocery/consum-catalog.test.ts:28`), `tests/db/**` condicionales, 3 `test.skip(true)` en `tests/steps/registro-progresivo-edge.steps.ts:132,157,206` |
| Orden aleatorio (`bun test --randomize --seed=1/2/3`) | **65 / 48 / 15 fallos** (0 en orden por defecto) |
| CI `pr-check.yml`, últimos 100 runs | 100 success |
| Job `test:e2e` (60 runs recientes) | mediana 301 s (5m01); p-max 686 s; 5 runs ≥ 530 s |
| e2e en CI | 110-111 escenarios en 1,8 min de ejecución; 4 workers, `fullyParallel`, `retries: 1`; ~12 % de los runs recientes con 1 test "flaky" |
| `regression.feature` | 170 escenarios, 116 `@automatizado` (5 son `@requiere-stripe-real`), 0 `@pendiente`, 3 `@smoke` |
| Required checks vivos (main, staging, dev) | `repo:check`, `test:unit`, `test:e2e` · `strict:false` · `enforce_admins:false` |
| Post-deploy smoke | 9 success / 21 skipped (entornos no Production) en 30 runs |

## Hallazgos

| ID | Sev. | Hallazgo | Evidencia | Escenario de fallo | Fix |
|---|---|---|---|---|---|
| A6-T1 | **ALTO** | El BLOCKER de auditoría 5 (`meal_plan_recipes`, FRESCO-729) se cerró **sin test del ataque**. Ningún test hace un PATCH directo del propietario sobre `estado/rating/recipe_id/sustitucion_ingrediente` esperando `P0001`. | Commit `39a34bef` solo añade happy-paths (`tests/db/edge-functions/update-recipe-status.test.ts`, `generate-shopping-list.test.ts`). `tests/db/rls-cross-user.test.ts:132-151` solo prueba *otro* usuario (que ya bloquea RLS). `rg 'protect_meal_plan_recipes\|mpr_trusted_write' tests supabase/tests` = 0 resultados. | Una migración futura reemplaza el trigger o restituye el `GRANT UPDATE` de tabla completa: CI en verde y vuelve el bypass de rate-limit/alérgenos que auditoría 5 calificó BLOCKER. | Test en `tests/db/` (owner PATCH de cada una de las 4 columnas → 400 `P0001`; mismo UPDATE vía RPC confiada → OK) + caso pgTAP en `supabase/tests/`. |
| A6-T2 | **ALTO** | Función edge **destructiva de admin** sin ningún test; además otras dos funciones edge sin test. | `supabase/functions/delete-catalog-recipe/index.ts` (92 l) y `_shared/admin.ts:16-25` (gate por allowlist `ADMIN_USER_ID`): 0 tests unitarios, 0 en `tests/db/edge-functions/` (solo cubre delete-account, generate-meal-plan, generate-shopping-list, reassign-guest-data, update-recipe-status), 0 escenarios. Tampoco `get-shopping-list-suggestions/index.ts` (111 l) ni `send-weekly-reengagement-push/index.ts` (175 l, envía push masivo). | Un refactor del parseo de `ADMIN_USER_ID` (p. ej. cambiar `includes` o el `filter(Boolean)`) deja que cualquier usuario autenticado borre recetas del catálogo con service-role (RLS no protege tras el gate). CI en verde. | Unit de `requireAdminUser` (vacío, espacios, lista CSV, id ausente) + test HTTP negativo 401/403 de `delete-catalog-recipe` en `tests/db/edge-functions/`; smoke de contrato para las otras dos. |
| A6-T3 | **ALTO** | La red de seguridad en BD (RLS, SECURITY DEFINER spoof, edge HTTP, precios de supermercado) **no es required check y falla en abierto**. | Protección viva: contexts = `repo:check`, `test:unit`, `test:e2e`; `test:db-integration` y `deno:check` no están (`pr-check.yml:93-140`, `gh api .../protection`). Y `describe.skipIf(!(RUN && reachable))` con una única sonda de 2,5 s (`tests/db/harness.ts:147-157`): reproducido, con `RUN_DB_INTEGRATION=1` y sin stack → `0 pass / 117 skip`, exit 0. Además el flujo real es ff-push a staging/main, donde los checks de `push` no bloquean nada. | (a) El job se pone rojo y se puede mergear igual. (b) Un timeout de la sonda a PostgREST salta los 95 tests y el job sale verde: es justo la red que cerró los BLOCKER 4 y 5. | Añadir `test:db-integration` y `deno:check` a required checks (`bun run git:policy apply`); en `harness.ts`, si `RUN` y `!reachable` → `throw` (no skip) y reintentar la sonda; exigir `pass >= N` en el job. |
| A6-T4 | MEDIO | El suelo de cobertura mide solo ficheros cargados: **132/278 ficheros fuente (≈47 %) están fuera del denominador**. | lcov solo trae 182 ficheros; sin cargar: `supabase/functions/generate-meal-plan/index.ts` (169 l de código), `app/signup/page.tsx` (433), `recipe-library.tsx` (319), `calendar-grid.tsx`, `menu/page.tsx`, etc. (≈8,4k líneas no vacías). Estimación honesta de cobertura unitaria ≈ 50-55 %, no 87,8 %. El propio `check-coverage.ts` (cabecera) reconoce que cargar ficheros nuevos "baja" el total, es decir, cargar menos lo sube. | El suelo se "mejora" borrando un import de test; el número da falsa confianza sobre handlers y páginas críticas. | Medir con `coverage` incluyendo todos los ficheros (script que sume ceros para no cargados) o publicar los dos números; ratchet sobre el honesto. |
| A6-T5 | MEDIO | **Tests dependientes del orden**: con `--randomize` fallan 15-65 tests. | `bun test --randomize --seed=1/2/3` → 65/48/15 fallos; seed 3: `lib/ingredients/confirm-substitution.test.ts` (rpcCalls vacío), `get-safe-substitutes.test.ts`, `POST /api/stripe/checkout`, `lib/posthog/server`, `CookieSettingsDialog`, `ShoppingListView`. Cada fichero pasa aislado. 15 ficheros usan `mock.module` (`@/lib/supabase/server` ×5, `@/lib/stripe` ×4). Es la causa de la "flakiness de mocks Stripe" que auditoría 5 anotó sin ticket. | Añadir/renombrar un fichero de test reordena la carga y rompe CI en un PR ajeno; peor, un mock filtrado puede hacer que un test pase vacío (afecta a los libs de sustitución segura por alérgenos). | `mock.restore()`/`afterEach` y registro de mocks acotado por fichero; job nocturno con `--randomize` y semilla impresa. |
| A6-T6 | MEDIO | **Cero cobertura de viewport móvil** en e2e, justo donde se está trabajando (épica 484, FRESCO-773, 478-483). | `playwright.config.ts:76` solo `Desktop Chrome`; `rg 'setViewportSize\|devices' tests` sin resultados. FRESCO-773 (#442, `1dd701ad`) cambió solo clases (`min-w-76`→`min-w-72`, `components/onboarding/planning-selection-grid.tsx`); los tests (`planning-selection-grid.test.tsx:46`) cuentan 21 celdas en happy-dom, que no mide layout. | El grid de 7 días vuelve a tener scroll horizontal a 360 px tras cualquier cambio de padding: CI verde. | Proyecto Playwright `mobile` (360×740) con 1-2 escenarios `@mobile` que asserten `scrollWidth <= clientWidth` del grid y tap targets ≥ 44 px. |
| A6-T7 | MEDIO | **Flakes enmascarados por `retries: 1`** y sin presupuesto de flakiness; outliers de duración frente a ADR-0018. | 3 de los últimos 25 runs con "1 flaky" (36933988128, 36922824394, 36916539383) y otro con "2 flaky" (36886992019, tests de `@aprendizaje` y Biblioteca); el último commit `3fe02a95` arregla dos escenarios racy. Duración: mediana 301 s (OK frente a 6m30 de ADR-0018) pero 5/60 runs ≥ 530 s (máx 686 s = 11m26) por reintentos de pull de imágenes (`Retrying after 4s: public.ecr.aws/supabase/postgres`, run 36912651997); no es "sostenido", pero no se monitoriza. | Un test con 15-20 % de fallo pasa por reintento y se normaliza; una regresión real intermitente se esconde. | Fallar o anotar en el job summary cuando `flaky > 0`; ticket por flake; cachear imágenes o fijar timeout de `supabase start`. |
| A6-T8 | MEDIO | Incumplimiento de la DoD (tests en el mismo PR) en cambios recientes: FRESCO-333 y FRESCO-773. | FRESCO-333 fix `c4fa8adf` (#443, `supabase/functions/generate-meal-plan/index.ts`, 7 líneas) entró sin test; el e2e llegó en #444, otro PR. `generate-meal-plan/index.ts` no se carga en unit (169 líneas sin cobertura). Además `tests/steps/aprendizaje-pro.steps.ts:88-94` asserta "no se mezcla con el banner" **solo si** el banner está visible (condicional): en el escenario sin historial nunca lo está, así que no comprueba nada. | Ventana de un PR (más el deploy) con el comportamiento Pro sin red; el step condicional da falsa seguridad. | Aserción incondicional (`expect(banner).toHaveCount(0)` o comparar si existe), y test en el mismo PR del fix. |
| A6-T9 | BAJO | Capa de precios de supermercado: lógica pura al 100 %, pero el cableado y el escritor dependen de capas no required. | `lib/grocery/supermarket/price-store.ts` 5,5 % en unit (solo cubierto por `tests/db/supermarket-price-store.test.ts`, A6-T3); `scripts/refresh-supermarket-prices.ts` (168 l, `--apply` con service-role) sin test y excluido de cobertura; el workflow `refresh-supermarket-prices.yml` es solo `workflow_dispatch`. | Un `--apply` con un bug de cableado escribe precios erróneos y solo se ve en producción. | Test del `main` del script con conector falso y `apply=false`; dry-run obligatorio previo. |
| A6-T10 | BAJO | `proxy.ts` (CSP con nonce, cabecera `Reporting-Endpoints`) sin test. | `buildContentSecurityPolicy` tiene unit (`lib/security/csp.test.ts`), pero ni unit ni e2e comprueban que la cabecera sale en la respuesta. | Un refactor del proxy deja la CSP sin enviar; solo lo ve un auditor. | Unit de `proxy()` con `NextRequest` y aserción de la cabecera `Content-Security-Policy` con nonce. |
| A6-T11 | BAJO | Deriva documental/test: suelo de cobertura, ADR-0018 y comentario del feature. | `.context/qa/coverage-ratchet.md` dice suelo 82,0/84,0 y el script `scripts/check-coverage.ts:78` tiene 84,5/86,2; el job imprime "consider raising FLOOR" (margen 1,6 pp, no actuado). ADR-0018 (Accepted) sigue describiendo `workers: 1`; la migración a paralelo (FRESCO-356, `playwright.config.ts:50-51`) no lo actualiza. `regression.feature:~957` dice "real Gemini call — sin mock" para un motor determinista desde ADR-0005. | Auditores y devs leen umbrales y arquitectura falsos. | Alinear los tres textos; subir el suelo a 87,0/85,5. |
| A6-T12 | BAJO | Skips permanentes y esperas fijas. | `tests/steps/registro-progresivo-edge.steps.ts:132,157,206` `test.skip(true, 'FRESCO-89 …')`; `lib/api/push-subscriptions.test.ts:75` sin aserción; `waitForTimeout` fijo en `tests/steps/aprendizaje.steps.ts:143` (1000 ms), `login.steps.ts:109`, `recuperar-password.steps.ts:85` (500 ms) antes de aserciones negativas. | Falso verde si el efecto tarda más que la espera; los skips no se contabilizan. | Esperar a la condición (`waitForResponse`/`toPass`); borrar o resucitar los escenarios de FRESCO-89. |
| A6-T13 | BAJO | Los jobs programados/post-deploy no avisan al fallar y siguen sin validación por programación. | `stripe-e2e.yml` (cron lunes 06:00): único run hasta ahora `workflow_dispatch` 2026-09-29; el primer cron real será 2026-10-05. `post-deploy-smoke.yml` solo 3 `@smoke`, sin notificación ni rollback. | Un fallo semanal o post-deploy pasa desapercibido hasta que alguien mira Actions. | Step de aviso (issue/Slack) en `failure()`; verificar el primer cron del 05-10. |

## Positivos verificados

- Verde reproducido en local: `tsc` 0 errores, `eslint` 0, `bun test` 1558/0 fallos; CI 100/100 runs correctos en `pr-check.yml`.
- Gate de cobertura real (`scripts/check-coverage.ts`) con suelo ponderado por líneas; margen 1,6 pp (auditoría 5: 0,9 pp).
- e2e: stack Supabase local efímero + aserción de aislamiento anti-prod (`pr-check.yml` paso "Assert e2e is isolated"), build en segundo plano, 4 workers; mediana 5m01 con 110 escenarios (ADR-0018: umbral temprano 6m30 no sostenido). Artefactos de trazas subidos (A4-M14 cerrado).
- `.env.ci` sobrescribe Stripe/PostHog/Sentry en el e2e de PR (A4-H7 cerrado) y la fixture `suscripcionCtx` borra clientes Stripe test (FRESCO-376, `tests/fixtures.ts:35`).
- Guardrail de alérgenos: 6 escenarios e2e (mayúsculas, cada alérgeno, sustitución 422, whitelist de estado, reassign-guest) + `tests/db/` con usuarios reales + property tests fast-check (`menu-selector.test.ts:356+`, semilla fijada); `Math.random` sustituido por semilla (A4-M1 verificado, `menu-selector.ts:139`).
- Pagos: `app/api/stripe/webhook/route.ts` 93,2 %, `checkout` 100 %, `stripe-reconcile` 99,2 %, `portal` 91,4 %; cron semanal `stripe-e2e.yml` (A5-H5 cableado).
- RLS/SECURITY DEFINER: `tests/db/rls-cross-user.test.ts`, `security-definer-spoof.test.ts` (13), contrato HTTP de 5 funciones edge contra runtime real; 4 ficheros pgTAP en CI.
- Capa de precios de supermercado (FRESCO-752/767-771): `connector`, `matcher`, `units`, `refresh-plan`, `refresh-run`, `price-write`, `demand`, `mercadona-dataset` al 100 % con conector falso inyectado (no se mockea el módulo real).
- Gates de drift: `deno check/lint` de edge functions, `check-seed-drift.ts`, `migration-drift-check.yml`, `edge-functions-drift.yml`.
- Calidad de aserciones: 1 solo test sin `expect` de 1128 bloques revisados; 0 `.only`, 0 `test.fixme`, 0 `@pendiente` en `regression.feature`.
- axe-core en 9 escenarios a11y: bloquea serious/critical, allowlist vacía.

## Regresiones de hallazgos de auditorías 4 y 5 (Testing)

| Hallazgo | Estado hoy | Evidencia |
|---|---|---|
| A4-B2 (alérgenos sin tests de comportamiento) | **Sigue cerrado** | 3 escenarios e2e + property tests + DB (`.context/qa/regression.feature:400-437`) |
| A4-H4 (edge functions sin tsc/deno check en CI) | **Cerrado**, pero el job no es required (ver A6-T3) | `pr-check.yml` job `deno` |
| A4-H5 (handlers edge sin test) | **Parcial**: 5 de 8 funciones con contrato HTTP; faltan delete-catalog-recipe, get-shopping-list-suggestions, send-weekly-reengagement-push (A6-T2) | `tests/db/edge-functions/` |
| A4-H6 (cobertura no medida) | **Cerrado**, con denominador inflado (A6-T4) | `scripts/check-coverage.ts` |
| A4-H7 (secretos prod en CI) | **Cerrado en e2e de PR**; smoke post-deploy y stripe-e2e siguen con `ENV_FILE` real (aceptado/ADR-0020) | `.env.ci`, `fixtures.ts:35` |
| A4-M1 (jitter `Math.random`) | **Cerrado** | `menu-selector.ts:46,139` + test de determinismo `menu-selector.test.ts:232` |
| A4-M12 (SHA de producción sin e2e) | **Cerrado** | `pr-check.yml` push a `staging` ejecuta e2e |
| A4-M13 (seed.sql vs prod) | **Cerrado** | `scripts/check-seed-drift.ts` |
| A4-M14 (trazas retry perdidas) | **Cerrado** | `upload-artifact` con `if: always()` |
| A4-M15 (moat solo asserta descartadas) | **Cerrado** | comentario FRESCO-387 en `regression.feature:~936` |
| A5-H5 (suite `@requiere-stripe-real` sin CI) | **Cerrado** | `.github/workflows/stripe-e2e.yml` (primer cron real pendiente, A6-T13) |
| A5-M1 (`createMockClient` duplicado) | **Sigue abierto**: 9 definiciones en `lib/api/*.test.ts`, `lib/ingredients/*.test.ts`, `lib/menu/get-spend-trend.test.ts` | `rg 'function createMockClient\|createRpcMockClient'` |
| A5 "suelo de cobertura sin ratchear" (0,9 pp) | **Mejorado** a 1,6 pp, aún sin subir | `check-coverage.ts:78` vs CI 87,87 % |
| A5 "2 fallos de mocks Stripe bajo suite completa" | **Causa raíz sin arreglar**: hoy 0 fallos en orden por defecto, pero 15-65 con orden aleatorio (A6-T5) | `bun test --randomize` |
| A5-B2 (BLOCKER `meal_plan_recipes`) | **Fix presente, sin test de regresión del ataque** (A6-T1) | commit `39a34bef` |

## Resumen de conteos

BLOCKER 0 · ALTO 3 · MEDIO 5 · BAJO 5 (13 hallazgos)
