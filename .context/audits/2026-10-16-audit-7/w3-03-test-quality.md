# Audit 7 - TEST axis (w3-03)
Commit 1feb6062 (staging), date 2026-10-16

## Findings

### Baseline run results (item 1)
- `bun run test`: 3509 pass / 402 skip / 0 fail, 347 files, 49.8 s wall (first run, cold). `test:random` x3 (seeds 1688932549, 594884396, 3182290940): identical 3509/402/0 each time, 32-36 s. No order dependence seen. Whole suite also green under TZ=Pacific/Kiritimati, America/Los_Angeles, UTC (3509 pass each).
- `types:check` exit 0; `lint:check` exit 0 with 3 warnings (ts/no-explicit-any, cli/lib/updater-settings.test.ts:360,390,402); `knip:check` exit 0 clean; `cycles:check` 386 files, no cycle. No repo files written (git status shows only the two pre-existing untracked audit paths).
- Noisy logs: expected stderr from error-path tests ("error: db down" etc.) printed with no marker; not hiding failures, but it makes a real regression's stack indistinguishable from fixture noise.

### A7-TEST-01  HIGH  CONFIRMED  Allergen/diet oracle is blind to whole classes of recipe defects and is green while live data is wrong
Evidence:
- `tests/db/recipe-allergen-diet-rules.ts:81` reads only `ingredientes_principales`; `pasos_resumen` is never read (rg: no test of tags vs steps).
- Vocabulary gaps in `ALLERGEN_KEYWORDS` (lines 25-40): sesamo = `sesamo|tahini` (no `hummus`/`humus`), pescado lacks lubina/trucha/caballa/rodaballo/pez espada, moluscos lacks chipirones/vieiras/berberechos/navajas, crustaceos lacks cigalas/camarones/centollo, gluten lacks bulgur/semola/espelta/gnocchi/pizza/rebozado, apio has no `caldo`, sulfitos only `vino` (no vinagre/pasas).
- The oracle only checks "tag missing for a keyword" (line 85-88) and 3 diet contradictions; it never flags a diet flag (`sin_gluten`, `vegano`, `vegetariano`, `keto`) that contradicts steps, nor an extra/absent tag from steps.
- Ran the oracle itself over live active recipes (read-only `select ... from recipes where activo`, 538 rows, saved to scratchpad `recipes.json`, script `oracle-delta.ts`): `auditRecipe` returns 0 problems. Yet:
  - "Tostada con hummus y pepino": ingredientes ["pan integral","hummus","pepino"], alergenos ["gluten"] (no sesamo). Sibling "Wrap de pollo con hummus" does carry sesamo, so the intent is known. Oracle passes it because `hummus` is not a keyword.
  - second "Pad thai de gambas" row: ingredientes ["fideos de arroz","gambas","huevo","cacahuetes"], pasos "...Mezclar todo con salsa de soja y cacahuetes", alergenos ["crustaceos","huevo","cacahuetes"] (no soja), dieta.sin_gluten=true (soy sauce is wheat-based). Oracle passes it because soy sauce is only in the steps.
  - 11 stock/broth recipes (e.g. "Crema de calabacin" [caldo de verduras], "Pollo en pepitoria" [caldo de pollo]) have no apio tag; oracle has no `caldo` rule (arguable but the EU-14 stock case the earlier wave raised).
- The coherence test only runs with `RUN_DB_INTEGRATION=1` against the local `seed.sql` catalog (`recipe-allergen-diet-coherence.test.ts:25-27`), i.e. a snapshot, not the data real users see.
Impact: a person with a sesame or soy/wheat declaration receives a recipe containing it; the safety net that is supposed to catch tag errors cannot see the exact class of error that exists.
Reproduction: run `bun D/oracle-delta.ts D/recipes.json` (read-only) -> 0 problems; inspect the two rows above.
Fix: scan `pasos_resumen` + `ingredientes_principales` jointly with the same keywords; add hummus/humus/falafel, caldo (apio), salsa de soja/shoyu (soja + gluten), full EU-14 fish/mollusc/crustacean species lists; add a reverse check (diet flag true while any keyword for that diet breaker appears). Pin each with a row in `recipe-allergen-diet-rules.unit.test.ts` (runs without stack). Also run the coherence test against a nightly read-only dump of the hosted catalog.

