# Comments for FRESCO-234

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-234)

---

### Basi Montes - 8/19/2026, 4:42:18 PM

## Actual Result

`/notifications` solo muestra recomendaciones de recetas ("Recetas que te pueden gustar"), sin ningún aviso de sistema real ni contador de no leídos en el icono.

## Expected Result

Por decidir por el equipo de producto — este ticket documenta el gap encontrado en vivo, no prescribe una implementación.

## Error Type

Functional

## Severity

Moderada

## Test Environment

Staging

---

### Basi Montes - 8/20/2026, 5:00:01 PM

## Plan de implementación — FRESCO-234

***Alcance acordado con el usuario******:*** enrutar el aviso real de pago fallido (dato ya existe desde FRESCO-232) al Centro de Avisos (`/notifications`), y añadir un badge de "no visto" en el icono de campana de `/menu`. No se toca la infraestructura de notificaciones push/email (fuera de MVP scope).

### Contexto técnico (de investigación)

- `/notifications` (`app/(app)/notifications/page.tsx:26-104`) ya compone 3 secciones vía `Promise.all` con fallback silencioso: bienvenida, rutas principales, recomendaciones de recetas. Comentario en L16-25 ya deja el hueco documentado como trabajo futuro.
- El aviso de pago fallido ya vive en `/profile` (`app/(app)/profile/page.tsx:52-55, 191-202`), leído vía `getPaymentFailedAt` (`lib/api/user-profile.ts:229-256`), gateado por `plan === 'pro' && paymentFailedAt`.
- No existe hoy ningún concepto de "leído/no visto" genérico — solo dos flags puntuales: `aviso*bienvenida*visto` y la columna de routes-notice-descartado (migración `20260818100000`).
- El icono de campana vive directo en `app/(app)/menu/page.tsx:131-138` (no hay componente Header separado). No hay ningún patrón de badge/contador existente en el repo.
- Patrón a replicar para la nueva sección: `RecommendedRecipesNotice` (`components/notifications/recommended-recipes-notice.tsx:24-49`) — server component sin estado, recibe datos ya fetcheados por props, `Card`/`CardHeader`/`CardTitle`/`CardContent`, retorna `null` si no hay nada que mostrar.

### Tareas

1. ***Nuevo componente ***`PaymentFailedNotice` (`components/notifications/payment-failed-notice.tsx`) — server component, mismo patrón que `RecommendedRecipesNotice`, `Card variant="danger"`, `data-testid="notifications*payment*failed_notice"`. Recibe `paymentFailedAt` por prop, retorna `null` si es `null`.
2. ***Wiring en ****`/notifications` — sumar `getPaymentFailedAt` + `plan` al `Promise.all` existente (mismo guard `.catch()` que las otras 3 llamadas). Renderizar la nueva sección ****antes*** de las 3 existentes (aviso de sistema real tiene prioridad sobre contenido curado). Actualizar la condición del `EmptyState` (L93-101) para incluir este cuarto caso.
3. ***Badge de no-visto*** — nueva función `getHasUnseenNotifications(userId)` en `lib/api/user-profile.ts`: una sola query a `user*profiles` seleccionando `aviso*bienvenida*visto`, la columna de routes-descartado, `payment*failed_at` y `plan`; retorna `true` si cualquiera de los 3 avisos está pendiente. Se llama desde `app/(app)/menu/page.tsx` junto al resto del data-fetching de esa página.
4. ***UI del badge*** — en `menu/page.tsx:131-138`, envolver el `Bell` en un `span` relativo y agregar un punto rojo absoluto (`data-testid="notificaciones_badge"`) cuando `hasUnseenNotifications` es `true`. Sin contador numérico en esta iteración — solo indicador binario (alcance acordado).
5. ***Regresión*** — añadir escenario Gherkin en `.context/qa/regression.feature` cubriendo: aviso de pago fallido visible en `/notifications` para cuenta Pro con pago fallido; badge visible en `/menu` cuando hay avisos pendientes; badge ausente cuando no hay nada pendiente.

### Fuera de alcance

- Contador numérico en el badge (queda como posible follow-up).
- Persistir un estado "leído" explícito para el aviso de pago fallido (se deriva de `payment*failed*at`, igual que en `/profile` hoy).
- Cualquier canal push/email.

## Review Workload Forecast

Estimated: ~110 additions + ~15 deletions = ~125 total lines
400-line budget risk: Low
Chain strategy: stacked-to-main
Decision needed before apply: No

---

### Basi Montes - 8/20/2026, 5:35:54 PM

## Listo para QA

Mergeado a `staging` (PR #107, squash). Deploy verificado READY, `fresco-pre.vercel.app` realiaseado al build correcto.

***A verificar******:***

- `/menu`: badge (punto rojo) en el icono de campana cuando hay avisos pendientes (bienvenida, rutas, o pago fallido) — ausente si no hay nada pendiente.
- `/notifications`: aviso de pago fallido visible arriba de las secciones existentes cuando `payment*failed*at` está seteado en una cuenta Pro.

***Nota******:*** el caso "aviso de pago fallido visible" no se pudo reproducir en vivo esta sesión (ver `review.md` para el detalle) — queda pendiente de verificación real la próxima vez que haya una cuenta con pago fallido genuino.

---


_Synced from Jira by sync-jira-issues_
