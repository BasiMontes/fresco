# Audit 8 - TEST axis (w4-03)
Commit 71ab0864 (staging), date 2026-11-03

## (1) Scope and what I inspected
- `bun test` (plain): 5506 pass / 656 skip / 0 fail, 501 files, 144 s (A7: 3509 / 402 / 347 files). The skips are the DB-integration files gated by `RUN_DB_INTEGRATION=1` plus boilerplate `skipIf(!HAS_CLAUDE...)` in `cli/`.
- `bun test --parallel --randomize --timeout 15000` (= `test:random`), 4 runs: run 1 = 5505 pass / **1 fail** (test name lost, only the tail was captured, unseeded); run 2 seed 2905814687 = 0 fail; run 3 seed 3119389050 = 0 fail; run 4 still running when I wrote this (see A8-TEST-04).
- Oracle `tests/db/recipe-allergen-diet-rules.ts` (337 lines, read in full), run over the live catalogue (658 active rows, SELECT through `supabase db query --linked`, saved to `recipes.json` in this folder) plus 26 synthetic probes (`probe.ts`, `live.ts` in this folder).
- Read: `scripts/check-coverage.ts` (not run, it writes lcov to tmpdir), `.github/workflows/pr-check.yml`, `login-widget-check.yml`, `stripe-e2e.yml`, `.agents/project.yaml required_checks`, webhook/consent/safe-next-path/entitlement code and tests, the generate-meal-plan and DB tests.
- Greps: `.only` none, `.skip(` none in app/lib/components/supabase/tests, `test.todo` none, `@pendiente|@solo-manual|@no-implementado` none in `.feature` files, files without any assertion: 1 (`scripts/acli-md-to-adf.test.ts`, a deliberate re-import of another suite), snapshots only 5 in total (email template, installer UI), `mock.module` in 57 files (max 6 in the webhook test).

## (2) Findings (sorted by severity)

### A8-TEST-01  MEDIUM  CONFIRMED  Webhook signature verification is never exercised with a real signature in any gate that blocks a merge
Evidence:
- `app/api/stripe/webhook/route.test.ts:51-52` replaces `stripe.webhooks.constructEvent` with a mock and `resolveWebhookSecret: () => 'whsec_test'`. The two signature tests (`:132-143`) only prove "no header -> 400" and "mock throws -> 400". `rg "constructEvent\)\.toHaveBeenCalledWith|constructEvent.mock.calls"` over the file: no hit, so nothing pins the arguments `(rawBody, signature, webhookSecret)`.
- `rg "generateTestHeaderString|createHmac"` finds a real signer only in `tests/test-helpers.ts:206` (`postSignedStripeEvent`), used by the Playwright `@suscripcion` scenarios, and those only post VALID signatures. No scenario posts a bad or missing one (`rg -i "firma inv"` in tests: only a comment).
Mutation check by reading (route.ts:115): replacing `rawBody` with `JSON.stringify(JSON.parse(rawBody))`, or `webhookSecret` with another env var, or `signature` with `''`: unit stays green (constructEvent is a mock); the e2e job catches the first two only because it signs with the real secret, and only on the CI stack. Deleting the whole `try { constructEvent } catch` and using `JSON.parse(rawBody)` as the event turns exactly ONE unit test red ("400 when signature verification throws").
Impact: if the raw-body or secret wiring regresses, forged webhooks (grants Pro for free) would be accepted while unit stays green; only e2e would notice, and only for the "valid signature rejected" direction, not "invalid signature accepted".
Reproduction: n/a (static).
Fix: unit test that does NOT mock `stripe.webhooks`: build a payload, sign with `Stripe.webhooks.generateTestHeaderString({payload, secret})`, assert 200 for the good signature, 400 for the same payload with a flipped byte and for a signature made with another secret, and that no write happens. Plus `expect(constructEvent).toHaveBeenCalledWith(rawBody, 'sig', 'whsec_test')` in the existing file.
Status vs audit 7: NEW (A7-TEST-03 was livemode/checkout, now fixed; this is the signature path).

