# Comments for FRESCO-225

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-225)

---

### Basi Montes - 8/17/2026, 5:09:34 PM

## Acceptance Criteria

```gherkin
Scenario: Veo el aviso de rutas principales
  Given entro al Centro de Avisos
  When el aviso de rutas principales está disponible
  Then veo un aviso con enlaces a Menú, Calendario y Lista de la Compra

Scenario: Sigo un enlace del aviso
  Given veo el aviso de rutas principales
  When toco uno de los enlaces
  Then soy llevada a esa sección de la app

Scenario: Descarto el aviso
  Given veo el aviso de rutas principales
  When elijo descartarlo
  Then el aviso desaparece y no vuelve a aparecer
```

---

### Basi Montes - 8/17/2026, 5:09:35 PM

## Scope

- Aviso estático con enlaces a Menú, Calendario y Lista de la Compra
- Descartable; no reaparece una vez descartado

---

### Basi Montes - 8/17/2026, 5:09:37 PM

## Out Of Scope

- Recorrido interactivo guiado paso a paso sobre cada pantalla (tour animado); esto es solo un aviso con enlaces, no un tutorial interactivo
- Enlaces personalizados según el uso real de la usuaria

---

### Basi Montes - 8/17/2026, 9:10:35 PM

QA verificado en staging (fresco-pre.vercel.app): en el Centro de Avisos (/notifications) siempre se muestra el estado vacío "Sin notificaciones" / "Te avisaremos aquí cuando haya algo nuevo.", tanto en el código fuente (comentario explícito en el componente: "Always renders the empty state — no notification-generating system exists anywhere in the app yet") como en vivo en staging. No existe ningún aviso con enlaces a Menú, Calendario y Lista de la Compra.

Los 3 escenarios de los criterios de aceptación no se pueden validar porque el aviso descrito no existe:
1. "Veo el aviso de rutas principales" — no aparece ningún aviso.
2. "Sigo un enlace del aviso" — no hay enlaces que seguir.
3. "Descarto el aviso" — no hay nada que descartar.

Pasos para reproducir: iniciar sesión, ir a /notifications (o Perfil > Centro de Avisos, campana de la barra lateral).
Esperado: un aviso con enlaces a Menú, Calendario y Lista de la Compra.
Observado: pantalla vacía con icono de campana y texto "Sin notificaciones".


---

### Basi Montes - 8/17/2026, 10:19:48 PM

## Spec Implementation Plan (Dev)

Shared feature: Centro de Avisos (EPIC-FRESCO-223). One migration + one lib module powers all 3 notices; route rewritten from its hardcoded-empty state.

1. Migration `add*centro*avisos*flags*to*user*profiles`: adds `centro*avisos*bienvenida*vista` and `centro*avisos*rutas*descartado` booleans (default false) to `user_profiles` -- server-side persistence so state survives a device change (FRESCO-224 AC).
2. `lib/api/user-profile.ts`: add `getNotificationCenterState()` (one `.maybeSingle()` read; missing row = onboarding not completed, same signal `getUserPlan`/`getUserDietaryPreferences` already use), `markWelcomeMessageSeen()`, `markRoutesNoticeDismissed()` -- same fail-fast pattern as `updateNombre`.
3. FRESCO-226 recommendations reuse the existing `getLatestAvailableRecipes()` (already `get*filtered*recipes()`-safety-filtered, FRESCO-59) capped to 3 -- no new backend, no risk of surfacing an allergen-violating recipe.
4. New `components/notifications/`: `welcome-notice.tsx` (client, marks seen on mount), `routes-notice.tsx` (client, dismiss button persists), `recommended-recipes-notice.tsx` (server, links to `/recipes/[id]`).
5. `app/(app)/notifications/page.tsx` rewritten: server component reads `getNotificationCenterState()` + conditionally `getLatestAvailableRecipes()`, renders whichever notices apply; EmptyState only when none do.
6. Unit tests in `lib/api/user-profile.test.ts` for the 3 new functions, mirroring existing `getUserPlan`/`updateNombre` mock patterns.

FRESCO-203 (open-ended "pensar notificaciones: bienvenida, mini ruta, recetas") is fully absorbed by this plan -- no separate code, closed as duplicate once these 3 ship.


---

### Basi Montes - 8/18/2026, 11:20:43 AM

## Spec Implementation Plan (Dev)

***Objetivo:*** aviso estático con enlaces a Menú/Calendario/Lista de la Compra en `/notifications`, descartable, no vuelve a aparecer (cross-device).

***Pasos:***
1. Migración: columna `aviso*rutas*descartado boolean not null default false` en `user_profiles`.
2. `lib/api/user-profile.ts`: `getShouldShowRoutesNotice` (lectura, mismo patrón que FRESCO-224) + `markRoutesNoticeDismissed` (escritura, fail-fast).
3. Nuevo `components/notifications/routes-notice.tsx` (client): tarjeta con 3 enlaces (iconos Home/Calendar/ShoppingCart, mismos que el sidebar) + botón "Descartar" (icon variant, X) que llama `markRoutesNoticeDismissed` vía `createClient()` y oculta la tarjeta localmente.
4. `app/(app)/notifications/page.tsx`: server component añade lectura de `getShouldShowRoutesNotice` y renderiza `<RoutesNotice />` cuando aplica.
5. Unit tests en `lib/api/user-profile.test.ts` para las 2 funciones nuevas.

## Review Workload Forecast

Estimado: ~180 líneas (+migración, +2 funciones, +componente cliente, +wiring, +tests)
Riesgo presupuesto 400 líneas: Low
Estrategia de cadena: stacked-to-main (PR único)
Decisión necesaria antes de aplicar: No


---

### Basi Montes - 8/18/2026, 11:28:48 AM

Desplegado en staging (https://fresco-git-staging-basi-montes-projects.vercel.app), PR #95 mergeada. AC verificada con Playwright CLI: aviso muestra los 3 enlaces, navega correctamente, se descarta y no reaparece tras recargar. Listo para QA.

---

### Basi Montes - 8/18/2026, 1:15:29 PM

QA verificado en staging (fresco-pre.vercel.app): el aviso 'Explora Fresco' con enlaces a Menú, Calendario y Lista de la compra se muestra en /notifications, el botón 'Descartar aviso' lo oculta inmediatamente y la preferencia persiste en servidor (verificado recargando la página). Comportamiento conforme a los criterios de aceptación.

---


_Synced from Jira by sync-jira-issues_