### A7-TEST-02  HIGH  CONFIRMED  No test could have caught the `copy_meal_plan_to_week` allergen bypass
Evidence: `supabase/tests/copy_meal_plan_to_week.test.sql:15-31` inserts recipes with only `(id, nombre, slug)` (no alergenos) and a `user_profiles (id)` row with no allergens; 6 assertions (ownership, replace, count). `rg alerg supabase/tests`: only `get_catalog.test.sql` and swap tests mention it; nothing for copy. `tests/db/` has no copy test (`rg copy_meal_plan_to_week` in tests: only `security-definer-spoof.test.ts`, spoof/authz only). The 7 call sites that do test allergen filtering (`assign-recipe-to-slot`, `update-recipe-status`, `reassign-guest-data`, `get_catalog`, `allergen-vocabulary`) are separate code paths; e2e `@seguridad-alimentaria` has 6 scenarios, none on "usar este menu" (FRESCO-427).
Impact: a household member with an allergy copies a past week and receives a slot the filter would have removed; green CI.
Reproduction: n/a (static; read the pgTAP file).
Fix/test: pgTAP case: profile with `alergenos=['gluten']`, source plan containing a gluten recipe, call copy, assert the slot is not copied (or flagged excluida). Same as the swap test pattern. Generalise: a single table-driven db test that, for EVERY rpc/edge function that writes `meal_plan_recipes.recipe_id`, asserts allergen safety (`meal_plan_insert_paths.test.sql` is the natural home; check it enumerates writers by introspection so a new writer fails).

### A7-TEST-03  MEDIUM  CONFIRMED  Stripe `livemode` and double checkout: nothing pins either
Evidence: `rg livemode` over code: zero hits outside docs. `app/api/stripe/webhook/route.test.ts` (44 tests) covers signature, idempotency by event.id, expirable claim, refunds, out-of-order, but no event with `livemode` mismatch; fixtures never set it. `app/api/stripe/checkout/route.test.ts:130` covers "already Pro -> 409" only when the profile already says `plan:'pro'` (sequential); nothing for two requests before the webhook lands (profile still free), no idempotency key assertion (`rg -i idempot app/api/stripe/checkout/route.ts` empty), `sessionsCreate` is a mock so concurrency is unobservable.
Impact: a live-mode event (or a test-mode event signed with a leaked/mis-scoped secret) is accepted; double click on "Probar Pro" creates two Stripe subscriptions, second one billed on conversion.
Fix/test: unit: event with `livemode:true` against a test-mode key config -> 400 and no write; checkout: two concurrent POSTs with a free profile -> exactly one `sessions.create` per idempotency key (assert `idempotencyKey` option) and a webhook test where a second `checkout.session.completed` for a different subscription while one is active cancels/ignores the newer.

### A7-TEST-04  MEDIUM  CONFIRMED  The generate-meal-plan handler (the money + safety path) has no handler-level test; its positive path is only e2e
Evidence: `supabase/functions/generate-meal-plan/index.ts` (275 lines) has no `index.test.ts` (checked every `supabase/functions/*/index.ts`: also missing for generate-shopping-list 173 lines, get-shopping-list-suggestions 111, delete-catalog-recipe 92). `tests/db/edge-functions/generate-meal-plan.test.ts` has 4 tests, all negative (401 no token, 401 garbage token, 429 saturated, 400 bad body). Pure helpers (`entitlement.ts`, `menu-selector.ts`, `prompt.ts`, `rate-limit.ts`) are tested; the wiring (profile read -> `get_filtered_recipes` -> lapse check -> select -> insert -> 21 rows) is exercised only by the e2e scenario "Una receta con un alérgeno declarado nunca llega al menú generado" (regression.feature:438) which uses gluten+lactosa only.
Impact: a wiring regression (wrong profile id, skipped filter call, entitlement checked with a stale row) passes unit and DB layers.
Fix/test: DB-integration test with a real user and real function invocation (the stack is already up in CI): profile alergia `sesamo`, generate, assert 0 of 21 recipes carry sesamo by tag AND by oracle keywords; free user at 6th generation of the month; Pro with `plan_expires_at` in the past and no `payment_failed_at` -> treated as free.