### A8-TEST-02  LOW  CONFIRMED  Allergen/diet oracle: vocabulary still misses common words, and the recipe NAME is never scanned
The oracle is much better than in audit 7 (see section 3): it now reads `ingredientes_principales` AND `pasos_resumen`, has an exceptions table, 14-allergen vocabulary, reverse diet checks (sin_gluten/sin_lactosa/sin_huevo/vegano/vegetariano/halal/kosher/keto/paleo/bajo_fodmap), a hosted nightly audit (`hosted-catalog-allergen-audit.yml`) and a parity test. It still reports 0 problems on all 658 live active recipes, and my text probes of the live data found no real defect, so there is no live harm today. What it does NOT check (probe `probe.ts`, bare ingredient list, all MISSED):
1. Egg words: `tortilla de patatas`, `revuelto`, `clara`, `yema`, `omelette` (`huevo` keyword list has `huevos?|mayonesa|crepes|bizcocho|...` only).
2. Gluten words: `wrap`, `penne`, `gyoza`, `bocadillo`, `sandwich`, `empanadilla`, `tempura`, `croqueta`, `udon`, `soba`, `tagliatelle` (list has pasta/espaguetis/macarrones/fideos but not shapes).
3. Lactose: `cheddar`, `emmental`, `manchego`, `gorgonzola`, `helado`, `gouda`, `brie` (only `queso` as a word catches them when "queso" is written).
4. Tree nuts: `pecanas`, `macadamia` (list: nueces/almendras/avellanas/pistachos/anacardos/pinones).
5. Mustard: `dijon`. Fish: `worcestershire`, `nuoc mam`, `salsa de pescado`. Sulfites: dried apricot/fig. Celery: `apionabo`.
6. The `nombre` field is never read (`sourcesOf` at lines 177-182 uses ingredients and steps only): "Albondigas en salsa" (slug `albondigas-en-salsa-al-estilo-mediterraneo-con-guarnicion-de-temporada`, live) has `alergenos: []`, `sin_gluten: true`, ingredients `ternera picada; tomate; cebolla` and no bread or egg anywhere. A meatball is made with breadcrumbs and egg by definition; the oracle cannot say so. (Live data shows the other two meatball recipes do list `pan rallado`/`huevo`.)
7. Vegetariano with miel is allowed by design (only vegano checks honey); `salsa worcestershire` (anchovy) passes as vegetariano.
8. Ingredient lists are "principales": anything not listed (pan rallado inside a croqueta) is invisible to a text oracle by construction. Only a human or an ingredient-level data model closes that.
Could a test close each gap? Items 1-5 and 7: yes, add the words and one row each in `recipe-allergen-diet-rules.unit.test.ts` (runs without a stack). Item 6: yes, a small `nombre`-implied table (albondigas/croquetas/empanadillas -> gluten+huevo unless the list names an alternative; carbonara -> huevo+lactosa), scanning the name. Item 8: no.
Status vs audit 7: STILL-OPEN in part of A7-TEST-01 (the hummus, soy-in-steps, stock and sulfite cases are fixed).

### A8-TEST-03  LOW  CONFIRMED  Daily Turnstile widget check watches staging only
Evidence: `.github/workflows/login-widget-check.yml` cron `23 6 * * *`, `LOGIN_WIDGET_URL: ${{ inputs.url || 'https://fresco-pre.vercel.app' }}`; production is a manual `workflow_dispatch` input ("Run it by hand ... to check production before a launch"). `NEXT_PUBLIC_*` values live in per-environment Vercel scopes (project memory: not in every build scope), so a missing or wrong site key in the Production scope leaves staging green.
Impact: users of fresco-pro could be locked out of /login and /signup while the only automated login-widget gate is green.
Fix: second matrix entry for `https://fresco-pro.vercel.app` (plain GET + one Chromium page load, no writes, inside the 40-requests-style budget of a daily run).
Status vs audit 7: PARTIAL of A7-TEST-06 (the check exists and works; production is not in it).

### A8-TEST-04  LOW  PLAUSIBLE  `test:random` failed once in 4 local runs (1 fail, 5505 pass), name not captured
Evidence: first run printed `5505 pass / 656 skip / 1 fail`, `29386 expect() calls` (the plain run has 29397), so a single test with 11 expectations failed or aborted. Runs with seeds 2905814687 and 3119389050 were 0 fail. The first run's output was only tailed, so I cannot name the test or the seed; I did not reproduce it (run 4 was still running when I wrote this; if it reports a fail the log is `random4.log`/`random3.log` in this folder). The stderr of the plain run also shows a stack trace from `app/api/stripe/pro-price/route.test.ts:172` (expected error-path noise, unmarked).
Impact: audit 6 had order dependence; a rare red random run could be the same class or a timeout under `--parallel`.
Fix: have `test-randomized.yml` upload the full log and seed as an artifact on failure (it already prints the seed in the summary), and triage the next red run.
Status vs audit 7: NEW (audit 7 saw 3 green random runs).

