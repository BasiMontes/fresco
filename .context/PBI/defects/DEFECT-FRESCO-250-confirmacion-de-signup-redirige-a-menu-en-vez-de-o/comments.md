# Comments for FRESCO-250

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-250)

---

### Basi Montes - 8/21/2026, 6:07:30 PM

## QA Ready

- PR: https://github.com/BasiMontes/fresco/pull/113 (merged to staging)
- Staging: https://fresco-dev.vercel.app — deploy READY
- Test path: sign up with a fresh email at `/signup`, confirm via the email link → should land on `/onboarding` (not `/menu`)
- Regression check: an existing already-onboarded user should still land on `/menu` normally after login

## IMPORTANT — external dependency, not fixable from this repo
Supabase Dashboard → Authentication → URL Configuration must have `/onboarding` (or the app origin) in the Redirect URLs allowlist for the confirmation link's `redirect_to` to actually work in the deployed environment being tested — otherwise Supabase silently falls back to Site URL and this will look unfixed even though the code is correct. Please verify/add this before testing on staging or production.


---


_Synced from Jira by sync-jira-issues_
