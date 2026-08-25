# Comments for FRESCO-241

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-241)

---

### Basi Montes - 8/23/2026, 7:54:46 PM

## Spec Implementation Plan (Dev)

# Implementation Plan: TECHDEBT-FRESCO-241 - Loop de re-enganche semanal (web push)

## Overview

Fresco es un producto de hábito semanal (el usuario planifica su menú cada domingo), pero hoy no existe ningún mecanismo proactivo que traiga al usuario de vuelta a la app. El Centro de Avisos (`/ls`, EPIC-FRESCO-223, ya shipeado) solo sirve si el usuario ya abrió la app por su cuenta — no resuelve el problema de re-enganche.

***Decisión de canal ya tomada (no se re-discute en este plan)******:*** Web Push, no email. Resend no tiene dominio propio verificado (envío SMTP bloqueado hasta comprar dominio) — bloqueante confirmado, documentado en `TECHDEBT-FRESCO-242`.

***Estado de partida confirmado******:*** cero infraestructura de push en el repo — no hay service worker, no hay claves VAPID, no hay tabla de suscripciones, no hay `manifest.json`. Este plan construye el flujo completo desde cero.

***Acceptance Criteria a cumplir*** (derivadas para este tech-debt — el ticket no trae AC formal en Jira; ver `.context/PBI/tech-debts/TECHDEBT-FRESCO-241-.../tech-debt.md`):

- ***AC1******:*** Un usuario logueado que otorga permiso de notificaciones push en el navegador queda suscrito — la suscripción (`endpoint` + claves `p256dh`/`auth`) se guarda en Supabase asociada a su `user_id`.
- ***AC2******:*** Cada semana (domingo por la tarde/noche, hora Europe/Madrid), todo usuario que NO tiene una fila en `meal_plans` para la semana ISO actual Y tiene al menos una suscripción push activa recibe UNA notificación push de recordatorio.
- ***AC3******:*** Un usuario que rechaza el permiso del navegador, o que nunca lo otorgó, no recibe ningún push — no hay fallback silencioso a email ni a ningún otro canal.
- ***AC4******:*** Un usuario que YA planificó su menú de la semana actual (existe fila `meal*plans` con `semana*iso` = semana actual) NO recibe el push de esa semana (evita ruido/fatiga de notificaciones).
- ***AC5******:*** Una suscripción inválida o expirada (el push service devuelve HTTP 404/410 al intentar enviar) se elimina automáticamente de la tabla en el mismo intento de envío que la detecta — no se reintenta indefinidamente contra un endpoint muerto.
- ***AC6******:*** Un usuario puede revocar el permiso desde el navegador (o desde un toggle en la app, si Step 5 lo expone) y deja de recibir pushes; la revocación se refleja en la tabla de suscripciones.
- ***AC7******:*** El opt-in es explícito — no se dispara el prompt nativo del navegador al cargar la app sin contexto. Se muestra primero una UI propia que explica el valor ("te avisamos si se te pasó planificar el domingo") y solo tras una acción del usuario se invoca `Notification.requestPermission()`.

---

## Technical Approach

***Chosen approach******:***

1. ***Suscripción (cliente)******:*** Web Push API estándar (`ServiceWorkerRegistration.pushManager.subscribe`) + claves VAPID. Un `service worker` nuevo (`public/sw.js`) se registra desde un componente cliente; un componente de opt-in propio (AC7) precede al prompt nativo del navegador. La suscripción resultante (`endpoint`, `keys.p256dh`, `keys.auth`) se persiste en una tabla `push*subscriptions` en Supabase vía el cliente autenticado (insert de la propia fila, protegido por RLS `user*id = auth.uid()` — sin necesidad de una API route intermedia).
2. ***Envío (servidor)******:*** una Edge Function nueva `send-weekly-reengagement-push` — misma familia que `generate-meal-plan` / `delete-account` — que: (a) consulta usuarios con al menos una suscripción activa y SIN fila en `meal*plans` para la `semana*iso` actual (AC2/AC4), (b) para cada suscripción arma y firma el payload Web Push (JWT VAPID + cifrado `aes128gcm`) y lo envía al push service del navegador (FCM/Mozilla push endpoint, según el `endpoint` de cada suscripción), (c) en un 404/410 de respuesta borra la suscripción (AC5).
3. ***Disparo semanal (scheduler)******:**** `pg*cron` (****ya habilitado en este proyecto*** — ver `supabase/migrations/20260823120000*enable*pg*cron*cleanup*abandoned*guest*users.sql`, usado hoy para el cleanup de guests) + `pg*net` (`net.http*post`) invocando la URL de la Edge Function con la `service*role` key guardada en Vault (Supabase Vault — nunca en texto plano dentro del job SQL). Confirmado contra la documentación oficial de Supabase (`pg*net: Async Networking`) que este es el patrón soportado para invocar una Edge Function desde un cron de Postgres.

