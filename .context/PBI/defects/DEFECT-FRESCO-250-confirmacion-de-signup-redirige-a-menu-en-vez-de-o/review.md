# Review — FRESCO-250 (PR #113)

## Adversarial review findings + adjudication

| Severity | Finding | Verdict | Action |
|---|---|---|---|
| MAJOR | Fail-open default on `hasUserProfile` reuses a fail-open pattern designed for cosmetic reads (name/plan) on a business-critical onboarding gate; reviewer's own follow-up analysis narrowed the real exposure to Next.js Client Router Cache staleness (up to its stale-time window on client-side nav within `(app)/`), self-correcting on full navigation/reload — not "skips onboarding forever" | legitimate but narrow | documented — added a code comment in `app/(app)/layout.tsx` explaining the trade-off and why fail-open still beats fail-closed here (fail-closed would bounce every already-onboarded user during a transient outage); no retry logic added — disproportionate complexity for a self-healing, bounded-window edge case |
| MINOR | `hasUserProfile` tests didn't assert the `.eq()` filter value/column, unlike the file's own established convention (`getUserNombre`'s tests do) — a wrong-column regression would pass silently | legitimate | fixed — mock now captures the `.eq()` value, two tests assert it |

No issues found in: redirect-loop safety (`/onboarding` structurally outside `(app)/` route group, no shared layout), guest/anonymous session handling (profile always created before `/menu` is reached in that path), `emailRedirectTo` scope safety (both call sites are client components, calls inside event handlers), existing-user regression risk, other route groups, fail-fast convention on `hasUserProfile` itself.

## Live-UI validation (pre-review, already done against the real reported-broken account)
- Logged in as `basi_montes+fresco@hotmail.com` (confirmed, no profile — the exact account from the bug report): landed on `/onboarding`, not `/menu`.
- Direct navigation to `/menu` while un-onboarded: redirected back to `/onboarding` (no bookmark bypass).
- Completed the 4-step wizard end-to-end → profile created → `/menu` reachable, reload stays on `/menu`.
- Verified via network inspection on a fresh signup: actual Supabase signup POST carries `redirect_to=http://localhost:3000/onboarding`.

## Verification (post-fix)
- `bun run lint:check` — clean
- `bun run types:check` — clean
- `bun test lib/api/user-profile.test.ts` — 43/43 pass
