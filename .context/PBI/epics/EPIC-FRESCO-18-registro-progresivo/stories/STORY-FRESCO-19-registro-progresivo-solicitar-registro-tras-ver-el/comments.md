# Comments for FRESCO-19

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-19)

---

### Basi Montes - 7/31/2026, 2:13:10 PM

## Acceptance Criteria

```gherkin
Escenario: El registro se solicita solo después de ver el menú generado
  Dado que soy Laura, una invitada, y ya he visto mi menú semanal generado
  Cuando decido conservar ese menú
  Entonces el sistema me pide crear una cuenta
  Y el mensaje se presenta como "guardar lo que ya viste", no como una pared de pago
```

```gherkin
Escenario: El registro nunca aparece antes de ver un menú
  Dado que soy Laura, una invitada que todavía no ha visto ningún menú generado
  Entonces el sistema no debe mostrarme ninguna solicitud de registro en ningún punto del flujo previo
```

```gherkin
Escenario: Convertir la cuenta de invitada conserva el menú generado
  Dado que soy una invitada con un menú generado y decido registrarme
  Cuando completo el registro indicando email y contraseña
  Entonces mi sesión de invitada se convierte en una cuenta permanente conservando el mismo identificador de usuario
  Y el menú que ya había generado sigue asociado a mi cuenta sin ninguna reasignación manual de datos
```

```gherkin
Escenario: El email de registro ya pertenece a otra cuenta existente (caso límite)
  Dado que soy una invitada e intento registrarme con un email que ya pertenece a otra cuenta
  Cuando el sistema no puede convertir directamente mi sesión de invitada a esa cuenta
  Entonces debo poder iniciar sesión con esa cuenta existente
  Y mis datos de invitada (menú generado) deben poder reasignarse a esa cuenta existente
```

---

### Basi Montes - 7/31/2026, 2:13:11 PM

## Scope

- Mostrar la solicitud de registro únicamente después de que la invitada haya visto su menú generado, nunca antes (secuencia estricta, ver `user-journeys.md` Jornada 1, Paso 5).
- Convertir una sesión de invitada existente en una cuenta permanente (email + contraseña) conservando el mismo identificador de usuario y todo lo generado durante la visita de invitada, para el caso general sin conflicto de email.
- Cubrir explícitamente el caso en que el email elegido ya pertenece a una cuenta distinta: permitir iniciar sesión con esa cuenta existente y reasignarle los datos de invitada, en vez de fallar silenciosamente.

---

### Basi Montes - 7/31/2026, 2:13:13 PM

## Out Of Scope

- Qué ocurre si la invitada nunca se registra — pertenece al gap ya señalado en la historia de Modo Invitado, no se resuelve aquí.
- Resolver de forma automática la fricción de verificación de email (dominios rechazados, límites de envío) más allá de aceptarla como riesgo conocido — ADR-0003 la señala como un riesgo a mitigar en la implementación técnica, no como algo que esta historia deba diseñar desde cero.
- Cualquier flujo de registro que no parta de una sesión de invitada previa (registro directo sin haber usado el Modo Invitado) — ese es el flujo de registro estándar ya existente, no el de esta historia.

---

### Basi Montes - 7/31/2026, 2:13:14 PM

## Business Rules Specification

- La conversión de cuenta usa `updateUser()` sobre la sesión anónima existente, preservando el mismo identificador de usuario — decisión ya tomada en ADR-0003 (Accepted), no se evalúan alternativas aquí.
- Si el email indicado ya pertenece a una cuenta distinta, la conversión directa falla y el flujo debe caer en iniciar sesión con la cuenta existente más una reasignación manual de los datos de invitada — patrón documentado explícitamente por Supabase y citado en ADR-0003 como una rama que esta historia debe cubrir, no un caso ignorable.
- La verificación de email antes de fijar contraseña es un paso obligatorio de la plataforma de autenticación — la fricción que introduce (dominios no estándar rechazados, límites de envío en el nivel gratuito) es un riesgo nombrado en ADR-0003, no un defecto de esta historia.

---

### Basi Montes - 7/31/2026, 2:49:28 PM

## Spec Implementation Plan (Dev)

***Story******:*** FRESCO-19 — Registro Progresivo | Solicitar registro tras ver el menú generado

### Root of the gap

Three things, all discovered live (not assumed):

1. `/menu` has NO path into `/signup` at all today — no "guardar/conservar" CTA exists anywhere. `/signup`'s copy ("Guarda tu menú… no perder el menú que acabamos de generar") was clearly written for this exact conversion moment, but nothing links to it.
2. `/signup`'s `handleSubmit` always calls `client.auth.signUp({ email, password })` — for a guest with an active anonymous session, this is the WRONG call. Per ADR-0003 the correct upgrade path is `updateUser({ email, password })` on the existing anonymous session, which preserves `user*id` (and therefore the already-generated `meal*plans` row). `signUp()` while an anonymous session is active does not do this — it's the plain "create a brand-new user" path this repo already uses for direct registration (unrelated to the guest flow, must stay unchanged for that case).
3. ***AC4 (email-already-exists edge case)****: real reassignment of a guest's data to a different, existing account means moving rows across real `user*id`s — `meal*plans`/`shopping*lists` reference `user*profiles(id)` by FK, `user_profiles.id` IS the `auth.users.id`. There is no "merge two users" primitive in Supabase Auth; building this safely needs a dedicated privileged migration path (who calls it, when, with what proof of ownership) — genuinely cross-cutting, not a one-line addition. ****User decision (asked explicitly this session)******:****** ship a safe, non-silent fallback now (detect the conflict, tell her to log in with the existing account instead of losing her session with no explanation); track the real data-migration as a separate tech-story, not bolted on here.***

### Change

1. `app/(app)/menu/page.tsx`: read `user.is_anonymous` via `supabase.auth.getUser()` (server client, already imported). When a plan exists AND the user is anonymous, render a "Guardar mi menú" banner/CTA linking to `/signup`. Registered users never see it (no session to distinguish = normal registered flow, unchanged).
2. `app/signup/page.tsx`:
3. ***Deferred, tracked separately (not this story)******:*** the actual data-reassignment RPC for the AC4 conflict branch — needs its own design pass (who proves ownership of the existing account, what moves, in what transaction). Logged as a Jira tech-story linked to FRESCO-19.

### AC → step mapping

| AC scenario | Covered by |
| --- | --- |
| El registro se solicita solo después de ver el menú generado | New CTA on `/menu`, gated on `is_anonymous` + plan existing |
| El registro nunca aparece antes de ver un menú | Unchanged — onboarding already has no such prompt (verified in FRESCO-17) |
| Convertir la cuenta de invitada conserva el menú generado | `updateUser()` branch in `/signup` |
| El email de registro ya pertenece a otra cuenta (edge case) | `email_exists` detection → non-silent message + `/login` link; data reassignment tracked as a follow-up tech-story, not built here (explicit user decision) |

### Workload Forecast

Estimated: ~60 additions + ~10 deletions = ~70 lines, 2 files
400-line budget risk: Low
Chain strategy: n/a — `solo-main`, direct commit to `main`
Decision needed before apply: No

---


_Synced from Jira by sync-jira-issues_
