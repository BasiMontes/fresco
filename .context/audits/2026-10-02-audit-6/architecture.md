# Audit-6 · Eje Arquitectura/código

> Rúbrica v1 (misma que auditorías 2-5). Base: `origin/main` = `3fe02a95` (2026-10-02). Solo lectura. Mediciones propias con AST de TypeScript (scripts en el scratchpad), `rg`, `bun audit`, `bun outdated`, lectura de `node_modules/next/dist/docs` (convenciones de Next 16 verificadas: `proxy.ts` en lugar de `middleware.ts`, `params`/`searchParams` asíncronos; el repo las cumple).

## Puntuación: **3,5 / 5** (audit-5: 3,0)

| Severidad | Nº |
|---|---|
| BLOCKER | 0 |
| ALTO | 2 |
| MEDIO | 7 |
| BAJO | 6 |

Sube medio punto porque A5-H3, A5-H4 y buena parte de A5-M1 se cerraron de verdad y la capa nueva de supermercados está bien diseñada. No sube más porque las reglas de AGENTS.md §10 no se hacen cumplir con herramientas (33 violaciones reales, no 3), reaparecen ADRs en `Proposed` con el código ya enviado, y la capa de supermercados filtra cadenas concretas a UI y tipos pese al ADR-0036.

## Mediciones

| Métrica | Valor |
|---|---|
| Fuentes de producto (app/components/lib/supabase/functions, sin tests) | 292 archivos |
| Archivos > 400 líneas en producto | 4: `app/signup/page.tsx` 624, `lib/api/user-profile.ts` 600, `components/shopping-list/shopping-list-view.tsx` 599, `supabase/functions/generate-shopping-list/aisle-pricing.ts` 407 |
| Archivos > 400 líneas en `scripts/` y `cli/` (tooling heredado del boilerplate) | 19 (máx. 3775 `scripts/sync-jira-issues.ts`) |
| Funciones con 3+ parámetros posicionales (§10) | **33** (ver A6-A1) |
| Funciones con complejidad ciclomática >= 15 / >= 10 | 13 / 46 |
| Máximos | `SlotCell` 31, `selectMenu` 29, `OnboardingPage` 28, `generate-meal-plan/index.ts` handler 24, `stripe-reconcile GET` 21, `generate-shopping-list/index.ts` 21 |
| `any` explícito | 0 |
| `@ts-ignore` / `@ts-expect-error` | 0 / 0 |
| Casts `as X` (sin `as const`) | 106 (10 son `as unknown as`, 8 de ellos en `lib/api/recipes.ts:26-33`) |
| Non-null `!` | 13 |
| Imports relativos profundos (`../../`) en producto | 0 (6 archivos de test) |
| Ciclos de dependencias (grafo de imports de runtime, 279 módulos) | **0** |
| `console.error` en app/components/lib (sin tests) | ~28, todos con prefijo `[contexto]`, política consistente |
| `bun audit` | 13 vulnerabilidades (7 high, 5 moderate, 1 low) |
| `bun outdated` | 12 paquetes con versión nueva; ninguno crítico |

## Hallazgos

### ALTO

**A6-A1 · Las reglas de §10 no están automatizadas y se incumplen 11 veces más de lo que se creía** (ALTO)
- Evidencia: 33 funciones de producto con 3+ posicionales. Peores: `lib/api/shopping-list.ts:85 toggleShoppingListItem` (5), `:137 addShoppingListItem` (4), `:197 getNombresNuevos` (4), `lib/grocery/supermarket/price-store.ts:86 leerProductosSeguidos` (4), `refresh-run.ts:67 refrescarCadena` (4), `lib/ingredients/confirm-substitution.ts:16` (4), `supabase/functions/_shared/sentry.ts:60` (4). Más: `lib/api/meal-plan.ts:141,305`, `lib/api/recipes.ts:91,159,276,356`, `lib/api/favorites.ts:89,116`, `lib/stripe.ts:143`, `app/api/stripe/webhook/route.ts:198`. Audit-5 dejó "3 violaciones" sin ticket; la cifra era una subestimación y no hay nada que impida crecer.
- Causa raíz: `eslint.config.js` no tiene `max-params`, `complexity`, `max-lines`, ni `no-restricted-imports`/`import/no-cycle` para `app/`, `components/`, `lib/` (el único `no-restricted-imports` está en el bloque `cli/**`, línea ~160). Las capas (UI no importa DB; `lib` no importa `components`) y el límite de params son convención oral.
- Fix: activar `max-params: ['error', 2]` (con excepción para tests y generated) y `complexity: ['warn', 15]`; `no-restricted-imports` para `@/lib/supabase/*` en `components/**`; `import/no-cycle`. Migrar las 33 a objeto de opciones en un solo PR mecánico, empezando por `lib/api/shopping-list.ts`.

