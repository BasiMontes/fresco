# Cierre de la auditoría 4: verificación hallazgo a hallazgo (2026-10-12)

> Rama `perf/FRESCO-906-exclude-sharp` (HEAD 43c363e3; `main` = 112c2e95). El código es la fuente de verdad; Jira solo orienta.
> Fuentes: `2026-08-31-audit-4.html`, `-triage.md`, `-plan-a-5.md`, subcarpetas FRESCO-378/392/394/404, `audit-process.md`, `branch-protection.md`.
> Solo lectura: no se aplicó ni desplegó nada.

## 1. Evidencia en vivo (solo lectura)

| Comprobación | Resultado |
|---|---|
| `supabase migration list --linked` | Todas las migraciones locales tienen su par remoto. Sin migraciones sin aplicar (el gotcha de ola-3 está cerrado). |
| `supabase functions list` | Las 8 Edge Functions están `ACTIVE`, con `updated_at` 2026-10-07 09:23Z, que coincide con el último commit en `supabase/functions/` (99b74e2a, 11:23 CEST). `generate-shopping-list` se desplegó el 2026-10-09, el mismo minuto que su último commit. Sin deriva de despliegue. |
| Trigger en prod `user_profiles` | `protect_subscription_columns BEFORE INSERT OR UPDATE` (B1 cerrado en la base real). |
| `rate_limit_exempt_users` en prod | 0 filas (H9 cerrado). |
| Perfiles de pago huérfanos | 0 de 4 perfiles con `plan<>'free'` y sin `stripe_subscription_id`. |
| CHECK `recipes_alergenos_vocab` | Presente en prod. |
| Jira EPIC FRESCO-359 | Todas las hijas listadas (360-400, 404, 428-430) están `Finalizada`. Es una pista, no una prueba. |

Datos de prod que importan para algunos hallazgos: 7 usuarios en `auth.users`, 0 filas en `push_subscriptions`, catálogo de 538 recetas activas (1173 en total), 352 de las activas con foto.

## 2. Resumen

| Clase | Nº |
|---|---|
| RESUELTO | 57 |
| PARCIAL | 10 |
| NO RESUELTO | 1 |
| REGRESIÓN | 0 |
| NO VERIFICABLE | 3 |
| **Total** | **71** |

Por severidad:

| Severidad | RESUELTO | PARCIAL | NO RESUELTO | NO VERIFICABLE |
|---|---|---|---|---|
| BLOCKER (4) | 3 | 1 (B3) | 0 | 0 |
| ALTO (19) | 16 | 3 (H7, H8, H17) | 0 | 0 |
| MEDIO (27) | 22 | 3 (M11, M25, M26) | 0 | 2 (M15, M17) |
| BAJO (21) | 16 | 3 (L15, L16, L19) | 1 (L17) | 1 (L20) |

Los dos BLOCKER técnicos (B1 pago, B2 alérgenos) están cerrados con prueba automatizada y confirmados en la base de producción. B4 (métrica) está instrumentado. B3 (legal) tiene el mecanismo y los datos reales, pero no hay revisión de abogado.

## 3. Los 4 BLOCKER