***Alternativas consideradas******:***

- ***Email (Resend)******:*** descartado — bloqueante de dominio ya documentado en FRESCO-242, explícitamente fuera de este plan por decisión de negocio previa.
- ***Push nativo (app store / FCM nativo)******:*** fuera de alcance — Fresco no tiene presencia en app stores; introduciría una plataforma de distribución entera para un tech-debt ticket.
- ***Vercel Cron → API route de Next.js que orquesta el envío******:*** descartado como disparador — añade un hop extra (Vercel Cron → Next.js API route → Supabase) sin ganancia sobre invocar la Edge Function directamente desde `pg*cron`, y separa la lógica de scheduling de la lógica de datos (la query "quién no planificó esta semana" vive naturalmente cerca de la BD). Se mantiene como alternativa documentada si en el futuro `pg*net` presenta limitaciones operativas.
- `web-push`*** (npm) vs implementación manual del protocolo Web Push******:*** ver "Technical Decisions" — Deno Edge Functions soportan imports `npm:` pero la compatibilidad de `web-push` con el runtime Deno de Supabase NO está verificada; queda como spike explícito de Step 6, con implementación manual (Web Crypto API: VAPID JWT + `aes128gcm`) como fallback si el paquete no funciona en Deno.

***Why this approach******:***

- ✅ Reutiliza infraestructura ya validada en el proyecto: `pg*cron` ya está habilitado y en uso (precedente FRESCO-238), el patrón de Edge Function con `service*role` ya existe (`generate-meal-plan`, `delete-account`).
- ✅ La query de negocio ("¿quién no planificó esta semana?") es trivial contra el schema actual: `meal*plans` ya tiene `(user*id, semana*iso)` UNIQUE (`supabase/migrations/20260725120100*create*fresco*core_tables.sql`), así que "no existe fila para la semana ISO actual" es un `NOT EXISTS` directo.
- ✅ Cero dependencia de servicios externos de pago (a diferencia de email vía Resend, que además está bloqueado).
- ❌ Trade-off: alcance real de Web Push está limitado en iOS — Safari solo soporta Web Push si la PWA fue "añadida a pantalla de inicio" (y solo desde iOS 16.4+). Un segmento de usuarios iOS no instalados como PWA queda fuera de alcance de este mecanismo (ver Risks).
- ❌ Trade-off: las tasas de opt-in de push por navegador suelen ser bajas (industria: 10-20%) — este mecanismo no sustituye, complementa, al Centro de Avisos existente.

---

## Implementation Steps

### ***Step 1******:****** Claves VAPID + configuración de entorno***

***Task******:*** Generar el par de claves VAPID (pública/privada) y wirearlas como secrets.

***Details******:***

- Generar el par con `web-push generate-vapid-keys` (o equivalente Web Crypto) — clave pública se expone al cliente, clave privada NUNCA sale del servidor.
- Clave pública → variable de entorno cliente (`NEXT*PUBLIC*VAPID*PUBLIC*KEY`), añadida a `.env.example` con comentario explicativo.
- Clave privada → Supabase Edge Function secret (`supabase secrets set VAPID*PRIVATE*KEY=...`), NUNCA en `.env` del repo ni en `.env.example` (placeholder únicamente).
- `VAPID_SUBJECT` (mailto: o URL de contacto requerido por el estándar) también como secret/env.

***Testing******:***

