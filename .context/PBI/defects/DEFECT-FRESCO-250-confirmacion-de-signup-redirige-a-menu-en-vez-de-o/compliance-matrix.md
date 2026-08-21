# Spec Compliance Matrix — FRESCO-250

Bug ticket, no formal Gherkin AC. Rows map the bug report's expected behavior to evidence.

| Scenario | covered_by | evidence | status |
|---|---|---|---|
| Confirming a new signup routes the user into /onboarding, not /menu | manual | live-UI: real broken account (basi_montes+fresco@hotmail.com) now lands on /onboarding on login | covered |
| A signup POST carries the correct redirect_to param | manual | network inspection on a fresh throwaway signup: redirect_to=http://localhost:3000/onboarding confirmed | covered |
| An authenticated user with no profile cannot bypass onboarding via direct URL/bookmark | manual | live-UI: direct nav to /menu while un-onboarded redirects back to /onboarding | covered |
| Completing onboarding creates the profile and unlocks /menu permanently | manual | live-UI: completed 4-step wizard, /menu reachable, reload stays on /menu (gate stops firing) | covered |
| An existing onboarded user is unaffected (no false-positive redirect) | test:lib/api/user-profile.test.ts + review-approved:adversarial-reviewer | hasUserProfile unit tests (row exists -> true) + reviewer confirmed no false-negative path in the RLS/query | covered |
| No redirect loop between (app)/ and /onboarding | review-approved:adversarial-reviewer | reviewer confirmed /onboarding is structurally outside the (app) route group, no shared layout | covered |
| Guest/anonymous sessions are not wrongly bounced | review-approved:adversarial-reviewer | reviewer traced the guest path: profile always created via upsertUserProfile before /menu is reached | covered |
| Supabase Dashboard Redirect URLs allowlist includes /onboarding | exempt:outside-repo-scope | flagged to user in PR description and defect.md — no MCP/CLI tool available this session to read/set Supabase Auth URL config | exempt |
