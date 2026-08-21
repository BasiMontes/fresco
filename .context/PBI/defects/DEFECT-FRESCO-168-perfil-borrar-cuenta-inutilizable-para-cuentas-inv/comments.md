# Comments for FRESCO-168

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-168)

---

### Basi Montes - 8/11/2026, 9:40:58 PM

## Reapertura tras sweep de QA

Este ticket estaba marcado como ***Listo***, pero no existe ningún commit ni PR que lo referencie (`git log --all --grep` y `gh pr list --search` devuelven cero resultados para FRESCO-168). Nunca se implementó el fix. Se reabre.

### Reproducción (hoy, 2 agentes de QA independientes)

Confirmado en código: `components/profile/delete-account-dialog.tsx` línea 33:

```
const isConfirmed = typedEmail.trim().length > 0 && typedEmail.trim() === email;
```

Para un usuario invitado, `email` siempre es `''` (asignado en `app/(app)/profile/page.tsx` línea 162: `email={user?.email ?? ''}`). La condición exige que el valor escrito sea simultáneamente no-vacío ***y*** igual a `''` — matemáticamente imposible. El diálogo de confirmación literalmente pide "Escribe [vacío] para confirmar" a una cuenta invitada. Ningún invitado puede pasar esta validación.

### Impacto

Gap real de GDPR / derecho al olvido: una cuenta invitada no tiene ninguna vía funcional para borrar sus datos.

### Estado

No existe PR ni commit asociado a este ticket pese al estado "Listo". Se transiciona de vuelta a ***Control de calidad***.

---

### Basi Montes - 8/11/2026, 9:46:51 PM

***Corrección de estado***: el comentario anterior en este ticket decía "sin PR pese a estado Listo, reabriendo" — error de interpretación. En este proyecto "Listo" = cola "Ready for Dev" (nunca empezado), no "Done" (ese es "Finalizada"). El ticket nunca estuvo cerrado, simplemente no se había implementado. Vuelto a "Listo". La evidencia de re-verificación en vivo del comentario anterior sigue siendo válida y vigente.

---

### Basi Montes - 8/11/2026, 10:00:13 PM

## Root Cause & Fix Plan

### Root Cause

`components/profile/delete-account-dialog.tsx` (confirmed, line 33 before fix):

```
const isConfirmed = typedEmail.trim().length > 0 && typedEmail.trim() === email;
```

For a guest/anonymous session, `email` is always `''` (`app/(app)/profile/page.tsx`, `DangerZone email={user?.email ?? ''}`). The guard requires the typed value to be ***both**** non-empty ****and*** equal to `''` at the same time — mathematically impossible. No guest can ever pass this gate, so the "Borrar cuenta definitivamente" button never enables for guests. This also produces a display bug: the dialog copy literally rendered "Escribe  para confirmar" (empty target) for a guest.

***Category******:*** Code Error — confirmation-gate condition never accounted for the guest/no-email case; a design gap, not a typo.

***Impact******:*** GDPR / right-to-erasure gap — guest accounts had no functional self-service path to delete their data.

### Fix

Guest sessions have no real email to type, so the "type your email" pattern doesn't apply to them. Added a guest-aware branch instead of relaxing the check:

- New fixed confirmation phrase for guests: `BORRAR CUENTA` (Spanish, matches this app's existing destructive-action tone, e.g. `GuestLogoutDialog`'s "Cerrar sesión de todas formas").
- `DeleteAccountDialog` gains an `isAnonymous: boolean` prop; `confirmationTarget = isAnonymous ? 'BORRAR CUENTA' : email`. The gate, the description copy, the input placeholder/aria-label, and the disabled-button test all key off `confirmationTarget` — the display bug is a natural side effect fix, not a separate patch.
- `isAnonymous` is threaded through `DangerZone` from `ProfilePage` (`user?.is_anonymous ?? false`), the same source already used elsewhere in the app (e.g. `app/(app)/layout.tsx`).
- Authenticated users with a real email keep the exact existing flow — unchanged.
- `deleteAccount` API call / deletion logic untouched — this is a confirmation-gate UX fix only.

### Files touched

- `components/profile/delete-account-dialog.tsx`
- `components/profile/danger-zone.tsx`
- `app/(app)/profile/page.tsx`

---

### Basi Montes - 8/12/2026, 12:14:56 PM

## Listo para QA

PR: https://github.com/BasiMontes/fresco/pull/40
Branch (merged, deleted): `fix/FRESCO-168-guest-delete-account-confirm`
Commit en staging: `715a9e4`
Deploy de staging: verificado READY en Vercel (`fresco-git-staging-basi-montes-projects.vercel.app`)

Fix: `DeleteAccountDialog` ahora distingue sesión invitada (`isAnonymous`) — invitados confirman con la frase "BORRAR CUENTA" en vez de un email inexistente. Cuentas reales sin cambios.

Nota: este ticket viene de un QA sweep puntual, no de un flujo shift-left — se deja sin asignar (sin QA owner identificable) a la espera de que alguien lo tome.

---


_Synced from Jira by sync-jira-issues_
