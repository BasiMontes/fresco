# Spec Compliance Matrix — FRESCO-17

| AC scenario (Gherkin) | covered_by | evidence | status |
|---|---|---|---|
| Generar un menú completo como invitada | manual:live-ui-validation | Playwright-cli session (fresh, cookie-less profile) → `/onboarding` → 3 steps → real Gemini generation → landed on `/menu` with a real 21-meal week rendered. No signup/login prompt shown at any point. | covered |
| La sesión de invitada es una sesión de autenticación válida | manual:live-ui-validation | Decoded the `sb-jdqemhewjrjuopssdurn-auth-token` cookie: real JWT, `role: authenticated`, `is_anonymous: true`. Network log: `POST /auth/v1/signup → 200` (Supabase's anonymous sign-in endpoint). Zero Edge Function / RLS changes in this diff. | covered |

No unit-test infra exists in this project (confirmed via `package.json` — only `test:e2e` for Playwright, no `bun test` script), so manual live-evidence is the applicable `covered_by` shape here, consistent with this session's established pattern for prior stories.
