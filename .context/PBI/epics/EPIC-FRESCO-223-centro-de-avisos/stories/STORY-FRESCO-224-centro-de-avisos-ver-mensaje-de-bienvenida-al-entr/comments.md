# Comments for FRESCO-224

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-224)

---

### Basi Montes - 8/17/2026, 5:08:21 PM

## Acceptance Criteria

```gherkin
Scenario: Primera visita muestra bienvenida
  Given soy una usuaria que acaba de completar el onboarding
  When entro al Centro de Avisos por primera vez
  Then veo un aviso de bienvenida que me explica qué puedo hacer en la app

Scenario: La bienvenida no vuelve a aparecer
  Given ya vi el aviso de bienvenida antes
  When vuelvo a entrar al Centro de Avisos
  Then no veo el aviso de bienvenida de nuevo

Scenario: Usuaria sin onboarding completo
  Given no he completado el onboarding
  When entro al Centro de Avisos
  Then no veo el aviso de bienvenida todavía
```

---

### Basi Montes - 8/17/2026, 5:08:22 PM

## Scope

- Aviso de bienvenida único, mostrado la primera vez que entro al Centro de Avisos tras completar el onboarding
- El aviso queda marcado como visto y no vuelve a aparecer, aunque cambie de dispositivo

---

### Basi Montes - 8/17/2026, 5:08:23 PM

## Out Of Scope

- Notificaciones push o email de bienvenida
- Personalización del contenido de bienvenida por segmento de usuaria

---

### Basi Montes - 8/17/2026, 9:13:07 PM

QA en staging (fresco-pre.vercel.app): probe el Centro de Avisos (/notifications) con una cuenta invitada recien creada que acababa de completar el onboarding (los 4 pasos) y generar su primer menu - la primera visita posible al Centro de Avisos.

Esperado (AC, escenario "Primera visita muestra bienvenida"): al entrar al Centro de Avisos por primera vez tras completar el onboarding, deberia verse un aviso de bienvenida que explique que se puede hacer en la app.

Observado: no aparece ningun aviso de bienvenida. La pagina muestra directamente el estado vacio generico "Sin notificaciones" / "Te avisaremos aqui cuando haya algo nuevo.", igual que con una cuenta antigua que ya la hubiera visitado antes. Verifique tambien localStorage y cookies del navegador para descartar que ya existiera un flag de "ya visto" - no existe ninguno.

No se pudo verificar ningun escenario de la AC porque el aviso de bienvenida no existe en absoluto en la UI desplegada en staging.

---

### Basi Montes - 8/17/2026, 10:19:47 PM

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

### Basi Montes - 8/18/2026, 11:06:46 AM

## Spec Implementation Plan (Dev)

***Objetivo:*** mostrar el aviso de bienvenida una única vez en `/notifications` tras completar el onboarding, sin volver a aparecer (ni en otro dispositivo).

***Pasos:***
1. Migración: columna `aviso*bienvenida*visto boolean not null default false` en `user*profiles` (vía Supabase MCP `apply*migration`).
2. Regenerar tipos (`bun run db:types`) + añadir el campo a la facade `api/schemas/user-profile.types.ts`.
3. `lib/api/user-profile.ts`: `getShouldShowWelcomeNotice` (lectura, default conservador `false` si no hay fila = onboarding incompleto) + `markWelcomeNoticeSeen` (escritura, fail-fast).
4. `app/(app)/notifications/page.tsx`: server component async; si debe mostrarse, marca visto y renderiza tarjeta de bienvenida (reusa `Card` variant `default`); si no, mantiene el `EmptyState` actual.
5. Unit tests en `lib/api/user-profile.test.ts` siguiendo el patrón mock existente (`getUserPlan`/`updateNombre`).

## Review Workload Forecast

Estimado: ~150 líneas (+migración, +2 funciones, +UI, +tests)
Riesgo presupuesto 400 líneas: Low
Estrategia de cadena: stacked-to-main (PR único)
Decisión necesaria antes de aplicar: No


---


_Synced from Jira by sync-jira-issues_
