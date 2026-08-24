# Comments for FRESCO-240

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-240)

---

### Basi Montes - 8/24/2026, 12:30:17 AM

## Spec Implementation Plan (Dev)

### Objetivo

Instrumentar `posthog-js` (cliente) + `posthog-node` (servidor) para que el KPI norte del negocio ("menús generados ***y usados****") y la tercera hipótesis del MVP (3 de 10 usuarias del cohort concierge pagan y repiten 3+ semanas) dejen de ser ciegos. Esto es ****solo instrumentación*** — el dashboard/funnels/retention lo cubre la UI nativa de PostHog, no se construye nada de eso aquí.

### Vendor y región (decisión ya tomada por el usuario)

***PostHog***, elegido explícitamente sobre Vercel Analytics (solo page-views/web-vitals, sin eventos custom ni funnels) y Plausible (agregado, sin identidad por usuario — incompatible con cohortes de retención por hogar). Motivo: funnels + retention cohorts nativos, exactamente lo que exige medir "repetición 3+ semanas".

***Región******:****** PostHog Cloud EU**** (`eu.posthog.com` / `eu.i.posthog.com`). Esto es un ****supuesto marcado, no una decisión cerrada*** — se elige EU por defecto por contexto GDPR/España (mismo razonamiento que ya aplicó el proyecto en otras decisiones de Jira-en-español), pero el usuario puede anularlo antes de que arranque el Stage 2 si tiene ya un proyecto US o una postura de compliance distinta. Detalle completo en `ADR-0013`.

Se promueve a ADR por pasar el test de dos puertas (arquitectural + difícil de revertir una vez hay datos históricos reales): `.context/ADR/ADR-0013-posthog-product-analytics.md`, `Status: Proposed` — pendiente de aceptación humana explícita, no se marca `Accepted` en este plan.

### Variables de entorno nuevas

Añadir a `.env.example` (sección nueva, mismo patrón que la sección Sentry ya existente):

```
NEXT*PUBLIC*POSTHOG_KEY=            # Project Settings -> Project API Key
NEXT*PUBLIC*POSTHOG_HOST=           # https://eu.i.posthog.com (EU) — ver ADR-0013 antes de usar US
```

Ambas con prefijo `NEXT*PUBLIC*` porque `posthog-js` necesita la key en el bundle del cliente; no son secretas (son la clave de ingesta pública del proyecto, igual que `NEXT*PUBLIC*SENTRY_DSN`).

### Integración del SDK

- ***Cliente***: nuevo `app/providers/posthog-provider.tsx` (`'use client'`), inicializa `posthog-js` una sola vez y expone el cliente vía contexto o el propio `posthog-js` singleton. Se monta en `app/layout.tsx` envolviendo `{children}` dentro de `<body>` — hoy `app/layout.tsx` no tiene ningún provider, este es el primero.
- ***Servidor****: nuevo `lib/posthog/server.ts`, singleton de `posthog-node` (con `flush()`/`shutdown()` correcto en el entorno serverless de Vercel — cada invocación debe hacer flush antes de responder, patrón estándar de `posthog-node` en runtimes serverless). Consumido desde `app/api/***/route.ts` y, en particular, desde `app/api/stripe/webhook/route.ts`.
- ***Nombres de evento***: constantes centralizadas en `lib/posthog/events.ts` (evita strings mágicos repartidos por el código, un solo lugar para ver el catálogo completo de eventos).

### Vinculación identidad ↔ Supabase auth

Cada evento se vincula al `auth.uid()` real vía `posthog.identify(userId)` — incluyendo usuarias invitadas (modo guest, `signInAnonymously()`, ADR-0003): una invitada ya tiene un JWT real de Supabase con un `user*id` real, así que no hace falta un segundo esquema de identidad. Cuando una invitada se registra (`reassignGuestData` / `updateUser`, ADR-0004), el mismo `user*id` de Supabase se conserva — el alta de eventos previos a la conversión no se pierde.

Punto de instrumentación de `identify()`: justo después de `client.auth.signInAnonymously()` en `components/onboarding/identity-step.tsx`, y de nuevo tras cualquier login/registro exitoso.

### Eventos core a instrumentar

