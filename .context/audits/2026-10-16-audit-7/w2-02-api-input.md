# Audit 7, wave 2, axis API: input validation and injection

- Axis code: API
- Commit: staging `1feb6062` (code identical to production `main` `278d56fd`)
- Date: 2026-10-16
- Mode: read-only

## 1. Scope and what was inspected

Entry points inventoried (checklist item 1):

| Entry point | Method | Auth | Body validation | Size limit | Rate limit |
|---|---|---|---|---|---|
| `/api/waitlist` | POST | none (anon insert) | hand parser `parseWaitlistBody` (strict: consent===true, email regex, 254) | email 254 | none (A7-API-01) |
| `/api/consents` | POST | session (guest ok) | `parseConsentKinds` | n/a | none (bounded by unique `(user_id,kind,version)`) |
| `/api/profile/export` | GET | session | none needed | per-user rows | none (read, RLS + `.eq(user_id)`) |
| `/api/stripe/checkout` | POST | registered | `request.json().catch(()=>null)` + interval parse | n/a | yes, per user |
| `/api/stripe/portal` | POST | registered + customer id | none needed | n/a | none (A7-API-04) |
| `/api/stripe/pro-price` | GET | registered | `parseProInterval` | n/a | none, uncached Stripe call (A7-API-04) |
| `/api/stripe/webhook` | POST | Stripe signature | Stripe SDK | n/a | n/a (payments axis) |
| `/api/cron/stripe-reconcile` | GET | `Bearer CRON_SECRET`, timing-safe | n/a | n/a | n/a |
| `/api/health`, `/api/health/jobs` | GET | none | n/a | n/a | none (only status words) |
| `/auth/confirm` | GET | token_hash | `safeNextPath` on `next` | n/a | Supabase-side only |
| `proxy.ts` | all | session refresh + admin 404 | n/a | n/a | n/a |
| Server actions | - | - | none exist (`rg "use server"` = 0 files) | - | - |
| EF `generate-meal-plan` | POST | JWT | truthiness only; SQL `create_meal_plan` validates week/Monday (C-09 fixed) | none | 5/h per user (before body parse) |
| EF `update-recipe-status` | POST | JWT + ownership | whitelist estado, int rating; ids unchecked | none | 60/h |
| EF `generate-shopping-list` | POST | JWT + `.eq(user_id)` | truthiness only | none | none (bounded by `unique_plan_lista`) |
| EF `get-shopping-list-suggestions` | POST | JWT + `.eq(user_id)` | truthiness only | none | none (read) |
| EF `reassign-guest-data` | POST | guest JWT + fresh target JWT | truthiness | none | 5/h |
| EF `delete-account` | POST | JWT + recent token | `.catch` parse | none | yes |
| EF `delete-catalog-recipe` | POST | JWT + admin allowlist | truthiness | none | none (admin) |
| EF `retry-posthog-erasures`, `send-weekly-reengagement-push` | POST | service key, timing-safe | n/a | n/a | n/a |
| Client RPCs (18 executable by anon/authenticated, live `pg_proc`) | PostgREST | JWT / RLS | per function | per table CHECKs | `check_and_increment_rate_limit` owner-checked + clamped |

Inspected: 11 route handlers, `proxy.ts`, 9 Edge Functions + `_shared/{http,auth,rate-limit,token-recency,push-endpoint,normalize,logger}.ts`, `lib/legal/waitlist.ts`, `lib/csv/export-csv.ts`, `lib/api/{profile-export,admin-recipes}.ts`, `lib/auth/safe-next-path.ts`, `lib/seo/structured-data.ts`, `lib/billing/pro-prices.ts`, 2 migrations. 9 read-only `supabase db query --linked` SELECTs (column grants, policies/constraints/triggers on shopping_lists, user_consents, waitlist_signups, user_profiles, recetas_propias, push_subscriptions, favorites, meal_plan_recipes; executable RPC list; 5 RPC bodies). Production: 8 GET/OPTIONS requests. fresco-pre: 1 password-grant login attempt (rejected: captcha) and 5 function calls that returned 401 because of it.

## 2. Findings

