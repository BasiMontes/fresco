# Comments for FRESCO-226

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-226)

---

### Basi Montes - 8/17/2026, 5:09:58 PM

## Acceptance Criteria

```gherkin
Scenario: Veo recomendaciones basadas en mis preferencias
  Given tengo preferencias dietéticas guardadas
  When entro al Centro de Avisos
  Then veo un aviso con recetas recomendadas que respetan mis restricciones

Scenario: Sin preferencias guardadas
  Given no tengo preferencias dietéticas guardadas
  When entro al Centro de Avisos
  Then no veo el aviso de recomendaciones

Scenario: Abro una receta recomendada
  Given veo el aviso de recetas recomendadas
  When toco una receta recomendada
  Then soy llevada al detalle de esa receta
```

---

### Basi Montes - 8/17/2026, 5:09:59 PM

## Scope

- Las recomendaciones respetan siempre las alergias y restricciones dietéticas declaradas
- El aviso muestra un número acotado de recetas recomendadas (ej. 3)

---

### Basi Montes - 8/17/2026, 5:10:00 PM

## Out Of Scope

- Recomendaciones basadas en el historial de recetas cocinadas o descartadas (posible mejora futura)
- Notificación push cuando aparecen nuevas recomendaciones

---

### Basi Montes - 8/17/2026, 5:10:01 PM

## Business Rules Specification

- Ninguna receta recomendada puede violar un alérgeno o restricción dietética declarada por la usuaria (misma garantía que EPIC-FRESCO-8, Seguridad Alimentaria)

---

### Basi Montes - 8/17/2026, 9:15:13 PM

QA en staging (fresco-pre.vercel.app): el Centro de Avisos (/notifications) muestra siempre el estado vacío "Sin notificaciones", tanto sin preferencias dietéticas guardadas como después de guardar una restricción (se activó "Vegetariano" en Perfil, se guardó, y se revisitó /notifications). No aparece ningún aviso de recomendaciones de recetas en ningún caso.

Revisando el código fuente (app/(app)/notifications/page.tsx), la página siempre renderiza el EmptyState de forma incondicional. Hay un comentario explícito en el propio archivo: "Always renders the empty state — no notification-generating system exists anywhere in the app yet." Es decir, la funcionalidad descrita en esta historia (recomendaciones de recetas en el Centro de Avisos basadas en preferencias) no está implementada; ninguno de los 3 escenarios de los criterios de aceptación puede cumplirse tal como está actualmente en staging.

Se devuelve — el ticket parece haberse movido a Control de Calidad sin implementar el feature (o se implementó en una rama/PR que no llegó a staging).


---

### Basi Montes - 8/17/2026, 10:19:49 PM

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


_Synced from Jira by sync-jira-issues_