### A7-TEST-05  MEDIUM  CONFIRMED  Profile diet filter (vegano, halal, keto, sin_gluten, sin_lactosa, sin_huevo, vegetariano) has no behavioural test; kosher is not filterable at all
Evidence: `supabase/migrations/20260901073555_allergen_filter_safety_net.sql:77-83` implements seven diet predicates in `get_filtered_recipes`. `rg -i 'vegan|halal|keto'` over `supabase/tests`, `tests/db/edge-functions`, `tests/steps/seguridad-alimentaria.steps.ts` finds nothing; only `get_catalog.test.sql:76` checks `dietas=[vegetariano]` of the catalog filter (a different function), and the coherence test checks tags vs ingredients, not the filter. The `dieta_*` profile columns are exercised only in `tests/db/health-data-consent.test.ts` (consent) and onboarding UI steps.
Impact: a regression in any one of the seven predicates (e.g. `vegano` treated as `not vegetariano`) serves meat to a vegan household; nothing fails.
Fix/test: pgTAP, one profile per flag, assert `get_filtered_recipes` returns only recipes with `dieta->>flag = true`, and returns none with the flag false/null; a null-dieta recipe must be excluded.

### A7-TEST-06  MEDIUM  CONFIRMED  The real login (password + Turnstile + Supabase captcha) is exercised by no automated gate
Evidence: `supabase/config.toml:226-229` `[auth.captcha]` is commented out, so the CI local stack has no captcha; `pr-check.yml` forces `NEXT_PUBLIC_TURNSTILE_SITE_KEY=` empty ("FRESCO-799"), so the widget never renders in e2e. The only post-deploy login check is the `@smoke` scenario "Inicio de sesión correcto con credenciales válidas" (regression.feature:58) run with `E2E_SESSION_LOGIN: '1'` (`post-deploy-smoke.yml:145`), which per `tests/session-login.ts:3-24` obtains the session via admin `generate_link` + `verifyOtp` and never touches `/login` or the password grant. The 3 `@requiere-captcha-off` scenarios are excluded from staging/production runs (`package.json` test:e2e:staging/production).
Impact: a broken Turnstile key, a CSP that blocks the Cloudflare iframe (CSP is currently Report-Only; flipping it to enforcing is a noted follow-up), or captcha misconfiguration locks every user out of login and signup with all gates green.
Reproduction: n/a (static).
Fix: a scheduled (not per-deploy) Playwright check against fresco-pre that loads `/login`, asserts the Turnstile widget renders and the submit becomes enabled (no credentials needed), plus a unit/e2e check that CSP `frame-src`/`script-src` includes challenges.cloudflare.com once CSP is enforced.

### A7-TEST-07  MEDIUM  CONFIRMED  Coverage ratchet gives a false sense: honest coverage is 58.7 % and it can rise by deleting imports
Evidence: `bun scripts/check-coverage.ts --print` (run today): LOADED functions 88.68 % / lines 88.95 % (floor 87.5 / 88.7); HONEST lines 58.69 % (floor 54.5 %), "140 files no test imports, counted as 0 hit". Header of `scripts/check-coverage.ts` itself states the loaded figure goes up "by deleting an import as easily as by adding a test". Unloaded files include the four edge-function handlers above and `app/api/waitlist/route.ts` (public write endpoint, no unit test; only a DB test of the table + `lib/legal/waitlist.test.ts`).
Impact: the CI number reads as ~89 % while up to ~41 % of source lines (an over-estimate: every non-empty line of the 140 unloaded files counts) are never executed by any unit test.
Fix: make the honest floor the headline, ratchet it up by the delta of each PR (diff-coverage on changed lines), and list the unloaded files in the job summary.

