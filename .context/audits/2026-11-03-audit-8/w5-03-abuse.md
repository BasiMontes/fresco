# Audit 8 - w5-03 - axis ABUSE
Commit 71ab0864 (staging), date 2026-11-03

## 1. Scope
- Code read: app/api/auth/guest-email/route.ts, lib/auth/turnstile-verify.ts, lib/client-api/auth.ts, app/api/waitlist/{route,confirm/route}.ts, lib/legal/waitlist.ts, lib/email/resend.ts (grep), app/api/profile/export (grep), app/api/stripe/checkout (header + trial logic), next.config.mjs images block, supabase/config.toml auth section, migration 20261019180000 (waitlist double opt-in), edge functions index heads (delete-catalog-recipe, rate-limit wiring in 9 functions).
- Read-only SELECTs via `supabase db query --linked` (9): rate_limit_endpoints, triggers on 6 tables, column/table grants of user_consents, authenticated INSERT/UPDATE grants, quota triggers, anon table grants, anon-executable functions, recipes policies/columns/count, enforce_meal_plans_quota body.
- Prod HTTP: 0 requests. No accounts, no mail.

## 2. Findings

### A8-ABUSE-01 - HIGH - PLAUSIBLE - FRESCO-1006 guards the app route, not the Supabase endpoint it wraps: a guest can still call `PUT /auth/v1/user {email}` directly (no captcha, no app limit)
- Status vs audit 7: STILL-OPEN A7-ABUSE-02 (fix covers only the path the auditor probed).
- Evidence: `app/api/auth/guest-email/route.ts:87` ends in `supabase.auth.updateUser({ email: address })` using the caller's own cookie session; the Captcha check (`:51-70`) and `check_and_increment_rate_limit` (`:73`) live only in the Next route. The guest keeps a normal supabase-js session in the browser (`lib/client-api/auth.ts:65` `createClient().auth.getUser()`, `:107` `createClient().auth.updateUser({password})` still calls Auth from the browser), so nothing stops the same token from hitting GoTrue's `PUT /auth/v1/user` directly. `lib/auth/turnstile-verify.ts:4-8` itself states Supabase does not enforce captcha on `updateUser({ email })`. `supabase/config.toml:242` `max_frequency = "1s"`, `:211` `email_sent = 2` are local values only; hosted values unreadable.
- Impact: attacker needs one captcha-solved anonymous session (30/h/IP local default) and then mails any address from the app's sender, multiplying across sessions, and drains the project-wide hourly Auth email quota shared by dev/pre/pro (password reset and signup codes blocked for real users). The route's 3/h per guest (`guest-email/route.ts:9`) is keyed on `user.id`, which a disposable guest rotates.
- Reproduction (not executed, sends mail): anon sign-in with captcha, then `PUT {SUPABASE_URL}/auth/v1/user` with the access token and `{"email":"victim@example.com"}`; repeat with new addresses.
- Fix: enforce at the Auth layer, since the route cannot: (a) hosted Auth "Send Email" hook (or equivalent) that calls `check_and_increment_rate_limit`-style per-user + per-IP-hash counters before any mail; (b) set hosted minimum interval between emails >= 60 s and the lowest acceptable `email_sent`; (c) record both in docs. Test: a prod-like e2e that a tokenless direct `PUT /auth/v1/user` for a guest is refused/limited (cannot be a unit test).