- Manual: confirmar que la clave pública es legible desde el cliente (`process.env.NEXT*PUBLIC*VAPID*PUBLIC*KEY`) y que la privada NO aparece en ningún bundle cliente (`grep` sobre `.next/static` tras build).

***Estimated time******:*** 30 min

---

### ***Step 2******:****** Migración — tabla ****`push_subscriptions`**** + RLS***

***Task******:*** Crear la tabla de suscripciones push y sus políticas RLS, siguiendo la convención de nombres ya usada en el proyecto (`meal*plans*delete_own`, etc.).

***Details******:***

- Columnas: `id uuid pk default gen*random*uuid()`, `user*id uuid not null references public.user*profiles(id) on delete cascade`, `endpoint text not null`, `p256dh text not null`, `auth text not null`, `created*at timestamptz not null default now()`, `last*seen_at timestamptz not null default now()`.
- `unique (user_id, endpoint)` — un mismo navegador/dispositivo no duplica suscripción.
- RLS: `push*subscriptions*select*own`, `push*subscriptions*insert*own`, `push*subscriptions*delete*own` (usuario gestiona solo sus propias filas); sin policy de `update` para el cliente (la Edge Function usa `service*role`, que bypassea RLS, para el cleanup de AC5).
- Índice sobre `user*id` (lookup) — la query semanal de "usuarios sin suscripción" no necesita índice adicional (join contra `meal*plans` por `user*id`+`semana*iso`, que ya tiene el UNIQUE constraint como índice implícito).

***⚠️ IMPORTANTE (DB)******:*** no incluir SQL estático final en este plan — usar Supabase MCP durante Stage 2 para aplicar la migration; el diseño exacto de columnas/constraints arriba es la especificación, no el SQL literal.

***Testing******:***

- Migration test: insertar una suscripción como usuario A autenticado, confirmar que usuario B no puede leerla ni borrarla (RLS).

***Estimated time******:*** 45 min

---

### ***Step 3******:****** Service worker + registro en cliente***

***Task******:*** Crear `public/sw.js` (listener de `push` y `notificationclick`) y un hook/componente que lo registre.

***Details******:***

- `public/sw.js`: listener `push` que parsea el payload JSON (`{ title, body, url }`) y llama `self.registration.showNotification(...)`; listener `notificationclick` que hace `clients.openWindow(payload.url ?? '/menu')`.
- Registro: `navigator.serviceWorker.register('/sw.js')` desde un hook cliente (`lib/hooks/use-push-registration.ts` o similar), invocado solo tras el opt-in (Step 4), no en el layout raíz global.
- Listener `pushsubscriptionchange` en el service worker (el navegador puede rotar el `endpoint` sin intervención del usuario) — re-suscribe y actualiza la fila en `push_subscriptions` (upsert, no insert simple).

***Edge cases handled******:***

- Navegador sin soporte a Push API (Safari desktop antiguo, navegadores in-app) → `if (!('serviceWorker' in navigator) || !('PushManager' in window))` guardia silenciosa, no rompe la UI, simplemente no se muestra el opt-in (Step 4).
- Rotación de `endpoint` por el navegador (`pushsubscriptionchange`) → upsert en vez de insert evita filas duplicadas/huérfanas.

***Testing******:***

- Manual: registrar el SW en `bun run dev`, confirmar en DevTools > Application > Service Workers que queda activo; simular un push local vía DevTools.

***Estimated time******:*** 1h

---

### ***Step 4******:****** UI de opt-in + helpers cliente de suscripción***

***Task******:*** Componente de opt-in propio (AC7) + helpers (`lib/api/push-subscription.ts`) para suscribir/desuscribir.

***Details******:***

- `lib/api/push-subscription.ts`: `subscribeToPush()` (pide permiso, hace `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID*PUBLIC*KEY })`, guarda la fila en `push_subscriptions` vía cliente Supabase autenticado) y `unsubscribeFromPush()` (llama `subscription.unsubscribe()` en el navegador Y borra la fila — AC6).
- Componente de opt-in: sigue el patrón visual de `components/notifications/*-notice.tsx` (Card, mismo family que `RoutesNotice`/`RecommendedRecipesNotice`) — copy explicando el valor ANTES de invocar `Notification.requestPermission()` (AC7). Se descarta (dismiss) igual que las otras notices, sin volver a mostrarse si el usuario ya decidió (otorgó o rechazó).
- Persistencia de "ya se le preguntó" — un booleano en `user*profiles` (mismo patrón que `aviso*bienvenida*visto`, `aviso*rutas_descartado`) evita re-preguntar en cada visita a un usuario que ya rechazó.