| ID | Clase | Evidencia |
|---|---|---|
| A4-B1 pago | RESUELTO | `supabase/migrations/20260901120000_close_user_profiles_insert_subscription_bypass.sql:48-60` (rama INSERT que rechaza) y `:81-84` (trigger `BEFORE INSERT OR UPDATE`). Confirmado en vivo con `pg_get_triggerdef`. Test e2e que reproduce el exploit: `tests/steps/suscripcion-seguridad.steps.ts`; test de BD: `tests/db/rls-cross-user.test.ts:237-249`. El barrido de huérfanos es `sweepOrphanPaidPlans` en `lib/billing/reconcile.ts`, llamado desde `app/api/cron/stripe-reconcile/route.ts`. La variante de "okupa" del Stripe id (H3) queda cerrada por la misma rama INSERT. |
| A4-B2 alérgenos | RESUELTO | `20260901073555_allergen_filter_safety_net.sql:32-36` (CHECK de vocabulario) y `:60-66` (filtro con `lower()`). La definición vigente más reciente (`20260908180000_recipes_activo_soft_delete.sql:58-59`) lo conserva. Prueba de comportamiento: `tests/steps/seguridad-alimentaria.steps.ts` (BDD, etiqueta `@seguridad`). Comentario "Layer 2" retirado (`components/profile/ayuda-section.tsx:37` dice que no existe). |
| A4-B3 legal | PARCIAL | El banner "Borrador" ya no está en `app/` ni `components/`. El titular es real (`lib/legal/entity.ts:5`). Pero `lib/legal/consent.ts:6-8` declara los textos `PROVISIONAL`, "NOT validated by a lawyer" (versión `provisional-2026-10-06`). Domicilio publicado solo como localidad, brecha LSSI aceptada en el propio comentario. Brief de abogado en `.context/legal/FRESCO-434-brief-abogado.md`. La auditoría pedía "revisión legal real": no existe evidencia. |
| A4-B4 métrica | RESUELTO | `lib/posthog/event-names.ts:64-67` (`trial_started`, `trial_converted_to_paid`, `subscription_renewed`, `subscription_cancelled`) más `PAYMENT_FAILED`, `PLAN_DOWNGRADED`, `OTP_*`, `PUSH_*`, `ONBOARDING_*`. Emisión servidor desde `app/api/stripe/webhook/route.ts`. Person properties `plan`, `is_guest`, `signup_method` (`lib/posthog/events.ts:53`). Proxy `/ingest` (`next.config.mjs:102-108`). |

## 4. Todos los hallazgos

### ALTO

| ID | Clase | Evidencia / nota |
|---|---|---|
| H1 | RESUELTO | `supabase/functions/update-recipe-status/index.ts:57-60,92-115,141-155`: whitelist de estado, re-filtro de alérgeno vía RPC, sin duplicados, rate limit, guarda de estado terminal. Test: `tests/db/edge-functions/update-recipe-status.test.ts`. |
| H2 | RESUELTO | `20260901130000_reassign_guest_data_refilter_target_allergens.sql:57-82`. Desplegado (v30). |
| H3 | RESUELTO | Cerrado por la rama INSERT de B1. |
| H4 | RESUELTO | Job `deno:check` en `.github/workflows/pr-check.yml:88-116` (`deno check "**/*.ts"`) y es check obligatorio (`branch-protection.md`). |
| H5 | RESUELTO | `tests/db/edge-functions/` tiene un test por función (8/8). |
| H6 | RESUELTO | `scripts/check-coverage.ts` con suelo; paso `bun run test:coverage` en `pr-check.yml:85`. |
| H7 | PARCIAL | El e2e de PR ya no usa secretos: construye `.env` desde `.env.ci` (`pr-check.yml:272-301`, FRESCO-802). `post-deploy-smoke.yml:96-101` sigue cargando `LIVE_E2E_ENV_FILE \|\| ENV_FILE` (credenciales reales) y emite unos pocos eventos a PostHog/Sentry de prod por deploy (residuo documentado y aceptado en el propio workflow). |
| H8 | PARCIAL | `supabase/config.toml:194` `minimum_password_length = 10` y `password_requirements = ""`. La protección contra contraseñas filtradas (HIBP) quedó diferida a Supabase Pro (memoria + migración). No verificable el estado del hosted sin la Management API. |
| H9 | RESUELTO | Migración `20260901140000`; 0 filas en prod. |
| H10 | RESUELTO | La lista se genera sola al entrar (`app/(app)/shopping-list/page.tsx:19-58`, `components/shopping-list/shopping-list-generator.tsx`). |
| H11 | RESUELTO | `components/landing/pricing.tsx:7-8` solo anuncia las 4 diferencias Pro reales. Ya no hay "ilimitados"/"historial". |
| H12 | RESUELTO | `components/calendar/learning-bridge-card.tsx` (puente de la semana 1). |
| H13 | RESUELTO | Sin "con IA"/"a diferencia de ChatGPT" en `app/` ni `components/`. |
| H14 | RESUELTO | Wizard de 3 pasos más resumen (`lib/store/onboarding-store.ts:12`, `onboarding-step-household.tsx:72`: presupuesto opcional). |
| H15 | RESUELTO | Banner de permiso push en el momento de valor (`components/menu/push-prompt-banner.tsx`), envío instrumentado, copy en español de España. Nota: 0 suscripciones en prod (7 usuarios), así que el bucle no se ha ejercitado. |
| H16 | RESUELTO | `components/landing/impact-stats.tsx:3-13` sustituye las cifras inventadas. |
| H17 | PARCIAL | FRESCO-378 rellenó 35 defectos (alcance acotado, documentado en FRESCO-392). Hoy: 161 `Error` en Jira, 114 sin ningún enlace y 136 sin padre. Sigue la mayoría sin traza. El DoD (`.context/backlog/definition-of-done.md`) impide que se repita, pero el stock no es cero. Jira como pista. |
| H18 | RESUELTO | `.context/business/project-dev-guide.md` ya no menciona Gemini. |
| H19 | RESUELTO | README de audits corrige 4,3 (`.context/audits/README.md`). |