**A6-A2 · Reaparece el patrón A5-H4: ADRs con el código ya enviado siguen en `Proposed`** (ALTO)
- Evidencia: `ADR-0032` (catálogo de sustituciones, RPC INVOKER) y `ADR-0033` (almacenamiento por slot) siguen `Proposed`; su implementación está en main desde el 25-sep (migraciones `20260925120000`, `20260925130000`, `lib/ingredients/*`, `generate-shopping-list`), y `ADR-0036` ya los cita como contrato vigente (`ADR-0036:24`, `:57`). `ADR-0035` (cookie JS-legible) lleva `Proposed` desde el 29-sep (`9a40daf6`) con CSP enforcing ya en producción. Además: `ADR-0002-multi-harness-single-source.md` y `ADR-0002-position-swaps-bypass-learning-trigger.md` comparten número, y el primero **no figura en `.context/ADR/README.md`** (solo la línea 65 del segundo).
- Positivo parcial: 0022-0026 (A5-H4) sí están `Accepted` ahora.
- Fix: pasar 0032/0033 a `Accepted` con fecha y commit; decidir 0035 (aceptar o rechazar, no dejar en limbo); renumerar el ADR-0002 duplicado (p. ej. 0038) y reindexar el README; añadir un check (`scripts/` ya tiene linters) que falle si un ADR `Proposed` tiene más de 14 días o si el README no lista todos los ficheros.

### MEDIO

**A6-A3 · La capa de supermercados viola su propio ADR-0036 ("añadir cadena = añadir conector, nunca tocar consumidores")** (MEDIO)
- `components/shopping-list/shopping-list-view.tsx:428-429` y `:522-540`: `precios.find(p => p.cadena === 'mercadona')` / `'consum'` con un bloque JSX y `data-testid` por cadena. Una tercera cadena obliga a editar la UI.
- `lib/grocery/types.ts:45`: `OrigenEnvase = 'mercadona' | 'consum' | 'estimado'` (unión cerrada; `supermarket/types.ts` dice expresamente que `CadenaId` es `string` "para que una cadena nueva no toque ningún tipo"). El diccionario generado (`lib/grocery/ingredient-dictionary.ts`, 105 menciones) hornea la cadena por ingrediente.
- `catalog-connectors.ts:105`: `if (cadena !== 'mercadona')` dentro de `productosParaCarga` (lógica especial por cadena en código "agnóstico").
- `map-item.ts:85-87`: filtra por `conector.cadena !== entry.origenEnvase`, así que `precios` tiene como mucho 1 elemento: la comparación entre cadenas que ADR-0036 vende como "comparable por construcción" no existe aún en la UI.
- Fix: la UI itera `precios` y pinta un enlace genérico con `nombreCadena`; `OrigenEnvase = CadenaId | 'estimado'`; mover el especial de Mercadona a un campo del conector (`idExternoDesdeUrl`).

