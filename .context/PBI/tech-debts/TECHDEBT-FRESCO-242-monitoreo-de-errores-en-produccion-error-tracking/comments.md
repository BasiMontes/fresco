# Comments for FRESCO-242

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-242)

---

### Basi Montes - 8/23/2026, 5:57:43 PM

## Spec Implementation Plan (Dev)

## Overview

Sin monitoreo de errores en producción. `app/error.tsx` y `global-error.tsx` solo cubren error boundaries nativos de Next.js client-side; no hay visibilidad de errores server-side, edge, ni agrupación/alertas. Se integra Sentry (`@sentry/nextjs`) como solución estándar para Next.js 16 App Router.

***Acceptance Criteria a cumplir******:***

- Errores no capturados en client, server y edge quedan reportados a Sentry.
- `instrumentation.ts` registra el hook `onRequestError` para errores server-side (Next 16 App Router).
- DSN y config vienen de variables de entorno, nunca hardcodeadas.
- Source maps se suben en build de producción para stack traces legibles.
- No se rompe build/dev existente; overhead de bundle mínimo.

---

## Technical Approach

***Chosen approach******:*** `@sentry/nextjs` SDK oficial, wizard-free manual setup (evita el wizard interactivo que no corre en CI/agent):

- `sentry.client.config.ts` — client-side init (browser errors, session replay opcional deshabilitado por defecto para no sumar peso).
- `sentry.server.config.ts` — server-side init (route handlers, server components).
- `sentry.edge.config.ts` — edge runtime init (middleware).
- `instrumentation.ts` — `register()` importa los configs por runtime + exporta `onRequestError` (Next 16 API para capturar errores no manejados en el App Router server-side, reemplaza el viejo patrón de `withSentryConfig` para esto).
- `next.config.ts` envuelto con `withSentryConfig` (source maps upload, tunneling opcional para evitar ad-blockers).
- Nuevas env vars: `NEXT*PUBLIC*SENTRY*DSN` (cliente), `SENTRY*AUTH*TOKEN` (build-time, solo CI/Vercel, no en `.env` local necesariamente), `SENTRY*ORG`, `SENTRY_PROJECT`.

***Alternatives considered******:***

- Vercel Observability nativo: descartado, ya lo evaluamos con el usuario — menos features (sin fingerprint grouping, sin alerting configurable).
- `@sentry/node` manual sin el wrapper de Next.js: descartado, pierde auto-instrumentation de route handlers y el wizard de source maps.

***Why this approach******:***

- ✅ SDK oficial mantenido por Vercel+Sentry conjuntamente para App Router.
- ✅ Free tier (5k errors/mes) cubre expectativa de tráfico actual.
- ✅ `onRequestError` es la API soportada por Next 16 para este caso (verificado contra `node_modules/next/dist/docs/` por regla del repo "NOT the Next.js you know").
- ❌ Trade-off: nuevo vendor externo, requiere cuenta Sentry + token de build en Vercel env vars.

---

## Implementation Steps

### Step 1: Instalar SDK y verificar Next 16 App Router error-handling API

***Task******:*** `bun add @sentry/nextjs`. Leer `node_modules/next/dist/docs/` sección de `instrumentation.ts` / `onRequestError` para confirmar firma exacta en esta versión (Next 16 puede diferir de docs públicas per AGENTS.md).

***Testing******:*** `bun run types:check` pasa tras el install.

***Estimated time******:*** 15 min

---

### Step 2: Crear configs de runtime (client/server/edge)

***Task******:*** Crear `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` en el root, cada uno con `Sentry.init({ dsn: process.env.NEXT*PUBLIC*SENTRY_DSN, tracesSampleRate: ... })`.

***Details******:***

- DSN leído de `NEXT*PUBLIC*SENTRY*DSN` (debe ser `NEXT*PUBLIC_` porque el client config corre en browser).
- `tracesSampleRate` bajo (0.1) para no consumir cuota de performance monitoring del free tier.
- `environment` seteado a partir de `process.env.VERCEL*ENV` o `NODE*ENV` para distinguir dev/staging/production en Sentry.

***Testing******:*** Build local (`bun run build`) no falla; configs se cargan sin lanzar en dev si DSN está vacío (guard `if (dsn)`).

***Estimated time******:*** 20 min

---

### Step 3: `instrumentation.ts` + wiring de `onRequestError`

***Task******:*** Crear `instrumentation.ts` en el root con `register()` que importa el config correcto según `process.env.NEXT_RUNTIME` (`nodejs` vs `edge`), y exportar `onRequestError` que llama `Sentry.captureRequestError`.

***Edge cases handled******:***

- Runtime edge no soporta todas las APIs de Node del SDK completo — usar el import condicional que documenta `@sentry/nextjs`.

***Testing******:*** Forzar un error en un route handler de prueba (`throw new Error('test')` temporal), confirmar que aparece en Sentry dashboard, remover el throw antes de commit.

***Estimated time******:*** 25 min

---

### Step 4: Envolver `next.config.ts` con `withSentryConfig`