***Edge cases handled******:***

- Usuario rechaza el permiso nativo del navegador (`Notification.permission === 'denied'`) → no se vuelve a mostrar el prompt propio; el navegador tampoco deja re-preguntar hasta que el usuario cambie el permiso manualmente en su configuración (comportamiento estándar del navegador, no de la app).
- Usuario ya suscrito en otro dispositivo → cada dispositivo es una fila distinta (`endpoint` es por navegador/dispositivo); no hay conflicto.

***Testing******:***

- Component test: opt-in card se oculta tras dismiss/aceptar; no vuelve a aparecer si `user*profiles.aviso*push_visto = true`.

***Estimated time******:*** 1.5h

---

### ***Step 5******:****** Integración del opt-in en la app***

***Task******:*** Insertar el componente de opt-in donde el usuario ya está en contexto de planificación (candidato natural: `/menu`, mismo lugar que `RecommendedRecipesNotice`/badge de `/ls`).

***Details******:***

- Insertar en `app/(app)/menu/page.tsx` (o `/ls` si se prefiere agrupar con el resto de notices) siguiendo el mismo patrón `Promise.all` + manejo de error no-bloqueante ya usado para `getHasUnseenls`.
- Sin fallback silencioso: si `getPushOptInVisible` falla, se loguea (`console.error`) y se oculta el componente — no debe romper la carga de `/menu`.

***Testing******:***

- Manual (live-UI, dev server): confirmar que el componente aparece para un usuario sin decisión previa y desaparece tras aceptar/rechazar/dismiss.

***Estimated time******:*** 30 min

---

### ***Step 6******:****** Edge Function ***`send-weekly-reengagement-push`

***Task******:*** Función que hace la query de negocio (AC2/AC4) y el envío (AC1/AC5).

***Details******:***

- Sigue el esqueleto de `supabase/functions/generate-meal-plan/index.ts` (cliente `service_role`, sin depender de RLS para la query cross-usuario).
- Query: usuarios con `push*subscriptions` cuyo `user*id` NO tiene fila en `meal*plans` con `semana*iso` = semana ISO actual (`NOT EXISTS` / `LEFT JOIN ... WHERE meal*plans.id IS NULL`, filtrado a `semana*iso` actual).
- Para cada suscripción: firmar y enviar el payload Web Push (VAPID JWT + `aes128gcm`). ***Spike obligatorio antes de codear******:*** verificar contra Context7/docs si `web-push` (vía `npm:web-push` en Deno) es compatible con el runtime de Supabase Edge Functions; si no, implementar manualmente con Web Crypto API (`crypto.subtle`) — ver Technical Decisions.
- En respuesta HTTP 404/410 del push service → borrar la fila de `push_subscriptions` (AC5) en el mismo run (no un job de limpieza separado).
- Idempotencia: la función es segura de re-ejecutar el mismo día (si `pg*cron` reintenta) — un usuario que ya recibió el push no debe recibir un duplicado. Para esto, o bien el cron corre una única vez por semana (confianza en el scheduler) o se añade un registro ligero de "ya enviado esta semana" (evaluar en Stage 2 si el volumen lo justifica; de mínima, un timestamp `last*reengagement*push*sent*at` en `push*subscriptions` que se filtra en la query).

***Edge cases handled******:***

- Usuario con múltiples suscripciones (varios dispositivos) → recibe un push por dispositivo (comportamiento esperado, no deduplicar entre dispositivos).
- Push service caído/timeout (no 404/410, sino 5xx o timeout de red) → NO borrar la suscripción (podría ser un fallo transitorio del push service, no una suscripción inválida); solo loguear.

***Testing******:***