**A6-A4 · Puerta de permisos: bien en el registro, evitable por funciones exportadas** (MEDIO)
- Bien: `puedeEjecutarse` es fail-closed (`connector.ts:~60`), `registro.get` lanza `PermisoNoConcedidoError`, `map-item.ts:85` solo usa `activos()`, y la BD replica la regla con `CHECK` (`20261001180000_supermarket_price_model.sql:28-32`) y un test de deriva.
- Mal: `productoDeCatalogo`, `productosDeCatalogo`, `productosParaCarga` (`catalog-connectors.ts:71,80,103`) leen el catálogo **sin** pasar por el registro; el comentario dice "callers must go through the registry first" pero nada lo fuerza. Además `PRODUCTOS_POR_CADENA` es un Map de módulo rellenado como efecto secundario al importar (`:68`, `:132`), con acoplamiento de orden. El registro "en vivo" del script (`scripts/refresh-supermarket-prices.ts:~85`) es un segundo registro paralelo con un `permiso` declarado en otro sitio.
- Además hay tres fuentes de verdad de permisos: conector (código), seed SQL, filas `habilitada` en BD; solo el script avisa (`::warning::`) de deriva.
- Fix: que esas tres funciones reciban el `registro` o el conector y devuelvan `[]` si `!puedeEjecutarse`; derivar el seed SQL del registro o dejar la BD como única fuente.

**A6-A5 · God-components: A5-M1 mejora pero se desplaza** (MEDIO)
- Cerrado: `calendar-grid.tsx` 787 a 271 y `onboarding/page.tsx` 856 a 293 (FRESCO-739, `b0862fd0`).
- Pendiente: el trozo extraído `components/calendar/slot-cell.tsx:62 SlotCell` tiene complejidad **31** (la mayor del repo) con 274 líneas; `OnboardingPage` sigue en 28; `app/signup/page.tsx` 624 líneas / CC 16 (`SignupPage`, :35); `shopping-list-view.tsx` 599 líneas (client component que importa diccionario de 52 KB + 2 catálogos de 18-24 KB, ver A6-A9); `lib/api/user-profile.ts` 600 líneas mezclando perfil, plan, avisos, cookies e identidad.
- `createMockClient` sigue duplicado en **7** tests (`get-spend-trend`, `push-subscriptions`, `user-profile`, `recipes`, `meal-plan`, `admin-recipes`, `shopping-list`); FRESCO-739 anunciaba "dedupe test mocks" pero esta duplicación sigue.
- Fix: partir `SlotCell` (estado de drag / menú de marcado / render) y `signup/page.tsx` (formulario + OTP), trocear `user-profile.ts` por dominio, extraer `lib/fixtures/mock-supabase-client.ts`.

**A6-A6 · Duplicados nuevos tras la limpieza de A5-H3** (MEDIO)
- `loadPosthog()` idéntica en 3 sitios con su propia caché (`app/providers/posthog-provider.tsx:24`, `components/legal/cookie-consent-context.tsx:16`, `lib/posthog/events.ts:30`).
- `readCssDurationMs` idéntica en `components/ui/dialog.tsx:35` y `components/ui/filter-drawer.tsx:31`; variante `readMs` en `components/profile/nombre-form.tsx:23` y `preferences-form.tsx:28`.
- `capitalize` en `scripts/clean-recipe-names.ts:78` (copia de `lib/utils.ts:31`); `normalizeNombre` aún en 3 copias (dos justificadas con test de paridad `lib/text/runtime-parity.test.ts`, una en `scripts/spikes/.../prototype.ts:53`).
- `assertRateLimitAllowed` en `_shared/rate-limit.ts:19` y `generate-meal-plan/rate-limit.ts:18` (solo cambia el mensaje).
- Cerrado de A5-H3: `resolveBaseUrl` (único en `lib/seo/resolve-base-url.ts`), `triggerLikeBurst` (`components/recipe/like-burst.ts`), `capitalize`/`formatUnidad` (`lib/utils.ts`, FRESCO-733).
- Fix: `lib/posthog/load.ts`, `components/ui/css-duration.ts`, parámetro `message` en el helper de rate-limit.

**A6-A7 · Fugas de capa: la UI y las rutas hablan directamente con la BD** (MEDIO)
- 25 componentes importan `@/lib/supabase/client|server`; la mayoría para auth (aceptable), pero hay acceso a tablas desde UI: `components/auth/identity-cookie-sync.tsx:61` (`user_profiles`), `app/providers/posthog-provider.tsx:134` (`user_profiles`), `app/(app)/menu/page.tsx:212` (`meal_plans`, página cliente de 345 líneas). Esto se salta `lib/api/*`, que es donde viven los tipos y el tratamiento de errores.
- Rutas con lógica de dominio y consultas en línea sin repositorio: `app/api/stripe/webhook/route.ts` (347 líneas, 8 consultas a `user_profiles`: :128,:140,:209,:235,:253,:275,:307,:326), `app/api/cron/stripe-reconcile/route.ts` (CC 21, 4 consultas), `app/api/profile/export/route.ts:41-44`.
- `lib/fixtures/page-shells.tsx:3-12` importa 10 componentes de `components/` (inversión de capas: `lib` depende de UI). Lo consume `app/dev/skeleton-capture` (protegido con `notFound()` en producción, `page.tsx:22`) y tests.
- Fix: `lib/api/user-profile` gana `syncIdentity`/`getBillingState`; mover consultas Stripe a `lib/billing/*`; mover `page-shells.tsx` a `components/__fixtures__` o `tests/`.