### MEDIO

| ID | Clase | Evidencia / nota |
|---|---|---|
| M1 | RESUELTO | `generate-meal-plan/menu-selector.ts:44-52,135-139` PRNG sembrado por (usuario, semana) y `20260901160000_stable_order_get_filtered_recipes.sql`. |
| M2 | RESUELTO | `20260901150000_fix_rating_average_denominator.sql` (`veces_calificada`) más `supabase/tests/recipe_learning_trigger.test.sql`. |
| M3 | RESUELTO | `menu-selector.test.ts:136,149` separa advertencia de seguridad y de variedad. |
| M4 | RESUELTO | `20260902120000_household_size_upper_bounds.sql`; `generate-shopping-list/index.ts:72`. |
| M5 | RESUELTO | `consolidator.ts:329` y test `consolidator.test.ts:157`. |
| M6 | RESUELTO | `20260902130000_swap_slots_skip_learning_guc.sql`: GUC y rate limit, sin `ALTER TABLE ... DISABLE TRIGGER` (solo queda en comentarios). |
| M7 | RESUELTO | `20260902140000_catalog_pagination_and_facets.sql`, `get_catalog` con test pgTAP; `20261007120000` fija tope de límite. |
| M8 | RESUELTO | `lib/text/runtime-parity.test.ts` fuerza la paridad entre runtimes. Nota: `send-weekly-reengagement-push/iso-week.ts` sigue siendo copia. |
| M9 | RESUELTO | `supabase/functions/_shared/sentry.ts`, usado en `_shared/http.ts:8`. |
| M10 | RESUELTO | CSP enforcing con nonce y `strict-dynamic`, sin `unsafe-inline` en scripts (`lib/security/csp.ts:1-19,107-109`; emitida desde `proxy.ts`). ADR-0019/0029/0031. `style-src` conserva `unsafe-inline` por decisión documentada. |
| M11 | PARCIAL | Diferido a Supabase Pro por diseño. ADR-0020 existe. Sigue habiendo un único proyecto (`jdqemhewjrjuopssdurn`) para todo y `post-deploy-smoke` crea usuarios y escribe en prod en cada deploy. |
| M12 | RESUELTO | `pr-check.yml:11` el e2e corre también en push a `staging` y la promoción a `main` es fast-forward (`docs/workflows/promotion.md:3`), así que el SHA de prod es el probado. `strict:false` sigue en la protección, aceptado. |
| M13 | RESUELTO | `scripts/check-seed-drift.ts`; job `seed-drift` en `migration-drift-check.yml:122`. |
| M14 | RESUELTO | `pr-check.yml:425` sube `playwright-report/`, `blob-report/`, `test-results/`. |
| M15 | NO VERIFICABLE | No localicé el e2e del moat que compare "cocinados" y "descartados" contra el menú generado (`tests/steps/aprendizaje-pro.steps.ts` solo cubre el caso sin historial y el caso con aviso). La cobertura puede estar en un test unitario; no se confirmó. |
| M16 | RESUELTO | Solo 2 tickets en "Control de calidad". Las épicas en "Listo" son trabajo abierto real, no shipeado. Jira como pista. |
| M17 | NO VERIFICABLE | La JQL por `Story`/`Story Points` no devolvió datos útiles (el tipo de issue se llama distinto en esta instancia). Es una decisión de proceso, no de código. |
| M18 | RESUELTO | FRESCO-388 dio AC observable a 245/246/249 (`2026-09-02-FRESCO-392-forward-only-closeout/README.md:14`). |
| M19 | RESUELTO | `bitacora.md` tiene 36 entradas y rotación aplicada (`bitacora-2026-09-to-10.md`). |
| M20 | RESUELTO | Congelado en `audit-process.md §4`; FRESCO-358 en `Rechazos`. |
| M21 | RESUELTO | ADR-0019 (cabeceras/CSP) y ADR-0020 (proyecto único) existen. |
| M22 | RESUELTO | `ADR-0005` lleva cabecera que corrige las decisiones de Gemini y los ids de modelo. El título sigue diciendo Gemini, pero con la nota de superado arriba. |
| M23 | RESUELTO | Según memoria, cerrado y verificado en vivo en FRESCO-393 (2026-09-02). No lo re-verifiqué contra Vercel. |
| M24 | RESUELTO | `GUEST_STARTED` separado de `USER_SIGNED_UP` (`event-names.ts`), `is_guest` como propiedad, proxy `/ingest`. |
| M25 | PARCIAL | Instrumentado (`OTP_SENT/VERIFIED/FAILED`) y documentado (ADR-0021), pero el envío sigue dependiendo del remitente Gmail SMTP: sin dominio propio no hay mejora de entregabilidad. |
| M26 | PARCIAL | Dificultad en blanco: 0 de 538 activas. Fotos: 186 de 538 activas sin foto (35%). Hoy el catálogo activo es la mitad que entonces (1173 totales), y el trabajo de fotos sigue (FRESCO-192/435). |
| M27 | RESUELTO | `components/calendar/slot-mark-controls.tsx:14` botones mayores; ventana de deshacer de 5 s (`use-slot-marking.ts:8`, evento `recipe_mark_undone`). |