### A7-API-01 - Waitlist accepts any third party's address, unlimited and unconfirmed, through a public endpoint and straight through PostgREST
- Severity: MEDIUM. Confidence: CONFIRMED (code + live grants/policy read; no insert executed).
- Evidence: `app/api/waitlist/route.ts:15-36`: no session, no rate limit, no captcha, no confirmation email; it calls `addToWaitlist` which inserts as `anon` (`lib/legal/waitlist.ts:54-57`). Live policy `waitlist_signups_insert` WITH CHECK `true`; migration `20261011140000_waitlist_signups.sql`: `grant insert (email, consent_version) on table public.waitlist_signups to anon, authenticated`. So the anon key (public, shipped in the bundle) can `POST /rest/v1/waitlist_signups` directly, bypassing the route's parser AND its "version is the server's" promise (`route.ts:12`): `consent_version` is any 1-60 char string (`waitlist_signups_consent_version_check`). Duplicates are silently 200 (`lib/legal/waitlist.ts:59`), so a script gets no back-pressure.
- Impact: anyone can fill the launch list with addresses of people who never asked (or with forged consent versions); when the launch email goes out, Fresco mails non-consenting people (LSSI art. 21 / GDPR art. 7: the controller must be able to prove consent, and nothing here proves the address owner gave it). Also an unbounded table writable by the anonymous internet.
- Reproduction: not executed (would write a row to the shared DB). Would be: `curl -X POST $SUPABASE_URL/rest/v1/waitlist_signups -H "apikey: <anon>" -H "Content-Type: application/json" -d '{"email":"victim@example.com","consent_version":"anything"}'` -> 201; or loop `POST https://fresco-pre.vercel.app/api/waitlist` with `{"email":"<n>@example.com","consent":true}` -> 200 each.
- Fix: revoke the anon table grant and insert through a SECURITY DEFINER RPC (or service client in the route) that stamps the version server-side; add a per-IP limit to the route (Vercel/Upstash or a `rate_limit`-style table keyed on IP hash) plus Turnstile (already used at sign-up); store as `pending` and send a double-opt-in email, mailing only confirmed rows at launch. Test: anon PostgREST insert -> 401/42501; route test: 6th request from one IP in an hour -> 429; launch-mailer test selects only `confirmed_at is not null`.

### A7-API-02 - Consent register: a user can record any consent version directly, contradicting the server-stamped-version guarantee
- Severity: LOW. Confidence: CONFIRMED (live grants + policy + constraints).
- Evidence: `app/api/consents/route.ts:12-15`: "The version of the text is NOT taken from the body ... so a client cannot claim to have accepted a version it was never shown". Live `information_schema.column_privileges`: `authenticated` INSERT on `user_consents(kind,version)`; policy `user_consents_insert_own` WITH CHECK `(user_id = auth.uid())`; only constraints are `kind` in 5 values and `length(version) between 1 and 60`. Server version is `lib/legal/consent.ts:19` `'provisional-2026-10-06'`.
- Impact: the Art. 9 `health_data` / `withdrawal_waiver` evidence rows can carry versions the user never saw (e.g. a future version, so a later re-consent flow that checks "row exists for current version" would be pre-satisfied). Self-only, but it weakens the register the controller relies on to prove consent, and the code comment states a guarantee the database does not enforce.
- Reproduction: not executed (write). `POST /rest/v1/user_consents` with a user JWT, body `{"kind":"health_data","version":"2099-01-01"}` -> 201 per grant/policy.
- Fix: `revoke insert on user_consents from authenticated`; record through a SECURITY DEFINER `record_consents(p_kinds text[])` that writes `version := <server constant>` (or a CHECK/trigger pinning `version` to the current published version table). Test: direct PostgREST insert -> 42501; RPC inserts rows with the current version only.

