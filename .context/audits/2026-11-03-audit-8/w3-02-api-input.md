# Audit 8, axis API (input validation and HTTP surface)

- Commit: staging 71ab0864 (prod main bc75ab81, docs-only delta). Date: 2026-11-03. Mode: read-only.

## 1. Scope
13 route handlers (app/api/**, app/auth/confirm), proxy.ts matcher, next.config.mjs + lib/security/csp.ts, 10 Edge Functions + _shared/{http,cors,timing-safe,push-endpoint}.ts, lib/legal/waitlist.ts, lib/auth/safe-next-path.ts, migration 20261019180000_waitlist_double_opt_in.sql. 8 read-only SELECTs (column grants, policies, SECURITY DEFINER search_path sweep, dynamic-SQL sweep, anon EXECUTE list, waitlist function grants, get_filtered_recipes signature, jsonb_add_item body). Production: 9 GET/HEAD/OPTIONS requests. No fresco-pre authenticated probe (Auth login needs captcha, as in A7; code-path only).
New since A7: /api/waitlist (double opt-in, IP limit), /api/waitlist/confirm, /api/auth/guest-email, readJsonBody, check_ip_rate_limit, record_consents.

## 2. Findings

### A8-API-01 - Waitlist confirmation/removal token is sent to PostHog (and Sentry) in the page URL
- Severity: LOW. Confidence: CONFIRMED by code (not executed live: needs a real token, which means a DB write + email).
- Evidence: `lib/legal/waitlist.ts` + `app/api/waitlist/route.ts` build `${origin}/lista-de-espera?token=${result.token}&accion=confirmar|baja`. `app/providers/posthog-provider.tsx:81-84` "Pageview capture stays on default (URLs only...)"; `posthog.init` (:68-85) sets only `api_host` and `autocapture:false`, no `before_send` / URL scrubbing. So after a visitor accepts analytics cookies, `$current_url` / `$pathname` carry the full 256-bit token. Sentry tracing records the same URL.
- Impact: the token is a bearer secret that confirms OR deletes that address (and `page.tsx:15` says it "travels in the query string only to this page and the POST"). Anyone with PostHog/Sentry project access can remove or confirm a signup. Small blast radius (one waitlist row), but it contradicts the stated design.
- Reproduction: open the emailed link with analytics accepted, read the `$pageview` event in PostHog. Not executed (needs a real token).
- Fix: PostHog `before_send` that strips `token` from `$current_url`/`$referrer`, plus Sentry `beforeSendTransaction` / `beforeBreadcrumb` scrub; or have the page move the token to the POST and `history.replaceState` before analytics loads. Test: unit test on the scrubber for `?token=...&accion=baja`.
- Status vs audit 7: NEW.

### A8-API-02 - update-recipe-status: a non-UUID `nueva_recipe_id` still answers 500 and pages Sentry
- Severity: LOW. Confidence: CONFIRMED by code + live signature.
- Evidence: `supabase/functions/update-recipe-status/index.ts` (step 6): `rpc('get_filtered_recipes', { p_user_id, p_recipe_id: nueva_recipe_id })`; live signature `p_user_id uuid, p_recipe_id uuid`, so `"abc"` raises 22P02, hits `if (filterError) ... throw new HttpError('Error validando la receta de sustitución', 500)`. `readJsonBody` only checks `typeof string`, there is no UUID shape check anywhere in supabase/functions (`rg uuid` finds only randomUUID). Other id fields (`meal_plan_recipe_id`, `meal_plan_id`, `shopping_list_id`) are safe: `.single()` error maps to 404.
- Impact: self-inflicted only (needs a slot you own and estado `sustituida`), but it is the exact residual A7-API-05 listed, so one authenticated user can generate Sentry 500 events at will (limit 60/h).
- Fix: in `validation.ts` add `assertUuid(nueva_recipe_id)` -> HttpError 400 before the RPC. Test: `nueva_recipe_id: "abc"` -> 400, no `captureEdgeException`.
- Status vs audit 7: STILL-OPEN (remainder of A7-API-05, which is otherwise FIXED).

### A8-API-03 - Waitlist can be used to send the confirmation email to third-party addresses (bounded)
- Severity: INFO. Confidence: CONFIRMED by code.
- Evidence: `request_waitlist_signup` mails any syntactically valid address; only guards are 5 signups/IP/hour (`SIGNUPS_PER_IP_PER_HOUR`) and one mail per address per 10 minutes. Bounded to a fixed legitimate text with a removal link; the double opt-in design accepts this. Cost is Resend quota/sender reputation (ADR-0021 Gmail/Resend caps), not data. Left as INFO, not a defect.
- Status vs audit 7: A7-API-01 FIXED (see table).

## 3. A7 findings re-verified

| A7-ID | Verdict | Evidence |
|---|---|---|
| A7-API-01 waitlist open insert | FIXED | Live `column_privileges`: no INSERT for anon/authenticated on `waitlist_signups`; `pg_policies` has no policy for it; writes only via `request_waitlist_signup` (service_role only, anon/authenticated EXECUTE false, `search_path=public, pg_temp`); route has `withinIpLimit` 5/h; double opt-in; version stamped server-side; 0 rows in table now. XFF first hop is Vercel-set. |
| A7-API-02 user_consents forged version | FIXED | Live: only policy `user_consents_select_own` (SELECT); no INSERT/UPDATE column grants for client roles; `record_consents` SECURITY DEFINER, service_role only; route uses `createServiceClient()` with `user.id` from the verified session. |
| A7-API-03 malformed shopping item | FIXED (core), grants residual tracked | Live `jsonb_add_item` now raises 22023 unless `jsonb_typeof(p_item)='object'`; `get-shopping-list-suggestions/saved-items.ts` skips malformed aisles/items. Direct INSERT/UPDATE on `shopping_lists.items`, `coste_estimado_min/max` still granted to `authenticated` (9 columns each): that is already known A7-AUTHZ-03, not re-reported. |
| A7-API-04 pro-price uncached, portal unlimited | FIXED | `pro-price/route.ts` uses `getProPriceDetail` (1 h cache); `portal/route.ts:13-14` `stripe-portal` 20/h via `check_and_increment_rate_limit`, fail closed. |
| A7-API-05 malformed body -> 500 | FIXED except non-UUID | `readJsonBody` (`_shared/http.ts`) used by 6 functions: invalid JSON, null, [] and wrong-typed fields -> 400; `generate-meal-plan` parses the body before the rate-limit increment. Residual: A8-API-02. `delete-account` keeps `.catch(()=>({}))`. |

## 4. Checklist items that found nothing
- CSP/headers: prod `/` returns enforcing nonce CSP (`frame-ancestors 'none'`, `object-src 'none'`), HSTS preload, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy; no `x-powered-by`.
- CORS (Edge): prod OPTIONS from `https://evil.com` and `http://localhost:3000` -> 200 with no `Access-Control-Allow-Origin`; from `https://fresco-pro.vercel.app` -> echoed. localhost gated by `isHostedSupabase`.
- Cron/webhook auth: `/api/cron/stripe-reconcile` unauthenticated -> 401; compared with `timingSafeEqual` (`lib/auth/timing-safe-equal`, constant over longer length), fails closed when `CRON_SECRET` unset (route.ts:90-97). Edge cron functions use `_shared/timing-safe.ts`.
- Open redirect: `/auth/confirm?next=//evil.com` -> 307 `/forgot-password?error=invalid_link`; `safeNextPath` rejects backslash, `//`, re-resolves with `new URL`. Stripe success/cancel/return URLs are `request.nextUrl.origin` + fixed path.
- SSRF: only user-influenced outbound URL is the push endpoint; allowlist regex (DB CHECK + `push-endpoint.ts`, host followed by `/`); all other fetches use fixed hosts (PostHog, Sentry, HIBP range API with fixed host).
- SQL: SECURITY DEFINER functions in `public` without a pinned `search_path`: 0 rows. Dynamic SQL (`EXECUTE`/`format(`): only `copy_meal_plan_to_week` matches `format(` (message formatting, no EXECUTE), `rls_auto_enable` (not executable by client roles). Functions executable by anon: 3 (`get_safe_ingredient_substitutes`, 2 IMMUTABLE validators, all non-definer).
- CSV export injection: `toCsvValue` unchanged; export now rate-limited 10/h.
- Zod: no zod in routes; hand parsers are strict (consent===true, email 254 + anchored regex, token `^[\w-]{43}$`, action enum). Waitlist/confirm/consents never reflect internals (fixed Spanish messages).
- Body size: no explicit limits in handlers; Vercel 4.5 MB platform cap and Supabase gateway cap apply; bodies are tiny objects. Not reported.
- Unauthenticated GET on POST-only routes -> 405; `/api/health` exposes only status words.

## 5. Could not verify
- Authenticated behaviour on fresco-pre (hosted Auth requires Turnstile captcha; no browser solve attempted). Malformed-body 400s, `guest-email` captcha/limit order and the 429 paths rest on code reading.
- Whether `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set in the production build: `guest-email/route.ts` skips the captcha when it is not (limit 3/h per guest remains). Env values not readable under the rules.
- Waitlist live flow (would write rows / send email) and the PostHog URL capture (A8-API-01) not executed.

## 6. Secrets
secrets_materialized: none
cleaned: yes