| Evento | Dispara | Cliente/Servidor | Archivo aproximado |
| --- | --- | --- | --- |
| `menu*generation*started` | Usuaria pulsa "generar menú" | Cliente | `app/onboarding/page.tsx` (`handleGenerate()`) |
| `menu*generation*completed` | `generateMealPlan()` resuelve OK (la mitad "generados" del KPI) | Cliente | `app/onboarding/page.tsx` (`handleGenerate()`) |
| `recipe*marked*cooked` | Receta marcada `estado: 'cocinada'` (la mitad "usados" del KPI) | Cliente | punto de llamada a `updateRecipeStatus()` en la vista de calendario (`app/(app)/menu/page.tsx` o el componente de grid que dispara el toggle) |
| `user*signed*up` | Alta como invitada (`signInAnonymously`) y alta registrada (conversión) | Cliente | `components/onboarding/identity-step.tsx` |
| `subscription_started` | Webhook Stripe `checkout.session.completed` | ***Servidor*** (evita pérdida por ad-blocker en un evento de negocio crítico — mismo razonamiento que llevó a capturar errores de pago server-side en el flujo de Stripe) | `app/api/stripe/webhook/route.ts` |
| `session_started` (login) | Sesión iniciada — insumo para el reporte de retención nativo de PostHog (no requiere cálculo custom, es la razón principal para elegir PostHog) | Cliente | punto de login exitoso |

Nota de alcance: `subscription_started` es el único evento server-side de este batch — es el único que corre en un webhook sin navegador, así que no hay elección real "cliente vs servidor" ahí, es servidor por definición. El resto se captura cliente porque el usuario ya está interactuando con la UI en el momento del evento; se documenta explícitamente para que no quede ambiguo cuál captura cada lado (ver `## Technical Decisions`).

### Fuera de alcance (explícito)

- Dashboards, funnels o reportes de retención construidos a mano — eso lo cubre la UI nativa de PostHog una vez lleguen eventos.
- El reverse-proxy de Next.js rewrites (recomendado por PostHog contra ad-blockers) — opcional/stretch, no bloquea este ticket, se deja como seguimiento.
- Cualquier evento no listado arriba — este batch cubre exactamente lo que el KPI norte y la hipótesis 3 necesitan, no todo lo instrumentable de la app.

---

## Technical Decisions

- ***Cliente vs servidor por evento***: `subscription_started` va server-side (webhook, sin alternativa posible); el resto va client-side porque el disparo ocurre en interacción directa de UI y el volumen/ad-blocker-loss es aceptable a esta escala (mismo trade-off que Sentry aceptó con `tracesSampleRate` bajo — ADR-0009). Si el ad-blocker-loss resulta significativo en datos reales, el reverse-proxy (fuera de alcance aquí) es el mitigante, no un rediseño del split cliente/servidor.
- ***Región EU vs US***: EU por defecto (ver ADR-0013), marcado como override-antes-de-Stage-2, no una decisión silenciosa.
- `posthog-node`*** en Edge Functions Deno vs solo en Next.js API routes***: se descarta instrumentar dentro de las Supabase Edge Functions (Deno) para esta primera pasada — añadiría una segunda superficie de import (`esm.sh`/`npm:` specifier) por un beneficio marginal, dado que `generate-meal-plan` y `update-recipe-status` ya se llaman siempre desde un cliente autenticado que sí puede capturar el evento correspondiente. Revisar si el dato real muestra pérdida significativa.
- ***Constantes de nombre de evento centralizadas*** (`lib/posthog/events.ts`) en vez de strings sueltos por archivo — evita drift de naming entre los ~6 puntos de captura.

---

## Review Workload Forecast

Estimated: 280 additions + 30 deletions = 310 total lines
400-line budget risk: Medium
Chain strategy: stacked-to-main
Decision needed before apply: No

Notes: Medium risk esperado y explícito — 3 archivos nuevos (`app/providers/posthog-provider.tsx`, `lib/posthog/server.ts`, `lib/posthog/events.ts`) + ~8 archivos existentes tocados (`app/layout.tsx`, `.env.example`, `components/onboarding/identity-step.tsx`, `app/onboarding/page.tsx`, el componente de calendario/grid, el punto de login, `app/api/stripe/webhook/route.ts`, `package.json`). `stacked-to-main` sugerido por descomposición lineal natural: (1) fundación (provider + env vars + deps) → (2) eventos cliente → (3) evento servidor (webhook).

---


_Synced from Jira by sync-jira-issues_