### A7-TEST-08  LOW  CONFIRMED  Mock-only and self-referential assertions (examples)
- `lib/api/meal-plan.test.ts:230-246`: `copyMealPlanToCurrentWeek` is "proved" with an inline fake `rpc` that returns `'new-plan-id'`; asserts the RPC name, and `p_semana_iso` `toEqual(getIsoWeek())` using the same function the unit uses (tautology; a wrong week base would pass; also races across a Sunday-to-Monday midnight between the two calls). It proves wire shape only; the SQL behaviour is in pgTAP (which lacks the allergen case, A7-TEST-02).
- `menu-selector.test.ts:~470-500` "never reintroduces an allergen": the test itself pre-filters candidates by allergen (re-implementing `get_filtered_recipes`) and then asserts the output contains none. It can only fail if `selectMenu` invents ids; its own comment says it does not test filtering. Honest naming, weak value: the real invariant (SQL filter) is covered by DB tests only for tag equality.
- `consolidator.test.ts:220-235` blesses `raciones_usuario = 0` -> a shopping line with `cantidad: 0`; and `:71-82` blesses an unknown ingredient as exactly `1 unidades` independent of household size (the test never varies `raciones_usuario`). Both lock in behaviour rather than a requirement.

### A7-TEST-09  LOW  CONFIRMED  CI jobs have no timeout and cleanup failures are swallowed
`rg timeout-minutes .github/workflows/pr-check.yml` -> one hit (line 337, `supabase start` only). repo-check, unit, deno, db-integration and e2e default to 360 min; a hung `wait-on`/Playwright run burns the Actions budget. `tests/test-user-factory.ts:149-151` logs and swallows cleanup failures; on the post-deploy smoke (real shared Supabase) a failed delete leaves test users/rows in the live database with no alert. Fix: `timeout-minutes` per job (e.g. 15/20), and have `cleanupAll` fail the run (or write a Sentry/annotation) in the smoke workflow.

## Answers to the four context items (a-d)
- (a) Allergen oracle gaps: NO existing test catches them; the oracle is the test. Live data today passes it (0 problems over 538 active rows) yet "Tostada con hummus y pepino" (no sesamo) and one "Pad thai de gambas" (soy sauce in steps, no soja, sin_gluten=true) exist and are also in `supabase/seed.sql`, so CI sees the same wrong data. I did not reproduce the ~150 count; my vocabulary-delta found 11 apio/stock, 2 sulfitos candidates plus the two confirmed rows (see A7-TEST-01). Catching test: oracle over ingredients+steps with a broader EU-14 vocabulary and a reverse diet check.
- (b) `copy_meal_plan_to_week`: NOT caught (A7-TEST-02). Catching test: pgTAP with an allergic profile and an allergenic source slot.
- (c) Stripe `livemode`: NOT caught, no test and no code (A7-TEST-03). Catching test: webhook with `livemode:true` under a test-mode config -> rejected, no profile write.
- (d) Double checkout: NOT caught; only the sequential already-Pro 409 is tested with a mocked Stripe (A7-TEST-03). Catching test: concurrent POSTs with idempotency key, plus webhook behaviour on a second subscription.

