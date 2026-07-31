# Spec Compliance Matrix — FRESCO-19

| AC scenario (Gherkin) | covered_by | evidence | status |
|---|---|---|---|
| El registro se solicita solo después de ver el menú generado | manual:live-ui-validation | Live guest flow (Playwright-cli): after real Gemini generation landed on `/menu`, the `guest_save_menu_banner` → "Guardar mi menú" CTA rendered, linking to `/signup`. | covered |
| El registro nunca aparece antes de ver un menú | manual:live-ui-validation | Verified in FRESCO-17's live pass: onboarding (pre-menu) never shows any registration prompt; unchanged by this diff. | covered |
| Convertir la cuenta de invitada conserva el menú generado | manual:partial | `updateUser({email,password})` call confirmed reaching Supabase correctly (real 400/422 responses observed for two error branches, proving payload/auth/session wiring is correct); the success-response redirect-to-`/menu` branch (3 lines) was not exercised with a real 200 to avoid burning a real email send — see `review.md` finding 1. | manual |
| El email de registro ya pertenece a otra cuenta existente (caso límite) | manual:live-ui-validation | Live test using the project's existing registered test user's email: `PUT /auth/v1/user` → `422`, header `x-sb-error-code: email_exists` → `signup_email_conflict_message` rendered ("Ya existe una cuenta con ese email. Inicia sesión…"), linking to `/login`. Real data reassignment intentionally deferred — tracked as **FRESCO-20** (explicit user decision this session). | covered (detection + non-silent fallback); reassignment tracked separately |

No unit-test infra in this project (same as FRESCO-17) — manual live evidence is the applicable shape.
