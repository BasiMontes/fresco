# Spec Compliance Matrix — FRESCO-20

| AC scenario (FRESCO-19's AC4, closed here) | covered_by | evidence | status |
|---|---|---|---|
| Email ya existente → iniciar sesión con esa cuenta + reasignar datos | manual:live-ui-validation | Real end-to-end: fresh anonymous guest generated a real menu for the SAME week (2026-W31) the target's existing account already had. `reassign-guest-data` called with a wrong password → `401`, nothing changed. Called again with the real password → `200 {"reassigned":true}`. Confirmed by direct SQL: guest's `user_profiles`/`auth.users` rows deleted, guest's conflicting meal_plan discarded (not force-merged), target's own original W31 plan untouched, target's total plan count unchanged at 1. | covered |
| Security boundary: only the verified target account's own data can be claimed | covered | `information_schema.routine_privileges` confirmed `EXECUTE` on `reassign_guest_data` granted only to `service_role` (and the function owner) — `anon`/`authenticated` have no grant, so no ordinary client can call it directly with an arbitrary user-id pair. | covered |
| `/signup` conflict UI (password prompt + button) | manual:partial | Not click-tested in a browser this pass (see `review.md` finding 1) — code inspection only, same primitives already proven live in FRESCO-17/19. | manual |

No unit-test infra in this project — manual live evidence is the applicable shape, consistent with FRESCO-17/19/22.
