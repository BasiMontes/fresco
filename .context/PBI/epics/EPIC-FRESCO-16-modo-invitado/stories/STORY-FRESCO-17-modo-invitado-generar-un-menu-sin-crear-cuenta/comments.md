# Comments for FRESCO-17

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-17)

---

### Basi Montes - 7/31/2026, 2:12:44 PM

## Acceptance Criteria

```gherkin
Escenario: Generar un menú completo como invitada
  Dado que soy Laura, visito Fresco por primera vez y no tengo ninguna cuenta
  Cuando abro la aplicación y completo el onboarding de 3 pasos sin que se me pida registrarme
  Entonces el sistema genera mi menú semanal completo de 21 comidas
  Y en ningún momento del flujo se me exige crear una cuenta
```

```gherkin
Escenario: La sesión de invitada es una sesión de autenticación válida
  Dado que soy una visitante sin cuenta que acaba de empezar a usar Fresco
  Cuando el sistema me asigna una sesión de invitada para poder generar mi menú
  Entonces esa sesión debe ser una sesión de Supabase Auth válida (Anonymous Sign-In, ver ADR-0003)
  Y todas las políticas de acceso a datos existentes se aplican sin ninguna modificación de código
```

---

### Basi Montes - 7/31/2026, 2:12:45 PM

## Scope

- Generar un menú semanal completo (21 comidas) para una visitante sin cuenta, reutilizando el mismo flujo de onboarding y generación que ya existe para usuarias registradas (EPIC-FRESCO-1, EPIC-FRESCO-2).
- Asignar automáticamente una sesión de invitada válida en el momento en que la visitante empieza a usar la aplicación, sin ninguna acción explícita de su parte.
- Garantizar que ningún paso del flujo de invitada (onboarding, generación, calendario, lista de la compra) exija crear una cuenta.

---

### Basi Montes - 7/31/2026, 2:12:46 PM

## Out Of Scope

- Qué ocurre con el menú de una invitada que nunca llega a registrarse (se descarta, se conserva temporalmente, queda ligado a la sesión) — no especificado en ningún documento fuente (mismo gap señalado en `user-journeys.md`, Jornada 1). No se inventa aquí; queda como pregunta abierta para una futura historia.
- La solicitud de registro en sí y la conversión de la sesión de invitada a cuenta permanente — eso pertenece a la épica de Registro Progresivo, no a esta historia.
- Limpieza automática de sesiones de invitada abandonadas — Supabase no ofrece este mecanismo de forma nativa (ver ADR-0003, Consecuencias); es una tarea operativa futura, no parte de esta historia.

---

### Basi Montes - 7/31/2026, 2:12:48 PM

## Business Rules Specification

- El mecanismo de autenticación de invitada es Supabase Anonymous Sign-In — decisión ya tomada y verificada en vivo contra el proyecto real (ver ADR-0003, Accepted). No se evalúan alternativas dentro de esta historia.
- Una sesión de invitada es, a todos los efectos de autorización, una sesión de Supabase Auth real (`is_anonymous: true`, con un `auth.uid()` propio) — ninguna política de acceso a datos existente necesita distinguir entre una visitante invitada y una usuaria registrada.
- El límite de creación de sesiones anónimas del proyecto es de 30 por hora (configuración de la plataforma) — un volumen razonable para la fase de validación concierge, pero a tener en cuenta si el tráfico de invitadas crece.

---

### Basi Montes - 7/31/2026, 2:20:49 PM

## Spec Implementation Plan (Dev)

***Story******:*** FRESCO-17 — Modo Invitado | Generar un menú sin crear cuenta
***Scope******:*** frontend-only, 1 file. No Edge Function or RLS changes (per ADR-0003 and this story's Business Rules — existing auth acceptance already works for an anonymous session).

### Root of the gap

`app/onboarding/page.tsx`'s `handleGenerate()` already reads whatever session exists via `client.auth.getSession()` and forwards its `access_token` (or `null`) to `generateMealPlan()`. Today a first-time visitor has NO session at all — `getSession()` returns `null`, the request goes out with no `Authorization` header, and the Edge Function 401s. Nothing else in the app blocks a guest; this is the one missing piece.

### Change

In `app/onboarding/page.tsx`, add a mount-time effect that ensures a session exists before the visitor reaches Step 3:

1. On mount, call `client.auth.getSession()`.
2. If no session exists, call `client.auth.signInAnonymously()` (ADR-0003's chosen mechanism). Do nothing if a session already exists (covers the OTHER caller of this same page — a just-registered user coming from `/signup`, who already has a real session and must not get a redundant anonymous one).
3. On failure (e.g. the anonymous rate limit named in ADR-0003 Consequences), surface a small inline error — this is a real, previously-observed-live failure mode, not a speculative one.

No change to `handleGenerate()` itself — it already does the right thing once a session exists.

### Files touched

- `app/onboarding/page.tsx` — add the mount effect + a session-error message. ~25 lines.

### AC → step mapping

| AC scenario | Covered by |
| --- | --- |
| Generar un menú completo como invitada | Existing onboarding + generation flow, now reachable because a session exists |
| La sesión de invitada es una sesión de autenticación válida | The new `signInAnonymously()` call |

### Workload Forecast

Estimated: ~25 additions + 0 deletions = ~25 lines
400-line budget risk: Low
Chain strategy: n/a — this repo's `git_strategy` is `solo-main` (single branch, direct commit+push to `main`, no staging integration branch); no PR chain needed.
Decision needed before apply: No

---


_Synced from Jira by sync-jira-issues_
