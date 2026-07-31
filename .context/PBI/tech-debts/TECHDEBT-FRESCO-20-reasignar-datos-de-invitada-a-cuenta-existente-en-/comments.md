# Comments for FRESCO-20

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-20)

---

### Basi Montes - 7/31/2026, 3:42:46 PM

## Spec Implementation Plan (Dev)

***Task******:*** FRESCO-20 — Reasignar datos de invitada a cuenta existente en conflicto de email (FRESCO-19)
***Design******:*** see ADR-0004 (Accepted) — full mechanism, alternatives, and consequences.

### Change

1. ***Migration***: `reassign*guest*data(p*from*user*id uuid, p*to*user*id uuid) RETURNS void SECURITY DEFINER` — reassigns `meal*plans` (skip on `unique*user*semana` conflict, target wins), mirrors onto `shopping*lists`, deletes the orphaned `user*profiles` row (cascades away anything left behind). `EXECUTE` revoked from `public/anon/authenticated`, granted only to `service*role`.
2. ***New Edge Function ***`reassign-guest-data`: verifies caller is anonymous, verifies target `{email,password}` via a fresh unauthenticated `signInWithPassword` call (the ownership proof), calls the RPC + `auth.admin.deleteUser()` via a service-role client.
3. ***New shared helper*** `*shared/service-role-client.ts` — the first service-role client factory in this codebase (reads `SUPABASE*SERVICE*ROLE*KEY`), clearly separated from `createRequestClient` (anon/RLS-scoped) so the privilege distinction is visible at the import site.
4. `app/signup/page.tsx`: on `email_exists`, replace the plain link-to-`/login` message with an inline password field + "Continuar con esta cuenta" button that calls the new Edge Function, then `signInWithPassword` + redirect to `/menu` on success.
5. `lib/api/edge-functions.ts`: add `reassignGuestData()` client wrapper, same pattern as the 3 existing ones.

### AC → step mapping (FRESCO-19's AC4, closed by this task)

| AC scenario | Covered by |
| --- | --- |
| Email ya existente → iniciar sesión con esa cuenta + reasignar datos | Steps 1-5 |

### Workload Forecast

Estimated: ~180 additions, 5 files (1 new migration, 1 new Edge Function + shared helper, 1 client wrapper, 1 UI change)
400-line budget risk: Low-Medium
Chain strategy: n/a — `solo-main`
Decision needed before apply: No (design already reviewed via ADR-0004)

---


_Synced from Jira by sync-jira-issues_
