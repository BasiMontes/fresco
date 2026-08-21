# DEFECT: Confirmación de signup redirige a /menu en vez de /onboarding

**Jira Key:** [FRESCO-250](https://basiliomontescastano.atlassian.net/browse/FRESCO-250)
**Priority:** Medium
**Status:** Control de calidad
**Components:** None

---

## Description

## Steps to reproduce

1. Sign up with email + password (new account) via `/signup`.
2. Receive the "Confirma tu cuenta" email.
3. Click "Confirmar mi cuenta".
4. Land directly on `/menu` — onboarding (4-step "Cuéntanos sobre ti" form) is skipped entirely.

## Expected

Confirming the account should route the new user into `/onboarding` to collect name, sex, goal, cooking level before reaching `/menu`.

## Actual

User lands on `/menu` with no onboarding data collected.

## Root cause (investigated)

1. Neither `signUp()` call sets `options.emailRedirectTo` (`app/signup/page.tsx:234`, `components/onboarding/identity-step.tsx:73`) — the confirmation link's `redirect_to` falls back to whatever Site URL / Redirect URLs are configured in the Supabase Dashboard (outside this repo), which currently does not point at `/onboarding`.
2. No app-level onboarding-completion gate exists. `app/(app)/layout.tsx:26-30` only checks `if (!user) redirect('/login')`. No `middleware.ts` exists. There's an `aviso*bienvenida*visto`-style flag pattern already used elsewhere in `user_profiles`, but nothing equivalent for onboarding completion.

## Impact

Every new signup via email/password skips onboarding silently — no personalized recommendations data collected (name, sex, goal, cooking level), no visible error. Affects the entire new-user funnel.

## Repro credentials (already used, disposable)

TEST*USER*EMAIL=basi_montes+fresco@hotmail.com

---

## Metadata

- **Created:** 8/21/2026
- **Updated:** 8/21/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
