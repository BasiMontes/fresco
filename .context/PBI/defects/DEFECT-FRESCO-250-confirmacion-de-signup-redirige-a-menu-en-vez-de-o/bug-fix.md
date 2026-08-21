# Bug fix — FRESCO-250

## Root cause
Both signup entry points (`app/signup/page.tsx:234` and `components/onboarding/identity-step.tsx:73`) call `signUp({ email, password })` with no `options.emailRedirectTo`. When email confirmation is required (confirmed: normal case for this project, not dev-only), Supabase's hosted `/auth/v1/verify` endpoint verifies the PKCE token server-side and redirects the browser to whatever Site URL is configured in the Supabase Dashboard (outside this repo) — currently lands on `/menu`. No app-level gate exists to catch an authenticated-but-never-onboarded user: `app/(app)/layout.tsx:26-30` only checks `if (!user) redirect('/login')`.

Both flows correctly defer profile-field collection until after a session exists (both explicitly check `data.session` and stop if absent) — no in-flight onboarding data is lost. The bug is purely: (a) no redirect steering post-confirmation, (b) no defense-in-depth gate.

## Fix
1. `emailRedirectTo: \`${window.location.origin}/onboarding\`` at both `signUp()` call sites.
2. Onboarding-completion gate in `app/(app)/layout.tsx` after the existing auth check: if no `user_profiles` row exists for `user.id`, redirect to `/onboarding`. Row-existence is the correct signal (not a new boolean column) — `upsertUserProfile()` in `app/onboarding/page.tsx:237` (step 4, `handleGenerate()`) is the ONLY place a row is ever written; no DB trigger auto-provisions one on signup. `nombre`/`sexo`/`objetivo` are legitimately nullable even for a fully-onboarded user, so an all-null check would be wrong.
3. `/onboarding` lives outside the `(app)` route group — the gate cannot redirect-loop against it.

## Known external dependency (not fixable from this repo)
Supabase Dashboard → Authentication → URL Configuration must have `/onboarding` (or the app's origin wildcard) in the Redirect URLs allowlist, or `emailRedirectTo` will be silently ignored and Supabase will fall back to Site URL again. No MCP/CLI tool available in this session to read or set that config — flagged to the user as a manual verification step.

## Risk
Low. `emailRedirectTo` change has no effect on the synchronous-session (autoconfirm) path. Gate exempts `/onboarding` structurally (different route group). One extra Supabase round trip per `(app)/*` request, same file already does parallel queries.