**A6-A8 · Código muerto / solo-test en producto** (MEDIO)
- Sin ningún importador de producción (solo test): `lib/security/nonce-substitution.ts` (spike ADR-0031 que quedó en `lib/`), `lib/grocery/supermarket/matcher.ts` (`emparejarIngrediente`, decisión 5 de ADR-0036 "una heurística compartida": implementada y no cableada), `fake-connector.ts` (legítimo como fixture), `lib/fixtures/mock-supabase-auth.ts` (fixture).
- Exports sin ningún uso: `readSidebarCollapsedClient` (`lib/layout/sidebar-preference.ts:23`), `errorResponse` solo interno, `ALERGENO_LABELS` solo interno, `CardFooter` (`components/ui/card.tsx`), `EmptyCatalogState` exportado sin consumidor externo. 119 exports sin referencia incluyen ~100 `*Props` (ruido).
- Ningún componente de `components/` queda sin importador de producción.
- Fix: borrar `nonce-substitution.ts`+test (o documentar por qué se conserva), cablear `matcher` en el runner o marcarlo "pendiente FRESCO-xxx", añadir `knip` a `repo:check`.

**A6-A9 · Dependencias: 13 vulnerabilidades y runtime CLI en `dependencies`** (MEDIO)
- `bun audit`: 7 high / 5 moderate / 1 low. Altas: `nanoid <3.3.16` (vía `postcss`, 3 CVE), `postcss <=8.5.22` copias transitivas en `next`, `@tailwindcss/postcss` y `@antfu/eslint-config` (la copia directa instalada es 8.5.28, las anidadas no), `dompurify` vía `posthog-js` (cliente), `yaml <2.8.3` (directa de `lint-staged`/`@antfu`), `brace-expansion`, `@humanfs/node`. La mayoría es de build/lint, pero `dompurify` va al bundle del navegador.
- Dependabot ya cubre `bun` (A5-H1 cerrado, `.github/dependabot.yml:24`), pero 12 paquetes siguen atrasados, incluido `next 16.3.7 -> 16.3.8` y `@sentry/nextjs 11.0.0 -> 11.2.0`.
- 7 paquetes que solo usan `scripts/`/`cli/` están en `dependencies` (`@clack/prompts`, `@inquirer/prompts`, `boxen`, `cli-table3`, `figures`, `picocolors`, `yaml`): se instalan en el build de Vercel sin motivo (`yaml` además es una de las vulnerables).
- Fix: `bun update` + overrides para `nanoid`/`postcss`; mover esas 7 a `devDependencies`.

### BAJO

**A6-A10 · `ADR-0036` quedó desfasado respecto a la realidad** — dice que el esquema "is NOT a migration yet" (`ADR-0036:24`; también `supermarket-data-layer.md:42`), pero las migraciones `20261001180000` y `20261001190000` ya existen en main. Actualizar o añadir un follow-up fechado.

**A6-A11 · Casts de jsonb sin validar** — `lib/api/recipes.ts:26-33` (8 `as unknown as Recipe[...]` sobre columnas jsonb), `lib/api/shopping-list.ts:59`, `:149`. `zod` está en dependencias pero solo se usa en 1 archivo de `app/lib`; un cambio de forma en la BD llega sin aviso a la UI. Validar en la frontera con zod o generar tipos de columnas jsonb.