### A8-ABUSE-02 - MEDIUM - PLAUSIBLE - `/api/waitlist` has no captcha: one request = one DB row + one Resend send to any address, limit is only 5/IP/hour
- Status vs audit 7: NEW (A7 waitlist items C-21/A7-PRIV-03 were about unbounded insert; FRESCO-1008 added double opt-in and IP limit but no bot check).
- Evidence: `app/api/waitlist/route.ts:37` `withinIpLimit(..., limit: 5)` is the only abuse control; no Turnstile call in the route (`rg turnstile|captcha` finds nothing in `app/api/waitlist` or `lib/legal/waitlist.ts`). Per-address dedupe is 10 min (`20261019180000...sql:106`), so every DISTINCT victim address gets a mail. `lib/legal/waitlist.ts:106` keys on `x-forwarded-for` first hop (Vercel overwrites it, so not spoofable, but botnets/IPv6 /64 rotation defeat 5/h). `lib/email/resend.ts:19` sender is `onboarding@resend.dev`; the same Resend key also sends the Stripe subscription confirmation (`lib/billing/grant-pro.ts`), so quota exhaustion on waitlist mail also blocks paid-customer mail. Rows are purged after 7 days (cron), so DB growth is bounded.
- Impact: third-party spam from the app's sender; burns the shared Resend free quota (daily/monthly cap, plan unreadable). Note: with an unverified domain Resend normally only delivers to the account owner, so for foreign addresses the send returns an error (route -> 502), which limits the spam but still spends API calls and makes the waitlist unusable (FRESCO-886 context).
- Reproduction: not executed (would send mail).
- Fix: require a Turnstile token server-side on `POST /api/waitlist` (reuse `verifyTurnstileToken`, same 400/503 semantics as guest-email), plus a global per-hour cap via `check_ip_rate_limit` with a constant key. Test: route test that missing/invalid token -> 400 and no `request_waitlist_signup` call.

### A8-ABUSE-03 - LOW - CONFIRMED - Waitlist mail failure leaves the row "throttled": the retry answers 200 "pending" and sends nothing for 10 minutes
- Status vs audit 7: NEW.
- Evidence: `request_waitlist_signup` sets `confirmation_sent_at = now()` at insert/update (`20261019180000...sql:95,111`) before the mail is sent; when `sendWaitlistConfirmationEmail` throws, the route returns 502 (`route.ts:61-64`) without clearing it. The user's retry hits `confirmation_sent_at > now() - interval '10 minutes'` -> `'throttled'` -> route returns `{ pending: true }` (`route.ts:67`) with no email. After 7 days the unconfirmed row is purged.
- Impact: a real visitor hit by a transient Resend error (or the unverified-domain refusal) is told to wait for an email that was never sent. Also lets an attacker "burn" a victim address for 10 minutes.
- Fix: on send failure reset `confirmation_sent_at` (new RPC or update by token hash). Test: route test with a throwing sender followed by a second call that must send.

### A8-ABUSE-04 - LOW - CONFIRMED - Image optimizer narrowed but still open to every Unsplash `/photo-*` and Pexels `/photos/**` URL with any query string
- Status vs audit 7: PARTIAL FIX of A7-ABUSE-01 (FRESCO-1017).
- Evidence: `next.config.mjs:77-81` patterns `/photo-*`, `/flagged/photo-*`, `/photos/**`, `search` unset (comment at `:73-75` explains why); `deviceSizes: [640,828,1080,1920]`, `imageSizes: [48,96,256,384]`, `qualities: [75]`, `minimumCacheTTL: 2678400` (`:87-92`). Pre-fix probe in A7 showed upstream is fetched for accepted patterns.
- Impact: attacker supplies real foreign photo ids (millions) x 8 widths x 2 formats, or cache-busts with `?x=N` on one id (each distinct URL is a new source fetch + transformation). Cost bounded per request far better than before, but the Vercel image quota is still attackable. Hobby limits unknown (no Vercel read).
- Fix: allow only the ids actually used (generate the `pathname` list from `recipes.foto_url` at build) or mirror photos to the Supabase bucket and allow only that pathname; add `search: ''`-compatible normalisation by storing URLs without query. Test: config test that no pattern ends in a bare wildcard.

### A8-ABUSE-05 - INFO - STILL-OPEN (already known C-22 / FRESCO-923) - Card-less 7-day trial is once per ACCOUNT, not per person
- Evidence: `app/api/stripe/checkout/route.ts:38-46,161` `trialAlreadyUsed = !isTrialAvailable(profile)` keyed on the profile's Stripe customer/subscription id; a new email (or plus-address, or delete-account then re-signup) is a new profile. Anonymous guests are blocked (`:84`), and checkout is 10/h (`:113`). Not re-reported beyond status.

