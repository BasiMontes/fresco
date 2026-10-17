# Audit 7 - wave 4 - axis ABUSE (cost abuse / resource exhaustion)
Commit 1feb6062 (staging, == prod main 278d56fd), date 2026-10-17

## 1. Scope inspected
- Code: `supabase/functions/_shared/rate-limit.ts`, `generate-meal-plan/{index,rate-limit}.ts`, `get-shopping-list-suggestions`, `generate-shopping-list`, `delete-catalog-recipe`, `retry-posthog-erasures`/`send-weekly-reengagement-push` (auth head), `app/api/{stripe/checkout,stripe/webhook,waitlist,consents,health,health/jobs,profile/export,cron/stripe-reconcile}`, `next.config.mjs`, `proxy.ts`, `vercel.json`, `app/layout.tsx`, `lib/client-api/auth.ts`, `lib/auth/captcha.ts`, `lib/legal/waitlist.ts`, `supabase/config.toml`, migrations rate_limits + exempt users + waitlist.
- DB (SELECT only, 7 queries via `supabase db query --linked`): rate_limit_endpoints, public tables/triggers/grants, constraints on meal_plans/shopping_lists/user_consents, user_consents policies, waitlist count.
- Prod HTTP: 3 requests (2 HEAD `/_next/image`, 1 GET `/signup`). No mutations, no email, no load.
- Prior audits read: wave 1-3 (w1-01, w1-02, w2-01, w2-02), 2026-10-12 definitive C-21/C-22/C-26, docs/workflows/observability.md.
- Finding: there is NO paid LLM / photo API / Resend call on any request path. Edge functions call only PostHog/Sentry (fire-and-forget) and Stripe (billing). Menu generation is in-DB/in-Deno algorithm. Resend is used only in `lib/billing/grant-pro.ts` (subscription confirmation, webhook-triggered).

## 2. Findings

### A7-ABUSE-01 - MEDIUM - CONFIRMED - `/_next/image` is an open optimizer for ANY path on images.unsplash.com and images.pexels.com
- Evidence: `next.config.mjs:72-77` `remotePatterns: [{protocol:'https',hostname:'images.unsplash.com'},{...'images.pexels.com'}]` (no `pathname`, no `search`), no `images.qualities/localPatterns/minimumCacheTTL/deviceSizes` override (only `formats: ['image/avif','image/webp']`, line 84). Prod probe: `HEAD https://fresco-pro.vercel.app/_next/image?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-0000000000000-nonexistent&w=640&q=75` -> `404` (host accepted, upstream fetched); same with `https://example.com/a.jpg` -> `400` (host rejected). Probe used a nonexistent path, so no transformation was billed.
- Impact: anyone can drive the Vercel Image Optimization quota (source images + transformations, AVIF/WebP, every distinct url x width is a new billable transformation) with arbitrary images from two huge public libraries, and use fresco-pro as a free image proxy. On Hobby plan this exhausts the monthly transformation cap and can disable optimization / bill overage for real users. ADR/memory show the project is already hitting Vercel caps (Functions Storage 10 GB, 100 deploys/day).
- Reproduction (not executed, would burn quota): loop `GET /_next/image?url=https://images.unsplash.com/photo-<distinct id>&w=<each of deviceSizes>&q=75` with `Accept: image/avif`.
- Fix: restrict `pathname` to the actual recipe-photo paths (or serve photos from the `recipe-photos` Supabase bucket with a `hostname`+`/storage/v1/object/public/recipe-photos/**` pattern), set `images.qualities: [75]`, a short `deviceSizes`/`imageSizes` list, and `minimumCacheTTL`. Test: unit test that parses `next.config.mjs` and asserts every `remotePatterns` entry has a non-wildcard `pathname`.