- Unit test de la query SQL (usuarios sin plan de la semana actual con suscripción activa) contra fixtures.
- Manual: invocar la función directamente (`supabase functions invoke`) contra un usuario de prueba suscrito sin plan de la semana, confirmar que llega la notificación.

***Estimated time******:*** 3h (incluye el spike de compatibilidad Deno)

---

### ***Step 7******:****** ****`pg_cron`**** — disparo semanal***

***Task******:*** Migration que agenda la invocación semanal de la Edge Function.

***Details******:***

- `cron.schedule('weekly-reengagement-push', '<cron-expr-domingo-tarde-Europe/Madrid>', $$ select net.http*post(url := '<edge-function-url>', headers := jsonb*build*object('Authorization', 'Bearer ' || vault*secret('service*role*key'), 'Content-Type', 'application/json'), body := '{}'::jsonb) $$);` — service_role key leída desde Supabase Vault, NUNCA literal en el SQL de la migration (mismo cuidado que cualquier secret del repo).
- Requiere confirmar en Stage 2 si `pg*net` está habilitado en el proyecto (no confirmado en esta pasada de planning — `pg*cron` sí está confirmado activo, `pg_net` no se ha verificado contra este proyecto Supabase concreto).
- Horario: domingo por la noche o lunes muy temprano (a definir con el usuario en Stage 2 — no es una decisión técnica sino de producto/timing).

***Testing******:***

- Manual: `select cron.schedule(...)` en un entorno de prueba, disparar manualmente vía `select net.http_post(...)` con los mismos parámetros para confirmar que la Edge Function responde 200 antes de dejarlo agendado.

***Estimated time******:*** 45 min

---

### ***Step 8******:****** Integration — flujo completo***

***Task******:*** Verificar el flujo end-to-end.

***Flow completo******:***

1. Usuario nuevo entra a `/menu`, ve el opt-in de push (AC7), acepta.
2. Se registra el SW, se pide permiso nativo, se guarda la suscripción en `push_subscriptions`.
3. Pasa una semana sin que el usuario planifique (`meal*plans` sin fila para la `semana*iso` actual).
4. `pg_cron` dispara `send-weekly-reengagement-push` el domingo.
5. La función encuentra al usuario (suscrito + sin plan), le envía el push.
6. El navegador (con la app cerrada) muestra la notificación nativa vía el service worker.
7. El usuario toca la notificación → `notificationclick` abre `/menu`.

***Testing******:***