### BAJO

| ID | Clase | Evidencia / nota |
|---|---|---|
| L1 | RESUELTO | `lib/auth/safe-next-path.ts` usado por `app/auth/confirm/route.ts`, con test. |
| L2 | RESUELTO | `supabase/functions/_shared/cors.ts:25-55` (`isHostedSupabase`). |
| L3 | RESUELTO | `lib/csv/export-csv.ts:7-12` (`FORMULA_TRIGGER`). |
| L4 | RESUELTO | `reassign-guest-data/index.ts:7` ya no usa `signInWithPassword`; verifica por token de sesión (ADR-0022). |
| L5 | RESUELTO | `app/qa/page.tsx:27-34` noindex y placeholder del project ref. |
| L6 | RESUELTO | `lib/api/admin-recipes.ts:41-53` escapa el filtro `.or()`. |
| L7 | RESUELTO | Ver H1. |
| L8 | RESUELTO | `generate-meal-plan/entitlement.ts` (`isProEntitlementActive`) usado en `index.ts:123`. Solo verifiqué el gate del servidor, no los usos de `profile.plan` en cliente. |
| L9 | RESUELTO | `20260902150000_swap_slots_reject_excluida.sql` más `supabase/tests/swap_meal_plan_slots.test.sql:47,56`. |
| L10 | RESUELTO | `consolidator.ts:313-372` abre grupo nuevo en vez de descartar. |
| L11 | RESUELTO | `delete-account/index.ts:12-54` reauth reciente y rate limit (ADR-0023). |
| L12 | RESUELTO | `lib/date/iso-week.ts:12-32` marco UTC íntegro. |
| L13 | RESUELTO | Sin el comentario de "stubs" en `lib/api/edge-functions.ts`. |
| L14 | RESUELTO | `regression.feature`: 144 escenarios, 144 `@automatizado`, 0 `@pendiente` reales. |
| L15 | PARCIAL | Hay 133 etiquetas `@verificado-manual-<fecha>`; siguen siendo fechas pasadas que pueden leerse como garantía vigente. No comprobé si el README de `qa/` lo advierte. |
| L16 | PARCIAL | Acciones ancladas por SHA (`post-deploy-smoke.yml:65-71`). El job sigue corriendo con `ENV_FILE` real en scope tras un `deployment_status`. |
| L17 | NO RESUELTO | `tests/steps/generacion-determinista.steps.ts:22,51-56` mantiene `MAX_GENERATION_MS = 10_000` y `retries: 1` en CI (`playwright.config.ts:55`): un reintento reinicia el cronómetro y enmascara una regresión de latencia. El comentario de cabecera aún habla de la llamada a Gemini, que ya no existe. |
| L18 | RESUELTO | Ya no hay "Ver demo" en `components/landing/`. No revisé la fecha del mock del hero. |
| L19 | PARCIAL | `dev`, `staging` y `main` apuntan al mismo commit (f4a93ab6) y `_orphans/` ya no existe. Quedan 36 ramas locales (eran 28). |
| L20 | NO VERIFICABLE | Depende de `scripts/sync-jira-issues.ts` y de la caché PBI (gitignorada); no la regeneré para no escribir. |
| L21 | RESUELTO | `csp.ts:109`: `unsafe-eval` solo en desarrollo. |