### A8-TEST-05  LOW  CONFIRMED  Coverage denominators leave out root-level source files
Evidence: `scripts/check-coverage.ts` `SOURCE_DIRS = ['app','components','lib','supabase/functions']`. `proxy.ts` (the auth/redirect gate), `instrumentation.ts`, `instrumentation-client.ts`, `sentry.*.config.ts` at repo root are counted only if some test imports them (`proxy.test.ts` does), and are never added as "unloaded" if a test is deleted. The honest figure is 92.5 % floor (not 92.0 as in the audit brief; doc block at the file says 92.5 after tranche 7 closed).
Impact: removing `proxy.test.ts` would not move the honest figure.
Fix: add `proxy.ts` and the root `instrumentation*.ts` to the unloaded scan (explicit file list).
Status vs audit 7: NEW (A7-TEST-07 itself is FIXED: honest 58.7 % -> floor 92.5 %).

### A8-TEST-06  INFO  CONFIRMED  Tautological and blessing tests from A7-TEST-08 still there
`lib/api/meal-plan.test.ts:244` `expect(captured!.args.p_semana_iso).toEqual(getIsoWeek())` unchanged; `fast-check` still used in exactly one file (`supabase/functions/generate-meal-plan/menu-selector.test.ts`), no property test for shopping-list quantity scaling. STILL-OPEN A7-TEST-08 / item 5.

## (3) A7 findings re-verified
| A7-ID | Verdict | Evidence |
|---|---|---|
| A7-TEST-01 oracle blind to steps/hummus/soy | FIXED (residual vocabulary gaps -> A8-TEST-02) | `rules.ts:8` header "ingredientes_principales AND pasos_resumen together"; `sesamo` has `hummus|humus` (:54), `apio` has `caldo` (:57), soja in gluten (:43), sulfitos vino/vinagre/pasas (:56), EU-14 fish/mollusc/crustacean lists widened; live run: 658 rows, 0 problems; the A7 hummus/pad-thai/stock rows are corrected in the data |
| A7-TEST-02 copy_meal_plan allergen bypass untested | FIXED | `tests/db/copy-meal-plan-filters.test.ts:80-125` (gluten profile, ruled-out recipe left empty with warning, safe one copied); `supabase/tests/meal_plan_insert_writers_use_filter.test.sql` enumerates writers via `pg_proc` introspection |
| A7-TEST-03 Stripe livemode + double checkout | FIXED | webhook `route.ts:131` `judgeStripeEventMode(claims, event.livemode)`, 16 `livemode` hits in the test; checkout `route.test.ts:290-342` asserts `idempotencyKey` and a two-call case; `lib/billing/stripe-mode.test.ts` |
| A7-TEST-04 generate-meal-plan no handler test | FIXED | `supabase/functions/generate-meal-plan/index.test.ts` (24 tests incl. 422 filter error, lapsed Pro treated as free, 409/23505, 403/23514); same for generate-shopping-list, get-shopping-list-suggestions, delete-catalog-recipe; `tests/db/edge-functions/generate-meal-plan.test.ts:112-120` sesamo profile -> zero sesamo recipes |
| A7-TEST-05 diet filter untested | FIXED | `tests/db/diet-filter.test.ts` (flags narrow, combine, vegano implies vegetariano, inactive recipe returned to nobody) |
| A7-TEST-06 real login/Turnstile unchecked | FIXED for staging, PARTIAL overall | `login-widget-check.yml` daily + `scripts/check-login-widget.ts`; production only by hand -> A8-TEST-03 |
| A7-TEST-07 coverage ratchet false comfort | FIXED | floors now functions 93.0 / lines 96.0 / honest 92.5 (`check-coverage.ts:113,:~160`); type-only decided by content (`isTypeOnly`), fixtures excluded by `isTestSupport`; residual root-file gap -> A8-TEST-05 |
| A7-TEST-08 mock-only/tautology examples | STILL-OPEN (INFO) | `meal-plan.test.ts:244` unchanged; A8-TEST-06 |
| A7-TEST-09 no job timeouts | FIXED for timeouts | `timeout-minutes` at pr-check.yml lines 31 (15), 65 (15), 92 (10), 124 (25), 208 (30), 391 (8). Cleanup-swallow in `tests/test-user-factory.ts` not re-opened (not verified) |
| A7 item "stripe-e2e continue-on-error" | CLEARED | the only `continue-on-error: true` is the warm-up step; the suite step has none |
| A7 TEST rows of consolidated.md | consistent with the above | no row contradicted by the code now |