- E2E manual (no automatizado, per Gotcha #10 del skill — fuera de alcance de esta metodología): recorrer los 7 pasos contra staging con un usuario de prueba real.

***Estimated time******:*** 30 min

---

## Technical Decisions (Story-specific)

> Regla de promoción a ADR: decisión que pasa ***arquitectónica + difícil de revertir*** se promueve fuera de este plan. Ver evaluación de cada candidato abajo.

### Decision 1: Mecanismo de disparo semanal — `pg*cron` + `pg*net` → Edge Function

***Chosen******:*** `pg*cron` (ya habilitado, precedente FRESCO-238) + `pg*net` (`net.http*post`) invocando la Edge Function, con el `service*role` key en Supabase Vault.

***Reasoning******:***

- ✅ Reutiliza extensión ya activa en el proyecto, cero infraestructura nueva de scheduling.
- ✅ Patrón confirmado como soportado en la documentación oficial de Supabase (`pg_net: Async Networking`).
- ❌ Trade-off: introduce `pg*net` como dependencia nueva (el uso previo de `pg*cron` en el proyecto —FRESCO-238— era SQL puro, sin llamada HTTP saliente); requiere verificar en Stage 2 si `pg_net` ya está habilitado o si hace falta una migration adicional solo para eso.

***→ Evaluado para ADR******:****** SÍ candidato.**** Pasa el doble filtro — es arquitectónico (establece CÓMO se agendan jobs recurrentes que necesitan hacer I/O externo en este proyecto, un patrón que reaparecerá en cualquier feature futura de scheduling+HTTP) y es relativamente difícil de revertir (una vez varios jobs dependen de `pg_net`+Vault para el secret, migrar a otro scheduler — p.ej. Vercel Cron — implica reescribir cada uno y mover el secret fuera de Vault). ****No se redacta el ADR en este pase (solo planning) — se flagea para promoción antes de Stage 2.***

### Decision 2: Librería de envío Web Push — `web-push` (npm vía Deno) vs implementación manual del protocolo

***Chosen******:*** pendiente de spike (Step 6) — usar `web-push` si el import `npm:web-push` resulta compatible con el runtime Deno de Supabase Edge Functions; si no, implementación manual con Web Crypto API (VAPID JWT + `aes128gcm`).

***Reasoning******:***

- ✅ Si `web-push` funciona en Deno: ahorra implementar cifrado `aes128gcm` y firma VAPID a mano (superficie de bugs criptográficos evitada).
- ❌ Trade-off: si no es compatible, la implementación manual es la única infraestructura de envío push del proyecto y queda embebida en una sola Edge Function — cualquier feature de push futura la reutiliza o la duplica.

***→ Evaluado para ADR******:****** SÍ candidato, con la misma fuerza que Decision 1.**** Pasa gate 1 (arquitectónico — es el mecanismo de envío que CUALQUIER feature de push futura de este proyecto reutilizará) y gate 2 (difícil de revertir — una vez el cifrado/firma está embebido y otras features potenciales lo llaman, cambiar de librería o de implementación manual toca múltiples call sites). ****No se redacta el ADR en este pase — se flagea para promoción antes de Stage 2***, idealmente DESPUÉS del spike de compatibilidad Deno (la decisión real, no la intención, es lo que se documenta).

### Decision 3: Schema de la tabla `push_subscriptions` (story-local, NO promovida a ADR)

***Chosen******:*** columnas mínimas (`endpoint`, `p256dh`, `auth`, `user*id`) + RLS estándar del proyecto (patrón `*select*own`/`*insert*own`/`*delete_own`), sin tabla genérica de "canales de contacto del usuario".

***Reasoning******:***

- ✅ Consistente con el resto del schema (mismo patrón RLS que `meal_plans`).
- ❌ Trade-off: si en el futuro se añaden más canales (SMS, etc.) esta tabla no generaliza — habría que migrar a un modelo de "canales" más genérico.

***→ Evaluado para ADR******:****** NO.*** Falla gate 2 — es una tabla nueva, acotada a esta feature; cambiar su schema más adelante (añadir columnas, migrar a un modelo más genérico) no es cross-cutting ni bloquea otras features existentes. Queda story-local en este plan.

---

## Dependencies

***Pre-requisitos técnicos******:***

- [ ] Confirmar si `pg_net` está habilitado en el proyecto Supabase de Fresco (no verificado en esta pasada) — ***BLOCKER si no está y no se puede habilitar*** (Decision 1 depende de esto).
- [ ] Confirmar compatibilidad `npm:web-push` en Deno Edge Functions (spike Step 6) antes de comprometerse a la librería en el ADR.
- [ ] Decisión de producto: horario exacto del cron semanal (domingo noche vs. lunes temprano) — no bloqueante para arrancar Step 1-5, sí para Step 7.
- [ ] Definir icono/badge de las notificaciones push (asset gráfico) — usado por `showNotification()`; puede reutilizar el icono ya existente del proyecto si hay uno en `public/`.

---

## Risks & Mitigations

***Risk 1******:****** Cobertura limitada en iOS Safari***

- ***Impact******:*** Medium — Web Push en iOS Safari solo funciona si la PWA fue instalada ("Añadir a pantalla de inicio"), y solo desde iOS 16.4+. Usuarios iOS que solo usan Fresco desde el navegador (sin instalar) quedan fuera de alcance.
- ***Mitigation******:*** documentar la limitación explícitamente en el PR/README; el Centro de Avisos (`/ls`) sigue siendo el canal de respaldo para ese segmento. No es un blocker para shippear — es una limitación de plataforma conocida, no un bug.

***Risk 2******:****** Tasa de opt-in baja***

- ***Impact******:*** Medium — si pocos usuarios aceptan el permiso del navegador, el impacto real en re-enganche es limitado.
- ***Mitigation******:*** copy cuidado en el componente de opt-in (Step 4, AC7) explicando el valor antes de pedir el permiso nativo; medir la tasa de opt-in como seguimiento post-lanzamiento (fuera de alcance de este ticket).

***Risk 3******:****** Fuga de la clave privada VAPID***

- ***Impact******:*** High si ocurre — cualquiera con la clave privada podría enviar notificaciones push suplantando a Fresco a cualquier suscriptor.
- ***Mitigation******:*** clave privada SOLO como Supabase Edge Function secret, nunca en `.env` del repo, nunca en el bundle cliente (solo la pública se expone vía `NEXT*PUBLIC*VAPID*PUBLIC*KEY`); verificación explícita en Step 1 (grep sobre el build cliente).

***Risk 4******:****** ****`pg_net`**** no disponible / requiere aprobación adicional***

- ***Impact******:*** Medium — bloquea Decision 1 tal como está planteada.
- ***Mitigation******:*** si `pg_net` no puede habilitarse, la alternativa documentada (Vercel Cron → API route) queda como plan B ya evaluado, sin necesidad de re-planificar desde cero.

---

## Estimated Effort

| Step | Time |
| --- | --- |
| 1. Claves VAPID + configuración de entorno | 30 min |
| 2. Migración `push_subscriptions` + RLS | 45 min |
| 3. Service worker + registro en cliente | 1h |
| 4. UI de opt-in + helpers cliente | 1.5h |
| 5. Integración del opt-in en la app | 30 min |
| 6. Edge Function `send-weekly-reengagement-push` | 3h |
| 7. `pg_cron` — disparo semanal | 45 min |
| 8. Integration — flujo completo | 30 min |
| ***Total**** | ****~******8.5h*** |

***Story points******:*** no aplica formalmente (tech-debt sin story points en Jira) — orden de magnitud: equivalente a una story mediana/grande (2-3 días de trabajo real incluyendo el spike de Step 6 y validación live-UI).

---

## Definition of Done Checklist

- [ ] Código implementado según este plan
- [ ] AC1-AC7 cumplidos (ver Overview)
- [ ] Clave privada VAPID NUNCA presente en `.env` del repo ni en el bundle cliente (verificado)
- [ ] `push_subscriptions` con RLS verificado (usuario A no puede leer/borrar suscripciones de usuario B)
- [ ] Service worker registrado solo tras opt-in explícito (AC7), nunca automático al cargar la app
- [ ] Edge Function `send-weekly-reengagement-push`: query de negocio testeada (AC2/AC4), cleanup de suscripciones muertas testeado (AC5)
- [ ] `pg_cron` agendado y disparo manual verificado antes de dejarlo en producción
- [ ] Tests unitarios escritos (query de negocio, helpers de suscripción cliente)
- [ ] Tests E2E manuales (flujo completo, Step 8) — automatización fuera de alcance de esta metodología
- [ ] Code review aprobado
- [ ] Sin errores de linting/TypeScript (lint + build + zero TS errors)
- [ ] Deployed to staging
- [ ] Manual smoke test en staging: opt-in visible, suscripción persiste, push de prueba llega
- [ ] ***Decisions 1 y 2 promovidas a ADR (****`ADR-0011`****, ****`ADR-0012`**** o el siguiente número libre) ANTES de iniciar Stage 2*** — ver Technical Decisions arriba

---

## Review Workload Forecast

Estimated: 945 additions + 15 deletions = 960 total lines
400-line budget risk: High
Chain strategy: pending
Decision needed before apply: Yes

Notes: `lib/database.types.ts` (regenerado tras la migration de Step 2) se excluye del conteo — generated, do not review. Riesgo High esperable para una construcción de infraestructura de push desde cero (schema + Edge Function + service worker + UI cliente + cron). Descomposición natural sugerida para la resolución de chain strategy (a decidir con `/git-flow-master` antes de Stage 2): PR1 = Steps 1-2 (fundación: VAPID + tabla + RLS), PR2 = Steps 3-5 (cliente: service worker + opt-in UI + integración, depende de PR1), PR3 = Steps 6-8 (servidor: Edge Function + cron + integration test, depende de PR1, independiente de PR2 salvo para el smoke test end-to-end).

---


_Synced from Jira by sync-jira-issues_