## Item 2: critical-path coverage matrix (layer: U = unit with mocks, D = DB/pgTAP real Postgres, E = e2e)
- Allergen/diet filtering: U `menu-selector.test.ts` (pre-filter mimicked), `recipe-allergen-diet-rules.unit.test.ts`; D `allergen-vocabulary`, `assign-recipe-to-slot`, `update-recipe-status`, `reassign-guest-data`, `get_catalog.test.sql`, coherence (RUN_DB only, seed catalog); E 6 @seguridad-alimentaria. NOT covered: diet flags in `get_filtered_recipes` (A7-TEST-05), `copy_meal_plan_to_week` (A7-TEST-02), steps-based tags (A7-TEST-01), kosher filter (none exists).
- Auth/session: U `proxy.test.ts`, `lib/auth/*`, `app/auth/confirm/route.test.ts`; D `session-login`, `rls-cross-user`; E login (captcha off). NOT: Turnstile/captcha path, hosted login (A7-TEST-06).
- Stripe webhook: U 44 tests (signature, idempotency, claim expiry, refunds, out-of-order); D `stripe-webhook-events` (concurrent takeover). NOT: livemode, subscription.created, invoice events, real signature against Stripe CLI (the `stripe-e2e.yml` weekly job runs `@requiere-stripe-real` scenarios on staging, `continue-on-error` at line 77: check what that step is before trusting it).
- Checkout and trial: U `checkout/route.test.ts` (trial params, 409, rate limit, fail-closed); E 8 @suscripcion. NOT: concurrency/idempotency (A7-TEST-03).
- Pro gating / entitlement expiry: U `entitlement.test.ts` (6 cases incl. lapse + dunning grace, boundary `<` not pinned at exactly equal timestamp), `reconcile.test.ts`, `stripe-reconcile/route.test.ts` (30+); D `tests/db` protected subscription columns via RLS/trigger. NOT: Pro enforced only in generate-meal-plan; no handler-level test (A7-TEST-04).
- Menu generation: U selector + property tests (fast-check, 150 runs, seed pinned `0x46534335`); D 4 negative edge tests; E generation scenarios. NOT: positive handler path below e2e.
- Shopping list scaling: U `consolidator.test.ts`(30 cases), `recipe-quantities`, `aisle-pricing`; D `generate-shopping-list.test.ts` (substitutions, overlap 409). NOT: no property test (sum invariance under split/merge of recipes, monotonic in people, unit conversion round trip).
- Learning loop: D pgTAP `recipe_learning_trigger.test.sql`; U `learning-bridge-card`. NOT: end-to-end "rating changes next generated menu".
- Consent/analytics gating: U cookie-consent, analytics-consent-sync, posthog-provider; D `analytics-consent`, `user-consents`, `health-data-consent`. Found nothing missing at this layer.
- Account deletion/export: U delete-account index.test (30+, Stripe order, refund once), export route; D 5 negative tests. NOT: positive "populate then delete -> zero rows in every user table" (live query shows all 8 user_id tables CASCADE, so no defect, but no guard against a future table without FK); export completeness has no schema-drift guard.
- Rate limiting: U `_shared/rate-limit`, per-function; D `client-write-quotas` (17), clamp tests. Found nothing missing.
- Cron reconcile: U route + lib (heartbeat, Sentry, partial failure); D `job-heartbeat`. NOT: real Stripe.
- Coverage ratchet: see A7-TEST-07.

## Item 3: skipped / dead tests
- 402 skip = ~385 `tests/db/**` (`describe.skipIf(!(RUN && reachable))`; gated by `RUN_DB_INTEGRATION=1`, run in CI by `db-integration` job with a no-skip guard and floor 345) + 16 `cli/agent-lifecycle.test.ts` / `cli/lib/agent-compatibility.test.ts` (`skipIf(!HAS_CLAUDE/HAS_CODEX...)`, boilerplate tooling, dead on machines without those CLIs) + `consum-catalog`/`mercadona-catalog` `skipIf(!CACHE_AVAILABLE)` (cache dir may be absent in CI: silently dead; INFO). The db-integration floor 345 vs ~290 `test(` lines plus `test.each` expansions: slack is ~10 % so deleting a few DB tests is not noticed (cannot run the stack here to read the exact passed count).
- `.only`: none. `test.todo`: none. `expect(true)`: none. Disabled-by-tag e2e: of 195 Escenarios, ~146 `@automatizado`; 9 `@solo-manual`, 2 `@no-implementado`, 5 `@requiere-stripe-real` (only in weekly `stripe-e2e.yml` on staging), 3 `@requiere-captcha-off` (not in staging/prod runs); `@pendiente`: 0 live (header text only).
- Not in e2e at all: "Usar este menú" history reuse (FRESCO-427) (`rg` finds no scenario), signup with captcha, real Stripe checkout page.

## Item 4: mutation-style review (12 assertions)
Strong: (1) checkout trial `toEqual({trial_period_days:7, trial_settings...})`; (2) rate-limit RPC args `toEqual`; (3) webhook "out-of-order subscription id ignored"; (4) webhook claim-takeover tests (DB concurrent winner exactly one); (5) delete-account order cancel->refund->customer->user.
Weak: (6) `meal-plan.test.ts:244` `getIsoWeek()` tautology; (7) menu-selector allergen property (pre-filters in test); (8) `consolidator` 0-quantity and 1-unidad blessing; (9) coherence oracle `expect(missing).toEqual([])` — mutating the data to drop sesamo from hummus rows still passes (A7-TEST-01); (10) `entitlement.test.ts` "past expiry lapses" — uses a far-past date; flipping `<` to `<=` at `plan_expires_at == now` passes (boundary untested); (11) pgTAP copy test — removing any allergen logic changes nothing (A7-TEST-02); (12) e2e smoke "Inicio de sesión correcto" — passes with the login form deleted (session injected, A7-TEST-06).