## Mutation-style spot check (read only, I did not edit anything)
| Function | Core line removed | Does a test go red? |
|---|---|---|
| Allergen filter `get_filtered_recipes` (`...20261017155115_tag_apio_on_stock_and_unify_miso.sql:58-59`, the `alergenos &&` predicate) | delete it | YES in CI (`allergen-vocabulary.test.ts:61` mostaza/altramuces, `edge-functions/generate-meal-plan.test.ts:112-120` sesamo, `@seguridad-alimentaria` e2e). NOT in plain `bun test` locally: those are DB-gated (skipped). Only two or three allergens are pinned by name; the predicate is generic so a per-allergen regression is unlikely |
| Plan gating `isProEntitlementActive` | delete `paidTier`, `lapsed`, or `!graceActive` | YES, each by its own test (`entitlement.test.ts` lines 14, 30, 34, 38-54). `<` -> `<=` at `plan_expires_at == now` survives (equivalent in practice, ms granularity); INFO |
| Webhook signature check (`route.ts:115`) | change arguments of `constructEvent` | NO in unit (A8-TEST-01); deleting the try/catch -> 1 test red |
| Consent writer (`app/api/consents/route.ts`, `recordConsents`) | take `user.id`/version from body | YES: `route.test.ts:70-81` `toEqual` on the RPC args and "ignores a version or user_id sent in the body"; DB side `tests/db/user-consents.test.ts` (direct INSERT refused, append-only, 100-row cap) |
| `safeNextPath` | delete backslash guard | YES (`'/menu\\..\\x'` resolves to `/x` -> red). Deleting only the `startsWith('//')` check, or only the `!startsWith('/')` check, or the origin check: stays green because `new URL()` independently rejects each case (redundant defense in depth, equivalent mutants, not a gap) |

## (4) Checklist items that found NOTHING
`.only`, `.skip(`, `test.todo`, `@pendiente`/`@solo-manual`/`@no-implementado` tags in features, `expect(true)`, tests with zero assertions (1 file is a deliberate re-import), snapshot-only tests (5 snapshots, all structural), required-checks list vs `pr-check.yml` job names (repo:check, test:unit, test:e2e, test:db-integration, deno:check all exist), job timeouts, `retries: 1` + flakiness budget still in place (`playwright.config.ts:51-61`), consent writer and safe-next-path assertions.

## (5) Could not verify
- Exact db-integration pass count vs its floor, pgTAP results and e2e green state (need Docker/local Supabase; forbidden here).
- `bun scripts/check-coverage.ts` not run (it writes lcov to a tmpdir via a nested `bun test --coverage`, 3 min); the 93.19 % honest figure is quoted from the file's own log, not re-measured.
- Name and seed of the single failing test in random run 1 (A8-TEST-04).
- Whether `tests/test-user-factory.ts` still swallows cleanup failures (A7-TEST-09 second half).

## (6) secrets_materialized: none
cleaned: yes (only SELECT of public catalogue rows to `recipes.json` in this scratchpad; nothing written in the repo; one stray empty file I created by mistake outside the repo under /private/tmp was removed)

## Addendum (run 4 finished)
A8-TEST-04 upgraded to CONFIRMED, MEDIUM: `bun test --parallel --randomize --timeout 15000 --seed=703177167` = 4 fail, all in the `/update-password current password (FRESCO-1015)` component tests, each hitting the 15 s timeout (15112 ms, 15443 ms, 15135 ms, 9974 ms). Log: random3.log in this folder. Cause not isolated (probably a happy-dom async wait, `waitFor` or a timer, under parallel load). So random runs: 2 of 4 had failures, the same suite family may account for the earlier 1-fail run. Fix: find the unbounded wait in that test file and give it a fake clock or an explicit event; reproduce with `bun run test:random --seed=703177167`.
