# `tests/db/` — DB-integration tests

`bun test` against a **real Postgres** (the Supabase CLI local stack), not e2e,
not mocked. This is the project's first test layer that executes the actual
database path.

It exists to satisfy
`.agents/skills/sprint-development/references/rpc-authorization.md` §5: a
`SECURITY DEFINER` function that takes a caller-supplied identity/scope
parameter needs a test that **attempts the spoof against the real database** — a
mocked `db.rpc` proves nothing about the function. Audit-4 found real RLS
bypasses of exactly this class (FRESCO-360, FRESCO-361, FRESCO-362).

## What's here

| File | Covers |
| --- | --- |
| `harness.ts` | Config, native-`fetch` PostgREST/GoTrue helpers, per-test auth-user factory with cascade cleanup. Talks **only** to `127.0.0.1:54321` — `assertLocalStack()` refuses any hosted host. `callFunction()` calls an Edge Function on the local Functions runtime over real HTTP, the same way `rpc()`/`rest()` call PostgREST. |
| `security-definer-spoof.test.ts` | Every `SECURITY DEFINER` function in `public` with an identity/scope param. User B, with B's own JWT, passes user A's id / row id and the test asserts the spoof is denied (raised exception, or a provably zero-row effect). Read functions also assert the legit call is scoped to B. |
| `rls-cross-user.test.ts` | Every user-data table. A seeds a row; B (own token, never service-role) attempts SELECT / UPDATE / DELETE / INSERT-for-A and a real denial is asserted. Verification of "row unchanged" is re-read through A's own token. |
| `supermarket-price-model.test.ts` | FRESCO-770. The supermarket price tables and `get_supermarket_prices` (`SECURITY INVOKER`, no identity parameter). Read for `authenticated`, writes denied to a real user token, anon denied on the RPC; the legal gate (`habilitada` needs a runnable permission with a cited reference) holds in the database; the chain seed matches `registroSupermercados`; the RPC never returns a pending or switched-off chain. |
| `supermarket-demand-rpc.test.ts` | FRESCO-770. `get_supermarket_demand`, the `SECURITY DEFINER` cross-user read behind the refresh's demand: refused to a signed-in user and to `anon`, returns slots still to buy per ingredient to `service_role`, aggregates only (no user, plan or slot id), no identity parameter. |
| `supermarket-price-store.test.ts` | FRESCO-770. The refresh runner's database side with a `service_role` client: initial load (idempotent, never overwrites a newer price), the write decision (date bump, history only on a change, older ignored), which products the plan may track, and the whole loop with a fake connector. |
| `meal-plan-recipes-integrity.test.ts` | FRESCO-776. The owner of a slot cannot PATCH `estado` / `rating` / `recipe_id` / `sustitucion_ingrediente` directly (`P0001`), and `apply_recipe_status_update` no longer exists for a client (404, row unchanged). The regression test audit-5 shipped without. |
| `meal-plan-insert-paths.test.ts` | FRESCO-777. `authenticated` cannot INSERT into `meal_plans` / `meal_plan_recipes` (permission denied, `42501`), including a forged slot (`estado: cocinada`, rating, substitution), and `shopping_lists` only accepts a `meal_plan_id` the caller owns on INSERT and UPDATE. Fixtures seed through the service-role path (`seedMealPlan`, `seedSlots`). |
| `assign-recipe-to-slot.test.ts` | FRESCO-878. `assign_recipe_to_slot` (`SECURITY INVOKER`, no identity parameter): the owner puts an allowed recipe into an open slot; a foreign or missing slot, another `tipo_plato`, a recipe the profile filters out (allergen), a cooked / discarded / excluded slot, a past day and an anonymous caller are all refused with `P0001` (or 401/403) and leave the slot untouched. |
| `copy-meal-plan-filters.test.ts` | FRESCO-994. `copy_meal_plan_to_week` ("Usar este menú") applies the food-safety filter: a recipe the current profile rules out (declared allergen) or an inactive recipe is copied as an empty slot (`recipe_id` null, `pendiente`) with one `advertencias` entry on the new plan; a safe recipe is copied untouched and writes no warning; the RPC is rate limited (20/hour, `rate_limit_endpoints`) and the call past the limit fails. The pgTAP twin `supabase/tests/meal_plan_insert_writers_use_filter.test.sql` reads `pg_proc` and fails when a function that inserts into `meal_plan_recipes` neither calls `get_filtered_recipes` nor is a documented service-role-only exemption. |
| `recipe-allergen-confirmed-fixes.test.ts` | FRESCO-995. The seven active recipes whose own text confirmed an allergen their tags omitted are pinned by slug: `tostada-hummus-pepino` (`sesamo`), `moussaka-de-berenjena` (`gluten`), both `pad-thai-de-gambas` rows (`soja`, `gluten`) and `crepes-de-espinacas-y-queso-b124`, `tarta-de-limon-b145`, `croissant-jamon-queso` (`huevo`), each with its free-of flag false. It exists for `pad-thai-de-gambas-b41`, whose step says only "la salsa" and which the oracle cannot see. |
| `recipe-stock-and-miso-rules.test.ts` | FRESCO-996. Stock and miso as RULES over the whole catalogue, inactive rows included: every recipe whose ingredients or steps say "caldo" carries `apio` (owner decision: over-tag by rule; "su caldo", a legume's own cooking liquid, is not a stock); every miso recipe carries `gluten` and `soja` and is not `sin_gluten` (the four used to disagree); a vegetarian or vegan recipe that uses a stock names "caldo de verduras" in its ingredients. The oracle in `recipe-allergen-diet-rules.ts` pins the same three rules (`dieta:caldo` for the last). |
| `stripe-portal-rate-limit.test.ts` | FRESCO-1003. `check_and_increment_rate_limit` knows the `stripe-portal` endpoint (it raises for an unregistered one), allows 20 an hour per user and refuses the next, and a caller cannot raise the ceiling by passing a bigger `p_limit`. |
| `recipe-composite-products.test.ts` | FRESCO-997. Compound products as RULES over the whole catalogue, inactive rows included: curry, mayonnaise and barbecue sauce carry `mostaza`; vinegar, raisins, mayonnaise, barbecue sauce, beer and sushi rice carry `sulfitos` ("vinagre de arroz" does not count); a `sin_gluten` recipe says "tamari sin gluten" / "nachos sin gluten" instead of the bare product; a product the steps name (bechamel, crema de limón, salsa de soja, vinagre, curry) is also in the ingredient list. |
| `stripe-livemode-guard-schema.test.ts` | FRESCO-1001 (PR 1 of 3, ADR-0061). The schema the Stripe mode guard stands on: `billing_mode`, the one-row table holding the Stripe mode this shared database serves (test today), is closed to a signed-in user and to an anonymous caller (no read, no flip, no second row); the service role (the webhook) reads exactly one row in test mode and cannot write it, so the owner flips it once at go-live with `supabase db query --linked`. `user_profiles.stripe_livemode`, the mode of the Stripe ids on a profile, cannot be set by the owner of the profile (UPDATE) nor on INSERT (ADR-0007), while the service role can set it next to the ids. |
| `recipe-ingredient-names-distinct.test.ts` | FRESCO-876. `recipes_ingredientes_principales_distinct`: a recipe cannot list the same ingredient twice (case and spaces ignored) on insert or update, and no catalog recipe does. |
| `user-profile-bounds.test.ts` | FRESCO-914. The size of a `user_profiles` row is bounded, with the owner's own session: the three ingredient lists and `cocinas_favoritas` (30 elements, 2400 bytes joined), `nombre` (80 characters), the four free-text columns (500) and `planning_selection` (a JSON object of at most 4096 bytes). Each field accepts exactly the limit and refuses one past it with a check violation that names the constraint. |
| `create-meal-plan.test.ts` | FRESCO-913. `create_meal_plan`, the one transaction that writes a weekly plan and its slots: creates both, refuses a malformed week, a `fecha_inicio` that is not its Monday or no slots (`22023`), rolls the plan back when the slots fail (bad day, duplicate slot, unknown recipe), answers a unique violation for a second plan in the same week, is executable by the service role only, and the table refuses a malformed week even when written directly. |
| `shopping-list-remove-item.test.ts` | FRESCO-948. `jsonb_remove_item` (`SECURITY INVOKER`, no identity parameter), the undo of "Añadir" in "Sugerencias para ti": removes only an item marked `origen: 'sugerencia'` and drops a pasillo it empties; a meal-plan item with the same name is never removed; only the named pasillo is touched; another user's spoof raises `not found or not owned by caller` and leaves the list unchanged; an anonymous caller is refused. |
| `job-heartbeat.test.ts` | FRESCO-915. `job_heartbeat`, the last successful run of each scheduled job: closed to every client role (a user cannot read it or forge a fresh heartbeat), upsertable by the service role (a second write updates the row), and the job name must be a short slug. |
| `account-erasures.test.ts` | FRESCO-910. `account_erasures`, the record that an account was erased: closed to every client role, writable and readable by the service role, the user hash must be a SHA-256 digest (a raw id is refused), and a pending PostHog id exists if and only if the PostHog deletion failed. |
| `allergen-vocabulary.test.ts` | FRESCO-912. The vocabulary covers the 14 EU allergens: a recipe can carry `mostaza` and `altramuces`, an unknown tag is still refused by `recipes_alergenos_vocab`, and a person who declares either no longer receives a recipe that carries it from `get_filtered_recipes`. |
| `recipe-allergen-diet-coherence.test.ts` | FRESCO-943. Every active recipe's `alergenos` and `dieta` agree with its `ingredientes_principales`: a word-boundary keyword table (`recipe-allergen-diet-rules.ts`, with a commented exceptions list) requires the allergen tag for dairy, gluten, egg, fish, shellfish, molluscs, soy, sesame, peanuts, tree nuts, celery and wine; pork or alcohol means `halal = false`; rabbit, shellfish, pork or meat + dairy means `kosher = false`; a gluten / lactosa / huevo tag means the matching `sin_*` flag is false. Failures list `<recipe>: falta <tag> (ingrediente: <x>)`. `recipe-allergen-diet-rules.unit.test.ts` pins the table without a stack. A new ingredient word goes in the table, a wrong hit goes in the exceptions with a reason. FRESCO-999: the oracle reads `pasos_resumen` together with `ingredientes_principales` (a sub-ingredient named only in a step counts), uses the full EU species lists, flags compound products (hummus, caldo, vinagre, curry, tamari, miso, salsa de soja) and runs a reverse check (`sin_gluten`, `sin_huevo`, `vegano`, `vegetariano`, `halal`, `kosher` true while the text breaks it). The findings the data cards still owe sit in `recipe-allergen-diet-known-gaps.ts` as a ratchet per owning ticket: a finding that is not listed fails, and a listed finding that no longer reproduces fails too, so the card that fixes the data deletes its entries. The same oracle runs strictly, with no list, over the hosted catalogue in `scripts/check-hosted-recipe-tags.ts` (nightly, `.github/workflows/hosted-catalog-allergen-audit.yml`). |
| `catalog-titles-and-categories.test.ts` | FRESCO-861. `recipes_nombre_sin_con_repetido` (a name cannot repeat "con") and `recipes_categoria_en_contrato` (`clasificacion.categoria` must be a category of `CategoriaReceta`, compared against `RECIPE_CATEGORIES`), on insert and update, and no catalogue recipe breaks either. |
| `push-subscriptions-validation.test.ts` | FRESCO-779. `push_subscriptions` only accepts https endpoints on real push services (FCM, Mozilla, Apple, WNS) and rejects look-alike hosts, userinfo, ports, plain http and over-long URLs; key material is bounded base64url; a user is capped at 10 subscriptions; a guest (anonymous) session cannot insert. The same vectors run through the TypeScript copy the weekly sender uses and the test fails if the two disagree. |
| `client-write-quotas.test.ts` | FRESCO-799. Client writes are bounded: length / size / cardinality CHECKs on `recetas_propias`, `shopping_lists.items` and `meal_plans.advertencias` (sizes are logical, so a repetitive value cannot hide behind compression); per-user row quotas (200 `recetas_propias`, 1000 `favorites`); `check_and_increment_rate_limit` rejects an endpoint not in `rate_limit_endpoints`, clamps `p_limit` to the registered ceiling, and the registry is closed to clients (`42501`). A new rate-limited function needs a row in `rate_limit_endpoints`, SQL callers included. |
| `revoked-privileges-and-catalog-limit.test.ts` | FRESCO-816. `get_catalog` still pages (a small `p_limit` returns that many rows) and a huge `p_limit` is one bounded page covering the whole active catalog (ceiling 1000). Static checks pin the migration's revokes (TRUNCATE / TRIGGER / REFERENCES / MAINTAIN, trigger-function EXECUTE) and `pg_temp` last on `search_path`; the grants themselves are not observable through PostgREST and are verified with `has_table_privilege` / `has_function_privilege` when the migration ships. |
| `stripe-webhook-events.test.ts` | FRESCO-816. `stripe_webhook_events`, the Stripe webhook's idempotency key: closed to every client role (a signed-in user cannot read, forge a "processed" row, or delete one), the service role claims an event id once and a second claim is a unique violation (`23505`), and a released event can be claimed again. FRESCO-909: a claim carries `claimed_at` / `completed_at`, only the service role can update it, of several concurrent takeovers of one expired claim exactly one wins (compare-and-swap on `claimed_at`), and the migration backfills only when it creates the columns. The real `claimWebhookEvent` (service-role supabase-js client) takes over a claim stamped by the default `now()` (microsecond round-trip), exactly one of two concurrent takeovers wins, and a stale worker cannot release or complete the claim that replaced its own. |
| `user-consents.test.ts` | FRESCO-794. `user_consents` (ADR-0040): the owner records `(kind, version)` and the database sets `user_id` and `accepted_at`; a caller cannot supply `user_id` (own or someone else's) or `accepted_at` (column-level INSERT grant, `42501`); no UPDATE, no DELETE, no reading another user's rows; CHECK on kind and version; unique `(user, kind, version)` is a no-op on `ignore-duplicates`; a guest records and reads their own; cascade on user delete. |
| `health-data-consent.test.ts` | FRESCO-917. `require_health_data_consent` on `user_profiles`: with the user's own session, writing `alergenos`, any `dieta_*` flag or `dieta_texto_libre` without a `health_data` consent is refused (INSERT, UPDATE and upsert, row untouched); a consent of another kind, or another user's, does not count; non-health columns and clearing health data still work without consent; a legacy profile that already holds health data can change other columns but not the health ones until it consents; the service role is exempt. `createUser({ healthDataConsent: true })` seeds the consent for tests that PATCH allergies with the user's token. |
| `analytics-consent.test.ts` | FRESCO-919. `user_profiles.analytics_consent`, the cookie-banner decision server-side PostHog events read (ADR-0044): starts as null (treated as no consent), the owner can record true and false with their own session, another user cannot change it (zero rows, value unchanged), the service role reads it. |
| `session-login.test.ts` | FRESCO-799. `tests/session-login.ts`, the e2e suite's way to get a session when a password grant needs a Turnstile token (hosted backend with the captcha on, `E2E_SESSION_LOGIN=1`): `generate_link` + `verifyOtp` mint a session the REST API accepts as that user, the cookies it returns are readable by a `@supabase/ssr` server client, and an unknown email fails without creating an account (`recovery`, not `magiclink`, which would create it). The captcha itself is off on the local stack; the with-captcha behaviour was checked once by hand against a local stack configured with Cloudflare's test secret. |
| `edge-functions/*.test.ts` | HTTP negative-contract tests (FRESCO-464 PR2) for all 8 Edge Functions (`generate-meal-plan`, `generate-shopping-list`, `reassign-guest-data`, `delete-account`, `update-recipe-status`, plus, from FRESCO-782, `delete-catalog-recipe`, `get-shopping-list-suggestions`, `send-weekly-reengagement-push`): 401 (missing/garbage token), 403 (`delete-catalog-recipe`, caller outside the admin allowlist), 429 (rate limit, pre-saturated via the same RPC the function calls), 400/404/409/422 body and ownership validation. `send-weekly-reengagement-push` only exercises its rejection paths (401 for anon key, garbage token and user JWT) because the happy path would send real notifications. Calls the real Functions runtime via `callFunction()` — never mocked. |

## Run it locally

```bash
supabase start          # if the stack isn't already up
supabase db reset        # fresh migrations + seed.sql (the 1000-recipe catalog)
bun run test:db          # = RUN_DB_INTEGRATION=1 bun test tests/db/
```

## Fail closed (FRESCO-781)

Skipping is only for a run that was never asked for. With `RUN_DB_INTEGRATION=1`
the harness retries the stack probe (5 attempts, 2 s apart) and then **throws**
(`refusing to skip the DB-integration suite silently`) instead of skipping, so a
stack that did not start can no longer turn the whole suite green with
`0 pass / N skip`. CI adds two more guards in the `test:db-integration` job: any
`skip` line in bun's summary fails it, and so does fewer than 345 passing tests
(raise the floor as tests are added). `tests/db/harness.unit.test.ts` pins the
policy without needing a stack.

## Isolation from the default `bun test`

Every file guards its `describe` with
`describe.skipIf(!(RUN_DB_INTEGRATION === '1' && stackReachable()))`. So:

- a bare `bun test` skips the whole suite;
- `bun run test:coverage` (the `unit` CI job) skips it — and `tests/` is already
  outside the coverage ratchet, so the floor is unaffected;
- only `bun run test:db` (which sets `RUN_DB_INTEGRATION=1`) runs it, and only
  when the local stack actually answers.

CI runs it in the dedicated **`db-integration`** job in
`.github/workflows/pr-check.yml` — parallel to `unit` / `deno`, never part of
`e2e` (ADR-0018: the e2e job's wall-clock is the binding constraint). No
secrets: local-stack demo keys only.

## Credentials

Supabase's public local-dev demo constants (`iss: supabase-demo`), read at
runtime from the committed `.env.ci`. No hosted-project keys, ever.

## Adding a test

- Get users from `createDbTestContext()` and wire `cleanupAll()` into `afterAll`.
- Seed A's data with A's own token (`rest(...)` / the `seed*` helpers). Deleting
  the auth user in teardown cascades everything away.
- For a spoof: call the function/table as B with A's identifier and assert the
  denial. If the guard raises, assert the code/message. If it silently filters,
  re-read as A and assert **nothing changed** — a 2xx with an empty body is not
  by itself proof.