## 5. Brechas residuales (ordenadas por severidad)

| # | Hallazgo | Severidad | Brecha | Acción propuesta |
|---|---|---|---|---|
| 1 | A4-B3 | ALTA | Textos legales marcados `PROVISIONAL`, sin revisión de abogado. El banner se quitó sin la evidencia que pedía el hallazgo. Audit-6 A6-P1 ya señalaba lo mismo para FRESCO-434. | No cobrar hasta tener la revisión. Aceptar el riesgo con ADR si se decide lanzar sin ella. |
| 2 | A4-H17 | MEDIA | 114 de 161 defectos sin enlace; 136 sin padre. Se cerró un subconjunto, no el stock. | Backfill acotado o aceptar el residuo con su ticket, según el DoD. |
| 3 | A4-L17 | MEDIA | La aserción `<10 s` sigue siendo frágil con reintento. | Medir sin reinicio entre reintentos, o fallar sin retry en ese escenario. |
| 4 | A4-H8 | MEDIA | Sin protección HIBP (depende de Pro). | Dejar anotado en ADR/launch checklist; revisar al contratar Pro. |
| 5 | A4-H7 / L16 / M11 | MEDIA | El smoke post-deploy sigue usando credenciales reales y escribe en el único proyecto Supabase de prod. | Aceptado por diseño; documentar o aislar con Pro. |
| 6 | A4-M26 | BAJA | 35% de las recetas activas sin foto. | Continuar FRESCO-192/435. |
| 7 | A4-M25 | BAJA | OTP por Gmail SMTP sin dominio propio. | Reabrir cuando haya dominio (hoy sin gasto). |
| 8 | A4-M15, M17, L20 | BAJA | No verificables desde código. | Comprobar a mano. |

Detalles menores: la mejora del tipado `deno check` solo cubre `supabase/functions`, y `iso-week.ts` del push sigue duplicado (M8, cubierto por test de paridad).

## 6. Limitaciones

- No se leyó el HTML completo del informe línea a línea; la lista de 71 ID se extrajo del triaje y se cotejó con los ID del HTML (el único que faltaba en el triaje, A4-H3, está recogido).
- Jira y la memoria del proyecto se usaron solo como pista (M16, M17, M23, H17).
- No se ejecutó ninguna suite de tests: se verificó que existen y qué cubren, no que hoy pasen en verde.