### A7-API-03 - Shopping-list items have no server-side shape; a malformed item makes the list suggestions endpoint answer 500
- Severity: LOW. Confidence: CONFIRMED by code (live call not possible, see section 4).
- Evidence: `jsonb_add_item(p_list_id uuid, p_pasillo_nombre text, p_item jsonb)` (live `pg_get_functiondef`, SECURITY DEFINER, executable by `authenticated`) appends `p_item` verbatim: `(v_items->v_idx->'items') || jsonb_build_array(p_item)`; `authenticated` also has INSERT/UPDATE on every `shopping_lists` column incl. `items`, `coste_estimado_min/max`; the only check is `shopping_lists_items_bounds` (`jsonb_typeof(items)='array' and octet_length <= 100000`). `supabase/functions/get-shopping-list-suggestions/index.ts`: `list.items.flatMap(pasillo => pasillo.items.map(item => normalizeNombre(item.nombre)))` and `_shared/normalize.ts:2-4` calls `nombre.toLowerCase()`: an item without a string `nombre` (or a pasillo without `items`) throws TypeError -> `toErrorResponse` -> 500 + Sentry event.
- Impact: self-only (RLS keeps it to the caller's list), but one bad item (client bug, old client, or hand-crafted call) permanently breaks suggestions for that list and pollutes Sentry; cost fields shown in the UI are client-writable.
- Reproduction: `rpc('jsonb_add_item', {p_list_id: <own list>, p_pasillo_nombre: 'Otros', p_item: 42})`, then invoke `get-shopping-list-suggestions` with that list -> 500 (not executed: write).
- Fix: validate `p_item` in the RPC (`jsonb_typeof(p_item)='object' and jsonb_typeof(p_item->'nombre')='string' and length <= 120`), revoke direct UPDATE of `items`/cost columns (writes already go through RPCs), and make the suggestions loop skip non-string names. Test: RPC with `p_item: 42` raises 22023; suggestions with a malformed stored item returns 200.

### A7-API-04 - `GET /api/stripe/pro-price` calls Stripe on every request with no cache and no limit: one free account can exhaust the shared Stripe API rate limit and stall everyone's checkout
- Severity: MEDIUM. Confidence: PLAUSIBLE (code CONFIRMED; not load-tested, the brief forbids load).
- Evidence: `app/api/stripe/pro-price/route.ts:22-52`: gate is only "signed in and not anonymous", then `const price = await stripe.prices.retrieve(priceId);` on every GET; no `check_and_increment_rate_limit` (compare `app/api/stripe/checkout/route.ts:71` which has one) and no cache. The same data is already cached for the public pages: `lib/billing/pro-prices.ts:1,10-11` `unstable_cache`, "spares Stripe a read per visit". `app/api/stripe/portal/route.ts:57` (`billingPortal.sessions.create`, Pro users only) is also unlimited.
- Impact: Stripe throttles per account (sandbox ~25 req/s, live ~100 req/s, shared by every call the app makes). A script on one free registered account looping this GET (each request is also a billable Vercel function invocation) makes Stripe answer 429 to the real users' `checkout.sessions.create`, the webhook's Stripe reads and the reconcile cron for as long as it runs: payments down with no cost to the attacker.
- Reproduction: not executed (load). Would be: sign in as any registered user on fresco-pre, `for i in $(seq 1 3000); do curl -s -o /dev/null -b <cookies> 'https://fresco-pre.vercel.app/api/stripe/pro-price' & done`, while another user starts checkout -> `/api/stripe/checkout` 500 "No se pudo iniciar el pago." with Stripe `rate_limit` in logs.
- Fix: serve the route from `readProPrices()` (already `unstable_cache`d 1 h) instead of a live `prices.retrieve`; add the per-user `check_and_increment_rate_limit` (as checkout does) to `/api/stripe/portal`. Test: unit test that N calls to the route call `stripe.prices.retrieve` at most once per cache window; portal route returns 429 after the limit.

### A7-API-05 - Edge Functions answer 500 (and page Sentry) to a malformed body; `generate-meal-plan` burns one of the 5 hourly generations before reading the body
- Severity: LOW. Confidence: CONFIRMED by code (live call blocked by captcha on login, see section 4).
- Evidence: unguarded `await req.json()` in `generate-meal-plan/index.ts:64`, `update-recipe-status/index.ts:51`, `generate-shopping-list/index.ts:41`, `get-shopping-list-suggestions/index.ts:48`, `reassign-guest-data/index.ts:56`, `delete-catalog-recipe/index.ts:35` (only `delete-account/index.ts:90` uses `.catch(() => ({}))`). A `SyntaxError` is not an `HttpError`, so `_shared/http.ts` `toErrorResponse` logs, calls `captureEdgeException` and returns 500 "Error interno del servidor". A JSON `null` body hits `body.meal_plan_id` / `body.shopping_list_id` -> TypeError -> 500. A non-UUID `nueva_recipe_id` reaches `get_filtered_recipes` and comes back as `filterError` -> 500 (`update-recipe-status/index.ts`, "Error validando la receta de sustitución"). None of the bodies are schema-validated (no zod; fields are only truthiness-checked, e.g. `if (!semana_iso || !fecha_inicio)`). In `generate-meal-plan` the rate-limit RPC (`:54`, limit 5/3600 s) runs before the body is parsed, so a client bug that sends a bad body locks the user out of generating for an hour.
- Impact: bad input is reported as a server failure (wrong status for clients, false alarms and quota use in Sentry, which an authenticated user can trigger at will on functions without a rate limit); users can lose their hourly generations to malformed requests.
- Reproduction: `POST /functions/v1/generate-shopping-list` with a valid user JWT and body `{not json` -> 500 `{"error":"Error interno del servidor"}` per code path.
- Fix: one shared `readJsonBody(req, schema)` in `_shared/http.ts` that maps parse/validation errors to `HttpError(400)` (zod or a hand-written guard: strings, UUID regex, enums); parse and validate before the rate-limit increment. Test: `http.test.ts` cases for `{not json`, `null`, `[]`, `{"meal_plan_id":{}}` -> 400 and no Sentry call.

Already known, not re-reported: `copy_meal_plan_to_week` allergen filter (A7-AUTHZ-01); global counters / unlimited week-copy (A7-AUTHZ-02); `/update-password` (A7-AUTHZ-05); client-writable slot `dia`/`tipo_plato`/plan columns (A7-AUTHZ-03); anon EXECUTE on the two substitution RPCs (A7-AUTHZ-04); Stripe double session / livemode (A7-PAY-01/02). Accepted risk, not re-reported: `delete-account` "recent re-auth" is `iat` recency, which a token refresh also satisfies (written down in ADR-0023 Consequences).

## 3. Checklist items that found nothing

- (2) Validation depth on the DB side: `user_profiles` has text/list/jsonb bounds and numeric CHECKs (`num_personas`/`adultos`/`ninos` <= 10, > 0; `presupuesto_semana_euros` numeric(6,2) > 0; times smallint > 0); `recetas_propias` count + byte bounds; `push_subscriptions` endpoint allowlist + key formats + per-user cap trigger; `shopping_lists.items` array <= 100 kB; `meal_plan_recipes.rating` 1-5. C-10 (no size limits on `user_profiles`) is fixed. Week/date edges: `create_meal_plan` rejects bad ISO weeks and a `fecha_inicio` that is not that week's Monday (C-09 fixed). No prototype-pollution sink (no deep merge of request bodies anywhere). Mass assignment through route handlers: none, every route builds its own insert object. Mass assignment through direct PostgREST is A7-API-01/02/03 plus the already-known A7-AUTHZ-03.
- (3) SQL injection: no string-built SQL in app code; the only `.or()` with user input (`lib/api/admin-recipes.ts:53`, admin-only) quotes and escapes `"`/`\` (A4-L6 fix holds); `get_catalog` uses parameterised `ilike '%' || v_search || '%'` (wildcards `%`/`_` are not escaped, so a search for "50%" over-matches: cosmetic, not reported). No dynamic `EXECUTE`/`format()` in the RPCs read.
- (3) XSS: only two `dangerouslySetInnerHTML` sinks: JSON-LD via `serializeJsonLd` (escapes `<`, U+2028/2029) and `components/qa/scroll-fade-wrapper.tsx` fed by the Shiki code block on QA pages. No `generateMetadata` reads `searchParams`. The only Resend email (`renderSubscriptionConfirmationEmailHtml` in `lib/email/`, sent from `lib/billing/grant-pro.ts:108`) is built from Stripe price/date and a fixed URL, no user string.
- (3) Header injection: `Content-Disposition` filename is a date; checkout/portal URLs use `request.nextUrl.origin` (Vercel routes by Host, so not attacker-steerable to another site). Log injection: Edge logger writes one `JSON.stringify` line per event.
- (3) CSV/formula injection: `toCsvValue` prefixes `= + - @ \t \r` and quotes `, " \n \r` (A4-L3 fix holds).
- (3) Path traversal / storage: no `storage.from` use in app or functions. SSRF: the only user-supplied URL fetched is the push endpoint, allowlisted in DB CHECK and again in `send-weekly-reengagement-push` (`isAllowedPushEndpoint`, host must be followed by `/`, so `@evil` fails); Sentry/PostHog hosts are fixed. Open redirect: only `/auth/confirm` takes `next`; `safeNextPath` rejects `\`, `//`, and re-resolves via `new URL` (tab/newline stripping cannot produce `//`); production probe `next=//evil.com` -> 307 to `/forgot-password?error=invalid_link`. Prompt injection: no LLM is called anywhere (no provider SDK or LLM fetch in functions or app).
- (4) Error leakage: route handlers return fixed Spanish messages and log details server-side; Edge `toErrorResponse` returns "Error interno del servidor" with an error id, no stack or SQL text. Production probes: `/api/health` and `/api/health/jobs` expose only status words and the job name `stripe-reconcile`; `/api/cron/stripe-reconcile` 401; export / pro-price 401 without session; OPTIONS to checkout from a foreign origin returns no `Access-Control-Allow-Origin`.
- (5) Idempotency: plan creation `unique_user_semana` + 409 mapping; shopping list `unique_plan_lista` + 409; slot state change is a conditional update (`not estado in (cocinada,descartada)`) -> 409 on race; `jsonb_add_item` locks the row `for update`; favorites unique `(user_id, recipe_id)`; consents unique `(user_id, kind, version)`; waitlist unique `lower(email)`; slots unique `(meal_plan_id, dia, tipo_plato)`. Residual: the substitution duplicate check in `update-recipe-status` is read-then-write (two concurrent substitutions of different slots to the same recipe can both pass), effect is one repeated recipe in the user's own week: not reported.
- (6) Rate limiting: `check_and_increment_rate_limit` is SECURITY DEFINER, rejects `p_user_id <> auth.uid()`, whitelists endpoints and clamps `p_limit`; it fails closed (RPC error -> 500, not allow). No route trusts `X-Forwarded-For` (no IP-keyed limiter exists at all). Anonymous/guest identities are gated by hosted captcha (login returned `captcha_failed` without a token), so per-user limits cannot be multiplied freely. Nothing anonymous sends email or calls a paid API (public price reads are cached 1 h).
- (7) Export: `/api/profile/export` reads 8 tables, each with `.eq(user_id|id, user.id)` on the cookie client (RLS also applies), push endpoints only as `endpoint` without keys; size is one user's rows. No other export endpoint.

## 4. Could not verify, and why

- Live authenticated probes on fresco-pre (malformed JSON -> 500, type confusion, `jsonb_add_item` with a scalar): the PRE automation identity cannot sign in through the API because hosted Auth requires a captcha token (`{"error_code":"captcha_failed","msg":"captcha protection: request disallowed (no captcha_token found)"}`). A browser login would need solving the captcha; not attempted. A7-API-03/05 therefore rest on the exact code path.
- A7-API-01/02 inserts and A7-API-04 load were not executed by rule (shared DB writes, no load).
- `/auth/confirm` calls `verifyOtp` server-side for any anonymous GET, so Supabase's per-IP `token_verifications` limit (`config.toml:221`, 30/5 min locally; hosted value not readable) is counted against Vercel egress IPs, not the caller's. Whether that lets one caller block other users' recovery links depends on how many egress IPs Vercel uses: not measurable without load, so not reported as a finding.
- Hosted Auth settings (email rate limit, captcha provider config) cannot be read with read-only tools; captcha presence was inferred from the live error above.

## 5. Secrets

secrets_materialized: none (the PRE access token request failed and nothing was written to disk; credentials were expanded by the shell inside one process and never printed)
cleaned: yes