## Item 5: property/fuzz
fast-check used in exactly one file (`menu-selector.test.ts`: 21-slot invariant, no-reintroduced-allergen, gap advertencias; seed pinned). Missing: quantity scaling (people x servings, merge associativity, unit conversion), allergen keyword oracle (unicode/accent/plural), slug generation, `iso-week` sweep exists as example-based only ("full year sweep" test at iso-week.test.ts:89 is a loop, good), `madrid-date` DST edges covered by 2 examples (summer/winter UTC offsets) but not the DST change days themselves (last Sunday of March/October).

## Item 6: e2e
- CI: 195 scenarios, 146 `@automatizado`, 4 workers, `retries:1`, per-test timeout 90 s; flakiness budget warns at 1 flaky, fails at 3 (`scripts/e2e-flaky-budget.ts`). Per-test isolated users with cleanup (`tests/test-user-factory.ts`): good, no shared-account collisions found. Local ephemeral stack, no secrets (FRESCO-802).
- Waits: only 1 `waitForTimeout` in `tests/steps/calendario.steps.ts:103` (overflow sampling interval, benign); 436 `getByTestId` vs 28 positional (`nth/first/last`) selectors: low brittleness.
- Post-deploy smoke covers 5 scenarios (login via injected session, mark cooked, shopping list generation, public /qa page, open subscription management). Does NOT cover: signup, real login, checkout, webhook, allergen filter on production data, account deletion, generate-meal-plan on production catalog (explicitly removed after cold-start flake FRESCO-322), email, push. It is non-blocking and fires after deploy (own comment lines 20-24).
- Staging/production e2e (`test:e2e:staging/production`) are manual only.

## Item 7: CI gates (pr-check.yml)
- Required: repo:check, test:unit, test:e2e, test:db-integration, deno:check. `pull_request` has no path filter; triggers `branches: [dev, staging, main]` so a PR targeting any other base (chained PR, feature branch) runs nothing until retargeted. e2e `if:` = PR or push to staging (not main). `needs: repo-check` plus a skipped job counts as passing on GitHub, but repo:check is itself required, so no bypass found.
- Retry masking: `retries:1` hides one flake per scenario (budget mitigates). db-integration refuses skips and has a floor. No `continue-on-error` in pr-check.yml; `continue-on-error: true` only on the smoke warm-up (line 120) and stripe-e2e line 77.
- No job timeout (A7-TEST-09). Per `project.yaml` `enforce_admins` false: the mirror push to main skips checks (already accepted divergence, mitigated by `git:promote`).

## Item 8: test code hazards
Unseeded randomness: 22 uses of `Math.random|randomUUID` in tests, used for unique ids (benign). Global state: `bun test:random` x3 and TZ x3 found no order or timezone dependence (strong evidence). Time-dependent: `setSystemTime` only in 3 files; `meal-plan.test.ts:244` compares against live `getIsoWeek()` (midnight-Sunday race, negligible). Network in unit tests: not verified (suite passes in ~50 s; I did not run it offline).

## Checklist items that found nothing
Order dependence/flakiness in 3 random runs; timezone dependence (3 zones); `.only`, `test.todo`, `expect(true)`; `@pendiente` live scenarios; hardcoded sleeps in e2e (1 benign); user-id tables without ON DELETE CASCADE (8 of 8 cascade); consent/analytics and rate-limit coverage gaps; path filters that skip gates.

## Could not verify
Exact passed count of the db-integration job vs floor 345 (needs the local Supabase stack/Docker; test:db against hosted is forbidden). Whether the unit suite is fully offline. The earlier wave's "~150 recipes missed" figure (live data passes the current oracle; those rows may have been fixed since or measured with steps-based criteria). Whether `stripe-e2e.yml` line 77 `continue-on-error` masks a real failure (not opened).

secrets_materialized: none
cleaned: yes (scratchpad files only: recipes.json is a SELECT of public catalog rows; no repo files written)