***Task******:*** Wrap del config existente para habilitar upload de source maps en build de producción.

***Details******:***

- `org`, `project` desde env vars `SENTRY*ORG` / `SENTRY*PROJECT`.
- `authToken` desde `SENTRY*AUTH*TOKEN` (solo necesario en CI/Vercel build, no en dev local).
- `silent: true` en dev para no ensuciar logs locales sin token.

***Testing******:*** `bun run build` local sin `SENTRY*AUTH*TOKEN` seteado no rompe (debe warnear y skipear upload, no fallar).

***Estimated time******:*** 15 min

---

### Step 5: Env vars — `.env.example` + Vercel

***Task******:*** Agregar `NEXT*PUBLIC*SENTRY*DSN`, `SENTRY*ORG`, `SENTRY*PROJECT`, `SENTRY*AUTH_TOKEN` a `.env.example` con comentario de dónde obtenerlos (Sentry project settings). Sincronizar a Vercel Preview/Production scopes vía `/vercel-cli` una vez el usuario cree el proyecto Sentry y provea los valores reales.

***Testing******:*** `bun run vars:check` / `bun run vars:env:check` pasan.

***Estimated time******:*** 10 min

---

### Step 6: Integration — verificar boundaries existentes siguen funcionando

***Task******:*** Confirmar que `app/error.tsx` / `app/global-error.tsx` (client boundaries existentes) coexisten con Sentry sin duplicar captura — Sentry auto-instrumenta React error boundaries si se usa `Sentry.ErrorBoundary` o queda cubierto por el `onRequestError` + client init para errores no atrapados por los boundaries propios.

***Flow completo******:***

1. Error server-side no manejado → `onRequestError` → Sentry.
2. Error client-side no manejado por `error.tsx` → client SDK autocaptura vía global handler.
3. Error edge (middleware) → edge config → Sentry.

***Testing******:*** Smoke manual en dev: forzar error en cada capa, confirmar 3 eventos separados en Sentry con `environment: development`.

***Estimated time******:*** 15 min

---

## Technical Decisions (Story-specific)

### Decision 1: Sentry como vendor de error tracking (confirmado con usuario)

***Chosen******:*** `@sentry/nextjs`, free tier, sin session replay habilitado inicialmente.

***Reasoning******:***

- ✅ Estándar de facto para Next.js App Router, soporte oficial de `onRequestError`.
- ✅ Free tier suficiente para tráfico actual del proyecto.
- ❌ Trade-off: nuevo vendor con vendor lock-in moderado (DSN + SDK acoplado al código, pero migración a otra herramienta de error tracking es straightforward — no hay data migration, solo swap de SDK).

Este es third-party integration nuevo y toca múltiples runtimes (client/server/edge) — pasa el filtro de "arquitectónico". Se documentará como `ADR-000X-error-tracking-sentry` antes de codear.

---

## Dependencies

***Pre-requisitos técnicos******:***

- [ ] Cuenta Sentry creada + proyecto Next.js + DSN (usuario, fuera de este flujo de código)
- [ ] `SENTRY*AUTH*TOKEN` con scope `project:releases` para upload de source maps (solo necesario antes de Stage 4 deploy, no bloquea Stage 2 código)

---

## Risks & Mitigations

***Risk 1******:*** Sin `SENTRY*AUTH*TOKEN` en Vercel, el build de producción no sube source maps (stack traces minificados, ilegibles).

- ***Impact******:*** Medium
- ***Mitigation******:*** `withSentryConfig` no falla el build sin token, solo skipea el upload — no bloquea Stage 4. El usuario completa el token antes o después del merge sin re-trabajo de código.

***Risk 2******:*** Free tier de Sentry (5k errors/mes) se agota si hay un bug ruidoso en loop.

- ***Impact******:*** Low
- ***Mitigation******:*** `tracesSampleRate` bajo + Sentry tiene rate-limiting/sampling de errores duplicados por default (fingerprint dedup no consume cuota extra por evento idéntico repetido en el mismo issue).

---

## Estimated Effort

| Step | Time |
| --- | --- |
| 1. Install + verify Next 16 API | 15 min |
| 2. Runtime configs (client/server/edge) | 20 min |
| 3. instrumentation.ts + onRequestError | 25 min |
| 4. next.config.ts wrap | 15 min |
| 5. Env vars | 10 min |
| 6. Integration verification | 15 min |
| ***Total**** | ****~******1h40m*** |

---

## Definition of Done Checklist

- [ ] Código implementado según este plan
- [ ] Errores client/server/edge reportan a Sentry (verificado manualmente en dev)
- [ ] `.env.example` actualizado con las 4 nuevas vars + comentario de origen
- [ ] Sin errores de linting/TypeScript
- [ ] `app/error.tsx` / `global-error.tsx` existentes siguen funcionando sin duplicar captura
- [ ] ADR redactado para la decisión de vendor (Sentry)
- [ ] Code review aprobado
- [ ] Deployed to staging
- [ ] Smoke test en staging: error forzado temporal confirma evento en Sentry, luego removido

---


_Synced from Jira by sync-jira-issues_