## 3. A7 findings re-verified
| A7-ID | Verdict | Evidence |
|---|---|---|
| A7-ABUSE-01 image optimizer | PARTIAL (see A8-ABUSE-04) | `next.config.mjs:76-92` pathnames + short size lists + qualities [75] + TTL; residual wildcard ids |
| A7-ABUSE-02 guest email mail | STILL-OPEN (A8-ABUSE-01) | route added (`app/api/auth/guest-email/route.ts`), direct Auth endpoint untouched; hosted limits unreadable |
| A7-ABUSE-03 user_consents unlimited rows | FIXED | live: `authenticated` has SELECT only on `user_consents` (table and 5 columns); writes via server function (migration 20261019150000) |
| A7-ABUSE-04 meal_plans no cap / export | FIXED | live `enforce_meal_plans_quota`: advisory lock + `>= 104` -> check_violation; trigger `meal_plans_enforce_quota BEFORE INSERT`; `profile-export` registered 10/h and used in `app/api/profile/export/route.ts:7,49` |
| A7-ABUSE-05 edge fns without limit | FIXED | `rate_limit_endpoints` now has generate-shopping-list 60, get-shopping-list-suggestions 120, profile-export 10, guest-email-change 3; both functions call `enforceRateLimit`. `delete-catalog-recipe` has no limit but `requireAdminUser` gates it |
| A7-ABUSE-06 force-dynamic + health | UNCHANGED, accepted | `app/layout.tsx:137` still force-dynamic; `/api/health` still `no-store` (`route.ts:29`); ADR-0030/0031 tradeoff |
Consolidated ABUSE rows: C-21 waitlist (insert now service-role only, see A8-ABUSE-02/03 for the residue), C-22 trial (A8-ABUSE-05), C-26 captcha switch (cannot verify hosted).

## 4. Checklist items that found nothing
- Anonymous direct writes: authenticated INSERT/UPDATE only on favorites, push_subscriptions, recetas_propias, shopping_lists, user_profiles; quota triggers exist for favorites, push_subscriptions, recetas_propias, meal_plans (shopping_lists is per plan, so bounded by 104 and the 100 KB check; user_profiles one row per user).
- Anon-executable functions: only 3 pure helpers (`get_safe_ingredient_substitutes`, `recipe_ingredient_names_distinct`, `recipe_ingredient_quantities_valid`), none SECURITY DEFINER. `get_catalog` is SECURITY DEFINER but not executable by anon and enforces caller-owned profile.
- Catalogue scraping: anon can SELECT 1287 `recipes` rows (incl. `pasos_resumen`, `ingredientes_cantidades`) and `ingredient_substitutions` directly, 1000 rows/page (`max_rows = 1000`). Public by policy ("Recetas públicas para lectura"), no Pro-only column exists on `recipes`; not reported as leakage.
- Edge limiter design unchanged (atomic RPC, fail closed); generate-meal-plan 5/h/user.
- Stripe checkout: auth + non-anonymous + 10/h; no promo-code input.
- Waitlist confirm: 256-bit token, POST only, 30/IP/h.
- Referral/coupon: none exist.

## 5. Could not verify
- Hosted Auth: email rate limit, minimum interval, SMTP sender, captcha enforcement per endpoint, anonymous sign-ins per IP (no dashboard/management API in scope). Decides the true severity of A8-ABUSE-01.
- Whether `TURNSTILE_SECRET_KEY` is set in Vercel prod (guest-email fails closed with 503 if not; `.env.example` read was denied by tooling).
- Resend plan/quota and whether the account has a verified sender; Vercel image-optimization usage and plan.
- Sign-up/reset enumeration: not tested live (would send mail). By design Supabase returns `email_exists`; `guest-email/route.ts:89` passes it through to a guest (3/h/guest), same oracle as signup. Treated as accepted.

## 6. Hygiene
secrets_materialized: none
cleaned: yes