### A7-ABUSE-02 - HIGH - PLAUSIBLE - Guest-to-account email step (`updateUser({email})`) mails arbitrary third parties with no captcha and no app-level limit
- Evidence: `lib/client-api/auth.ts:72-74` `requestEmailChange(email)` = `createClient().auth.updateUser({ email })` (no `captchaOptions`; every other mail-sending call at `:42,:54,:91,:110,:115` passes `captchaToken`). `components/signup/use-signup-otp.ts:102` calls it for the progressive-signup step 1 and as "resend". Local `supabase/config.toml:242` `max_frequency = "1s"` (hosted value unreadable). Supabase Auth's captcha covers signup/sign-in/anonymous/recover/OTP/resend, not `PUT /auth/v1/user`; w2-02 confirms hosted captcha rejects tokenless sign-in (`captcha_failed`), which only gates obtaining the session. Mail goes through the Gmail SMTP sender (ADR-0021:22), which has no owned domain and "likely to trip Gmail's sending limits" (ADR-0021:90).
- Impact: one captcha-solved guest session can ask Supabase to send the confirmation code to ANY address (victim spam/flood, from the app's Gmail identity, burning its reputation), repeatable per session at the per-user email frequency; many sessions multiply it. It also drains the project-wide hourly auth-email quota (shared by dev/pre/pro), blocking legitimate signups and password resets (denial of service on the funnel).
- Reproduction (not executed, would send email): obtain an anonymous session (captcha once), then `PUT {SUPABASE_URL}/auth/v1/user` with `{"email":"victim@example.com"}` repeatedly (new email each cycle defeats per-address dedupe), observe mails to victim. Verify safely by reading hosted Auth settings (Rate limits "emails sent", "Minimum interval between emails", SMTP) in the dashboard.
- Fix: (a) set hosted "Minimum interval between emails" >= 60 s and email rate limit to the lowest acceptable value; (b) move step 1 behind a server route/Edge function that requires a Turnstile token (verify server-side) and `check_and_increment_rate_limit` per user + per IP hash before calling the admin-less `updateUser`; (c) move to Resend with owned domain (blocked by no-spending rule, FRESCO-886). Test: route test that missing/invalid captcha -> 400 and 4th call in an hour -> 429.

### A7-ABUSE-03 - MEDIUM - CONFIRMED - `user_consents` accepts unlimited rows per user via direct PostgREST (no quota, no rate limit)
- Evidence: live constraints: `UNIQUE (user_id, kind, version)`, `version` check `length between 1 and 60` (any string), `kind` 5 values; policy `user_consents_insert_own` WITH CHECK `user_id = auth.uid()`; `grant insert (kind, version)` to authenticated (w1-01:66); zero triggers on the table (trigger query returned none for it, while `favorites`, `recetas_propias`, `push_subscriptions` have quota triggers). The route `app/api/consents/route.ts:12` claims the version is the server's, but PostgREST bypasses it.
- Impact: any account, including a throwaway guest, can insert millions of distinct-version rows (5 kinds x 60-char free text), growing the DB (Supabase Free 500 MB cap shared by all envs), slowing the export, and polluting the append-only legal consent evidence with fake versions. PostgREST itself has no rate limit.
- Reproduction (not executed): `POST /rest/v1/user_consents {"kind":"terms","version":"<random>"}` in a loop with a user JWT.
- Fix: BEFORE INSERT trigger enforcing `version = ANY(known versions)` or a per-user cap (e.g. <= 50 rows), mirroring `enforce_favorites_quota`. Test: db test in `tests/db/client-write-quotas.test.ts` (51st row rejected, unknown version rejected).

### A7-ABUSE-04 - LOW - CONFIRMED - `meal_plans` has no per-user cap; any year is a valid week, and export is unpaginated
- Evidence: constraints `meal_plans_semana_iso_valida CHECK (semana_iso ~ '^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$')`, `UNIQUE (user_id, semana_iso)` (live). Years 0000-9999 x 53 weeks = ~530k distinct weeks per user; no trigger limits count (`meal_plans` has 1 trigger, not a quota). `generate-meal-plan` allows 5/h (`rate_limit_endpoints`), i.e. 120 plans/day/account, each with 21 `meal_plan_recipes` rows and a possible `shopping_lists` row up to 100000 bytes (`shopping_lists_items_bounds`). DELETE grant exists so the weekly limit does not cap it. `app/api/profile/export/route.ts` reads all rows via `readUserDataForExport` with no limit, and has no rate limit.
- Impact: slow DB growth per account (~2.5k rows/day, up to ~12 MB/day of lists) multiplied by free accounts; a large account makes `/api/profile/export` slow or time out (function default duration).
- Reproduction: not executed (would write). Reasoning only.
- Fix: BEFORE INSERT trigger on `meal_plans` capping rows per user (e.g. 60) or constrain `semana_iso` to current year +-1 inside `create_meal_plan`; add a rate limit endpoint for `profile-export`. Test: db test that the 61st plan is rejected.

### A7-ABUSE-05 - LOW - CONFIRMED - Authenticated Edge functions without any rate limit
- Evidence: `generate-shopping-list/index.ts:38`, `get-shopping-list-suggestions/index.ts:46`, `delete-catalog-recipe/index.ts:29` call only `requireAuthenticatedUser` (no `enforceRateLimit`); `rate_limit_endpoints` registry lists only generate-meal-plan, update-recipe-status, reassign-guest-data, delete-account, stripe-checkout, swap_meal_plan_slots, assign_recipe_to_slot. `requireAuthenticatedUser` accepts anonymous guests. get-shopping-list-suggestions reads all of a user's favorites (up to 1000, each joining recipes) per call.
- Impact: a single guest/free user can loop these endpoints and burn Supabase Edge invocation quota and DB CPU shared by all environments; bounded per call but unbounded in rate. No third-party cost.
- Reproduction: not executed (load). Reasoning only.
- Fix: register the two endpoints in `rate_limit_endpoints` and call `enforceRateLimit` (e.g. 60/h and 120/h). Test: extend `tests/db/edge-functions/*` for 429.

### A7-ABUSE-06 - LOW - CONFIRMED - Every page is a dynamic serverless render (no CDN cache) and public health routes hit Supabase per request
- Evidence: `app/layout.tsx:133` `export const dynamic = 'force-dynamic'` (FRESCO-386 nonce CSP tradeoff, documented), so `app/page.tsx:20` `revalidate = 3600` is moot. `/api/health` (`app/api/health/route.ts:15`, `lib/health/check-health.ts:35`) does a Supabase `rest/v1/recipes` request on each unauthenticated GET, `Cache-Control: no-store`; `/api/health/jobs` does a service-role read each GET. Error paths `console.error` per hit.
- Impact: cheap request floods on the landing or health endpoints consume Vercel function invocations/CPU and Supabase requests 1:1 (no edge absorption). Landing is the public marketing page ahead of launch.
- Reproduction: not executed. Reasoning only.
- Fix: put the Vercel Firewall rate limit / Attack Challenge on `/api/health*` and `/`, or cache health for 15-30 s (`s-maxage`). Already partly accepted tradeoff; mark as risk.

### Already known (not re-reported)
- Waitlist unbounded anon insert: C-21, A7-PRIV-03 / w2-02 (also direct PostgREST bypass).
- Trial re-use via new/alias emails: C-22 / FRESCO-923, w1-02:110.
- Hosted captcha switch unverified server-side + `NEXT_PUBLIC_TURNSTILE_SECRET_KEY`: C-26 / FRESCO-907 (w2-02 observed `captcha_failed` on hosted, which lowers urgency).

## 3. Checklist items that found nothing
1. Paid upstreams: none exist on request paths (no LLM/photo API/Resend per user action). generate-meal-plan: auth + 5/h/user atomic RPC, Pro/free same limit, 409 on existing week. Stripe checkout: auth, non-anonymous, 10/h, once-per-account trial, no customer enumeration.
2. Limiter design is sound: Postgres atomic upsert (no race), keyed on `auth.uid()` (RPC rejects other ids), fail-closed (`assertRateLimitAllowed`, RPC error -> 500), endpoint whitelist + clamped `p_limit`, `rate_limit_exempt_users` emptied of prod accounts (migration 20260901140000). Weakness is only that there is no IP/global limiter (see ABUSE-02, -05).
3. Email: no unauthenticated endpoint sends mail; Resend only on Stripe webhook; password reset/resend/signup carry Turnstile tokens client-side (hosted enforcement per C-26). Only gap is ABUSE-02.
4. Checkout spam: not unauthenticated. Coupon enumeration: no coupon/promo input exists (`rg` of checkout route: no `allow_promotion_codes`).
5. Storage: `recetas_propias` 200 + size caps, favorites 1000, push cap trigger, `shopping_lists` 100 KB cap, bucket `recipe-photos` write only service_role, no user uploads. Gaps: ABUSE-03/-04.
6. Image optimizer open host (ABUSE-01); no maxDuration except webhook (60); cron route uses `timingSafeEqual` on `CRON_SECRET` and fails closed when unset (`app/api/cron/stripe-reconcile/route.ts:74-81`); `/ingest` rewrites are public by design (PostHog key is public); sitemap/OG image are static-ish (no DB query in `app/sitemap.ts`/`opengraph-image.tsx`).
7. Stripe webhook: raw-body `constructEvent` signature verify (400 on bad), event-id claim table with `already_done`/`in_flight`/TTL takeover = replay-safe; service-role Edge functions (`retry-posthog-erasures`, `send-weekly-reengagement-push`) use `requireServiceRoleCaller`.

## 4. Could not verify
- Hosted Supabase Auth settings (email rate limit, min interval between emails, captcha enforcement, anonymous sign-in per-IP limit, SMTP): not readable without dashboard/management API; `config.toml` values are local only and `[auth.captcha]` is commented out.
- Vercel plan limits, Firewall rules and image-optimization usage (no Vercel read performed).
- Behavior of GoTrue `PUT /user` under captcha (based on documented captcha scope + client code, not a live call, to avoid sending email).
- Edge function invocation/DB capacity ceilings.

## 5. Hygiene
secrets_materialized: none
cleaned: yes
