# Comments for FRESCO-94

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-94)

---

### Basi Montes - 8/6/2026, 10:37:32 PM

## Actual Result

Recargar /onboarding en cualquier paso reinicia el store de zustand a su estado inicial: todas las selecciones (dieta, alérgenos, ingredientes, cocinas, adultos/niños) y el paso actual vuelven a sus valores por defecto.

## Expected Result

El progreso del wizard debería sobrevivir a un refresh accidental (persistencia local) o al menos advertir antes de perderlo.

## Error Type

functional

## Severity

mayor

## Test Environment

staging

## Workaround

Ninguno — repetir la selección manualmente.

## Evidence

Eval de aria-pressed sobre los 7 botones dieta_option antes y después del reload: true en todos antes, false en todos después.

---

### Basi Montes - 8/7/2026, 9:56:56 AM

## Spec Implementation Plan (Dev)

### Root cause

`lib/store/onboarding-store.ts` — plain zustand `create()`, no `persist` middleware. All in-memory. A full page reload (F5) re-mounts the JS runtime and the store re-initializes to `initialState`. Confirmed live in the defect eval: 7 dietas selected, F5, all back to `aria-pressed="false"`.

## Fix

1. Wrap the store with zustand's `persist` middleware, backed by `sessionStorage` (matches the defect's "Esperado": minimal persistence, not permanent — a guest reloading mid-onboarding recovers, but closing the tab clears it, same privacy footprint as today).
2. Persist only the wizard's answer fields (`step`, all `dieta*`, `alergenos`, `ingredientesOdiados`, `cocinasFavoritas`, `adultos`, `ninos`) via `partialize` — exclude the action functions (not serializable, not needed).
3. `app/onboarding/page.tsx` — call `useOnboardingStore.getState().reset()` right before `router.push('/menu')` on successful `handleGenerate()`. Without this, the sessionStorage-persisted answers would leak into a later same-tab visit to `/onboarding` (e.g. after generating a menu, going back) — a new bug the persistence fix would otherwise introduce, not present today because the store already resets on remount.

## Test

Extend `lib/store/onboarding-store.test.ts`: after toggling fields and simulating a "reload" (re-`create` the store against the same mocked `sessionStorage`), assert the fields survive. Assert `reset()` clears both in-memory state and the `sessionStorage` key.

## Out of scope

No UI warning/toast — the sessionStorage fix satisfies the defect's "Esperado" without needing an interruption dialog. No changes to steps 2/3 UI or validation logic.

---


_Synced from Jira by sync-jira-issues_