**A6-A12 · `precios` de `mapShoppingListItem` es de 1 elemento por diseño** — ver A6-A3; mientras tanto, `observadoEn` de las dos cadenas es `1970-01-01` (`catalog-connectors.ts:OBSERVADO_EN_DESCONOCIDO`), de modo que el sistema de frescura del plan de refresco siempre considera obsoleto lo servido por la app; es honesto pero no hay indicación de edad en la UI.

**A6-A13 · Hooks de React dentro de `lib/`** — `lib/onboarding/use-*.ts` (3 hooks, usan `react` y `next/navigation`) contradicen §10 "Shared utilities = framework-agnostic"; deberían vivir en `components/onboarding/` o `hooks/`.

**A6-A14 · Bundle cliente del carrito** — `shopping-list-view.tsx` (`'use client'`) arrastra `map-item` -> `registry` -> ambos catálogos generados (18 KB + 24 KB fuente) + diccionario (52 KB, una línea JSON por entrada) + `retail-packs.ts` (12 KB): ~105 KB fuente en el bundle de la ruta. No medido con `next build` (sin analizar por ser solo lectura); plausible ~25-30 KB gzip. Mapear en servidor (`page.tsx`) y pasar `precios` ya resueltos.

**A6-A15 · `scripts/` y `cli/` con ficheros gigantes** — `sync-jira-issues.ts` 3775, `updater-core.ts` 3447, `install.ts` 2836 líneas. Es tooling sincronizado del boilerplate (no producto) pero cuenta en lint/tipos del repo; marcar como vendored y excluir de las métricas.

## Positivos (verificados)

- **0** `any`, 0 `@ts-ignore`/`@ts-expect-error`, 0 imports relativos profundos en producto, **0 ciclos** de dependencia en 279 módulos.
- Capa de supermercados: contrato único `ProductoSupermercado` con invariante `precioEnvase` = envase completo; puerta de permisos **fail-closed** en el registro (`puedeEjecutarse`) y espejada en BD con `CHECK` (`supermarket_chain_permiso_ejecutable_con_ref`, `habilitada_requiere_permiso`); RLS con select a `authenticated` y escritura solo `service_role`; RPC `get_supermarket_prices` `SECURITY INVOKER` sin parámetro de identidad (ADR-0032) y `get_supermarket_demand` con `SECURITY DEFINER` revocado a `anon`/`authenticated` y concedido solo a `service_role`; runner con doble puerta (BD + código) y cap de peticiones.
- Política de errores coherente: `lib/api/*` lanza errores tipados (`FavoritesError`, etc.) con mensaje en español, utilidades puras devuelven `null`, y todos los `console.error` llevan prefijo `[contexto]`.
- Convenciones Next 16 correctas: `proxy.ts`, `params`/`searchParams` como Promise, ruta de desarrollo cerrada con `notFound()` en producción.
- Duplicados de Edge Functions justificados con test de paridad (`lib/text/runtime-parity.test.ts`).
- ADR 0022-0026 ya `Accepted`; ADR-0036/0037 sí reflejan la decisión del fundador con fecha.
- Dependabot cubre `bun` (A5-H1 cerrado).

## Regresiones respecto a audit-4 / audit-5

| Hallazgo previo | Estado hoy |
|---|---|
| A5-H3 `resolveBaseUrl` x4, `triggerLikeBurst`, `capitalize`/`formatUnidad` | **Cerrado** (FRESCO-733). Aparecen duplicados nuevos (A6-A6). |
| A5-H4 ADR 0022-0026 `Proposed` | **Cerrado** para esos cinco. **Recurre** con 0032, 0033, 0035 (A6-A2). |
| A5-M1 god-components `calendar-grid` 787 / `onboarding` 856 | **Parcial** (271 / 293). Complejidad movida a `SlotCell` (CC 31); `createMockClient` x7 **sigue**. |
| A5 "3 violaciones máx. 2 posicionales" (sin ticket) | **Empeora**: 33 reales, sin regla de lint (A6-A1). |
| A5-H1 Dependabot sin npm/bun | **Cerrado**. Quedan 13 vulnerabilidades por actualizar. |
| A5 `normalizeNombre` tercera copia en spike | Sin cambios (BAJO). |
| Audit-4: dependencia circular / capas | Sin ciclos hoy; fugas de capa nuevas (A6-A7). |
