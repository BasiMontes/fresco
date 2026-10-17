# Audit 7b - consolidated remediation plan

Commit audited: `1feb6062` (staging, code = main `278d56fd`). Sources: the 13 reports in this folder (`00-brief.md` is the brief). Target epic: FRESCO-986, label `auditoria-7b`. No Jira card was created by this document. Jira lookups were read-only (954 FRESCO issues fetched once with `acli ... --paginate`, then matched by summary text; git log searched with `--grep`).

## 1. Method and counts

Method: every finding ID of the 13 reports was entered in one table (auditor severity, consolidated severity). Duplicates were merged by root cause: the surviving ID keeps the card, the absorbed ID is listed below. Severity rule used for all axes: BLOCKER = allergen/health-safety failure, money loss or unlawful charging, auth bypass, data loss, with evidence in the report (code path, live SELECT or the recipe row itself); a launch-conditional BLOCKER (payments, email) is marked "launch gate". HIGH = serious, fix before launch, but conditional or needs one more fact. Evidence that rests only on an assumed commercial product (stock cube, tamari, curry blend) caps at HIGH/MEDIUM unless the catalogue contradicts itself.

Raw findings (IDs as the auditors classified them; B/H/M/L/I = BLOCKER/HIGH/MEDIUM/LOW/INFO):

| Wave | Axis (IDs) | Total | B | H | M | L | I |
|---|---|---|---|---|---|---|---|
| W1 | AUTHZ 5, PAY 10, SAFEA 48, SAFEB 19 | 82 | 9 | 10 | 37 | 26 | 0 |
| W2 | PRIV 6, API 5, SUPPLY 8 | 19 | 0 | 0 | 6 | 10 | 3 |
| W3 | LOGIC 10, UI 17, TEST 9 | 36 | 0 | 3 | 14 | 18 | 1 |
| W4 | OPS 6, LAUNCH 8, ABUSE 6 | 20 | 0 | 4 | 9 | 6 | 1 |
| Total | | 157 | 9 | 17 | 66 | 60 | 5 |

(All cells counted by script over the 157-row ID table built from the reports' own severity labels; SAFEA's footer says BLOCKER 6, HIGH 5, MEDIUM 23, LOW 14 and SAFEB's 3/2/9/5, which match.)

Deduplicated: 157 raw IDs minus 23 absorbed IDs = **134 consolidated findings**. By consolidated severity: **BLOCKER 10, HIGH 11, MEDIUM 41, LOW 67, INFO 5** (counted by script over the 134 survivors). By auditor severity the same 134 would be B8/H13/M52/L56/I5. Re-classification: 11 raised, 26 lowered (37 changes, section 2).

Duplicates and extensions merged (absorbed ID -> survivor):
- Cross-report: A7-OPS-03 -> A7-LAUNCH-01; A7-OPS-01 -> already tracked (FRESCO-935, FRESCO-951); A7-API-01 -> A7-PRIV-03 (waitlist); A7-TEST-02 -> A7-AUTHZ-01 (same bypass, the test gap that let it through); A7-TEST-03 -> A7-PAY-01 and A7-PAY-02 (no test pins livemode or double checkout); A7-UI-07 -> A7-LOGIC-06 (search without accents); A7-UI-12 -> A7-LOGIC-04 ("today" mark on every week); A7-ABUSE-03 -> A7-API-02 (same column grant on `user_consents`: forged version vs unlimited rows); A7-OPS-04 -> A7-ABUSE-02 (hosted Auth email quota); A7-SAFEB-10 -> A7-SAFEA-34 (stock without celery); A7-SAFEB-13 -> A7-SAFEA-47 (tamari as gluten-free); A7-SAFEB-02 -> A7-SAFEA-42 (miso without gluten).
- Same report: A7-UI-08 -> A7-UI-05; A7-SAFEA-46 -> -02; -21 -> -16; -43 -> -28; -36 -> -20; -30 -> -18; A7-SAFEB-03/04/05/06/07 -> A7-SAFEB-14 (paleo rows).
- Overlaps kept as separate IDs but one card: PAY-08 with LAUNCH-04/05 (go-live prerequisites); PRIV-02 with PRIV-01 and API-02 (consent register); LOGIC-08 with LAUNCH-03 (allergen promise vs unused free text); AUTHZ-02 with AUTHZ-03 and LOGIC-10 (learning counters); SAFEA-35 with SAFEA-34 (same stock recipes seen as a vegetarian claim).

Coverage and figures:
- `revision-alergenos-2026-10-16.csv`: 538 data rows (header excluded; `wc -l` 539). `tiene_alergeno` = `si` 371, `no` 167 (rg count of the third field). Columns `alergenos_correctos`, `dieta_correcta`, `correccion`, `revisada_por_fecha` are empty in 538 of 538 rows (`rg -c ',""$'` = 538), i.e. no human sign-off yet (tracked: FRESCO-908).
- The "about 150 recipes with a finding" figure, recounted from the SAFEA table (file lines 2-270, 269 recipes) and the SAFEB table (lines 271-539, 269 recipes) by expanding every row to its recipe lines, de-duplicating by CSV line, and putting each recipe in one bucket:
  - A. Allergen declaration or allergen-free claim wrong (a missing allergen tag, or `sin_gluten`/`sin_huevo`/`sin_lactosa` true against the recipe text): **91 recipes** (SAFEA 57 + SAFEB 34). Of these, 58 depend on an assumed product (27 stock-without-apio: SAFEA-34 lists 23, SAFEB-10 lists 4; 31 tamari-as-gluten-free: SAFEA-47 lists 13, SAFEB-13 lists 18) and 33 are other (hidden sub-recipe, curry/mustard, miso, mayonnaise, vinegar, sauces). Only 4 recipes are confirmed from the row text alone: hummus without sesamo (SAFEB-01), moussaka bechamel without gluten (SAFEA-27), two pad thai rows (SAFEA-32, -33).
  - B. Diet tags the repo oracle never covered, `paleo`/`keto`/`bajo_fodmap` true against the ingredients: **56 recipes** (SAFEA 33 = 16 paleo + 16 bajo_fodmap + 1 keto-only; SAFEB 23 = 14 paleo + 9 bajo_fodmap; the SAFEB keto rows are inside its paleo list). SAFEA's own systematic table says "15" bajo_fodmap but lists 16 line numbers; I counted the list.
  - C. Other diet or religious flags (halal with mixed/unspecified minced meat, kosher with wine, vegetariano with animal-rennet cheese or unspecified stock where not already in A, teriyaki, dashi): **9 recipes**.
  - D. Ingredient list or tag incomplete with no flag flipped (over-tag, tag without a listed ingredient): **6 recipes**.
  - A and B overlap on 4 recipes (L51, L99, L183 in SAFEA; L272 in SAFEB). Union A+B+C+D = 91 + 56 - 4 + 9 + 6 = **158 recipes**, which is the "about 150": it mixes buckets A and B (and C, D). The auditors' own distinct counts differ slightly (SAFEA says ~95 for its slice, SAFEB gives 63 row flags that I could not reproduce: its IDs expand to 65), because they counted flags, not recipes.
- Not reproduced elsewhere: TEST-01 ran the repo oracle over the 538 live active rows and got 0 problems (the oracle reads `ingredientes_principales` only), and found 11 stock recipes without apio plus 2 sulfitos candidates by a vocabulary delta; LAUNCH-03's keyword cross-check found only false positives (coconut, almond milk). The differences are definitional (ingredient column only vs recipe steps, stock counted or not), not contradictions.
- Coverage: TEST-07 reports loaded lines 88.95 % (floor 88.7), honest lines 58.69 % (floor 54.5 %), 140 unloaded files. The 2026-10-12 critical audit (C-12) gave 49.6 % honest; FRESCO-916 (Finalizada) raised the floor, so the trend is up but the CI headline still reads ~89 %.
- One premise in a report is stale: LAUNCH-03 says Fresco "covers 12" allergens and that mustard/sulphites cannot be declared. Migration `20261013120000_add_mustard_and_lupin_to_allergen_vocabulary.sql` declares 14 slugs (incl. `mostaza`, `altramuces`, `sulfitos`) and A7-AUTHZ-04 also sees 14 slugs live. The claim problem in LAUNCH-03 stands for other reasons (catalogue unreviewed, trazas not modelled, free text ignored).

## 2. Severity re-classification

Changed rows (37). "Disagree" = I differ from the auditor and why.

| ID | Auditor | Consolidated | Justification |
|---|---|---|---|
| A7-AUTHZ-01 | H | B | Confirmed live function body: a DEFINER RPC re-plants slots with no `get_filtered_recipes`; it breaks the single enforcement point (ADR-0001's moat aside, the food-safety promise). Reachable by any user after changing allergens or after a retag. |
| A7-PAY-01 | H | B (launch gate) | One DB, public `fresco-pre`, no `livemode` check in code (`rg livemode` hits only docs): once live keys are on, anyone gets production Pro with a test card. PLAUSIBLE only because live keys are not on; nothing else is missing. |
| A7-PAY-02 | H | B (launch gate) | Double charge to a real customer plus a documented support action (refund) that cancels the wrong subscription is money loss and unlawful charging; refund mis-targeting CONFIRMED by code. |
| A7-PAY-08 | M | H | Missing portal configuration in live mode means users cannot cancel on day one; no go-live checklist exists. |
| A7-OPS-03 / A7-LAUNCH-01 | H | B (launch gate) | Charging real users with no deliverable legally required confirmation (sender `onboarding@resend.dev`, own code comment says customers will not receive it) and failure only `console.error`. Blocked on FRESCO-886. |
| A7-SAFEB-10 (into SAFEA-34) | H | B | Same pattern as SAFEA-34; the catalogue contradicts itself (3 stock-only recipes tag `apio`, 23+4 do not), over-tagging is harmless, under-tagging is not. Disagree with SAFEB's cap at HIGH. |
| A7-SAFEA-09 | B | H | Croissant "bought": egg depends on the product, not on recipe text. Disagree with BLOCKER. |
| A7-SAFEA-42, A7-SAFEB-02 | B | H | Miso barley depends on the product; but the catalogue tags miso as gluten in a sibling, so keep HIGH, not MEDIUM. Disagree with BLOCKER. |
| A7-SAFEA-20 (and -36) | H | M | Kosher is a label only: TEST-05 shows no profile filter exists for kosher; certified-wine nuance. Disagree with HIGH. |
| A7-SAFEA-35 | H | M | Vegetarian flag with unspecified stock: ethical flag, no allergen, depends on product. |
| A7-SAFEA-47 (and SAFEB-13) | L / M | M | 31 recipes `sin_gluten=true` with tamari, fix is one rule; coeliac impact if the brand has wheat. Raised SAFEA's LOW to match SAFEB. |
| A7-SAFEB-09 | H | M | Curry-blend mustard is an assumption; consistent with SAFEA-07/24 (LOW). Disagree with HIGH. |
| A7-SAFEA-04, 05, 10, 12, 13, 15, 16, 21, 28, 29, 38, 43; SAFEB-03, 04, 05, 06, 14 | M | L | `paleo` and `bajo_fodmap` are catalogue labels; the 7 profile filters are vegano, halal, keto, sin_gluten, sin_lactosa, sin_huevo, vegetariano (`20260901073555_allergen_filter_safety_net.sql:77-83`, via TEST-05). No allergen or profile filter is wrong. Disagree with MEDIUM. `keto` rows (SAFEA-03, -14, -39, -44, SAFEB-15) stay MEDIUM because keto IS a profile filter. |
| A7-PRIV-02 | M | H | 9 of 9 registered accounts have no `terms`/`privacy`/`age_14` row and nothing re-asks; the open fact (does the live `/signup` write them) must be proven before launch. Not BLOCKER: the evidence does not show the signup path failing, only that no real signup post-dates the registry. |
| A7-API-02 (with ABUSE-03) | L / M | M | Same grant lets a user forge versions and insert unlimited rows into the legal register. |
| A7-LOGIC-08 | M | H | A box asking for restrictions ("celiaca", "sin cerdo") is stored and ignored; for a medical restriction this breaks the allergen promise. Fix is cheap (relabel or match). |
| A7-UI-15 | M | L | FRESCO-373 (Finalizada) already added undo; residual is a 5 s window. No data loss. |
| A7-TEST-07 | M | L | FRESCO-916 raised the honest floor; the headline is the residual. |

Unchanged (auditor severity = consolidated):
- BLOCKER (6): SAFEA-08, SAFEA-27, SAFEA-32, SAFEA-34, SAFEB-01, SAFEB-08.
- HIGH (7): SAFEA-01, SAFEA-33, LOGIC-01, TEST-01, TEST-02 (absorbed into AUTHZ-01), LAUNCH-03, ABUSE-02.
- MEDIUM (44): AUTHZ-02, AUTHZ-05, PAY-03, PAY-04, SAFEA-02, -03, -11, -14, -22, -23, -37, -39, -44, -45, -46, SAFEB-11, -12, -13, -15, PRIV-01, PRIV-03, API-01, API-04, SUPPLY-01, LOGIC-02, -03, -06, -07, UI-05, UI-07, UI-10, TEST-03, -04, -05, -06, OPS-01, -02, -04, LAUNCH-02, -04, -05, -07, ABUSE-01, ABUSE-03.
- LOW (58): AUTHZ-03, -04, PAY-05, -06, -07, -09, -10, SAFEA-06, -07, -17, -18, -19, -24, -25, -26, -30, -31, -40, -41, -48, SAFEB-07, -16, -17, -18, -19, PRIV-04, -05, -06, API-03, -05, SUPPLY-02..05, LOGIC-04, -05, -09, -10, UI-01, -02, -03, -06, -08, -09, -11, -12, -13, -14, -16, -17, TEST-08, -09, OPS-05, LAUNCH-06, -08, ABUSE-04, -05, -06.
- INFO (5): SUPPLY-06, -07, -08, UI-04, OPS-06.

Where I agree with the auditors against a possible downgrade: AUTHZ-02 (global ranking from one account) stays MEDIUM, it is PLAUSIBLE but every step is read in code; PAY-04 (disputes) stays MEDIUM; PAY-03 (frozen fresco-dev webhook writer) stays MEDIUM today and becomes part of the PAY-01 surface at go-live; ABUSE-06 stays LOW (accepted tradeoff, ADR-0030/0031).

Consolidated BLOCKER clusters (10 IDs, 6 clusters): (1) AUTHZ-01 reused-menu bypass; (2) confirmed catalogue allergen omissions: SAFEA-08, -27, -32, SAFEB-01, -08; (3) stock without celery: SAFEA-34 (+SAFEB-10); (4) PAY-01 live keys on shared DB; (5) PAY-02 double checkout and refund mis-targeting; (6) LAUNCH-01 confirmation email.

## 3. Proposed Jira cards (25), epic FRESCO-986, label `auditoria-7b` plus the wave label

Wave labels: `ola-0` (safety and charge gates, do first), `ola-1` (before real users arrive), `ola-2`, `ola-3` (polish). Priority = consolidated. Effort S < 0.5 day, M 1-2 days, L > 2 days. Cards are children of FRESCO-986; the existing epics FRESCO-884 (launch), FRESCO-867 (catalogue), FRESCO-869 (flows), FRESCO-868 (maintenance) are cross-links only.

### Theme A: allergens and diet tags of the catalogue

**1. Seguridad alimentaria | «Usar este menú» vuelve a aplicar el filtro de alérgenos, dieta y receta inactiva** - Bug, `ola-0`, BLOCKER, closes A7-AUTHZ-01 (+A7-TEST-02), effort M.
- AC: DB test (pgTAP or tests/db, real session): profile `alergenos=['gluten']`, source plan holds a gluten recipe, `copy_meal_plan_to_week` leaves that slot empty (`pendiente`) or `excluida` and writes an `advertencias` entry; an inactive recipe is not copied.
- AC: `rate_limit_endpoints` has a row for `copy_meal_plan_to_week` and the call past the limit fails.
- AC: a table-driven DB test lists, by introspection of `pg_proc`/`pg_get_functiondef`, every function that inserts into `meal_plan_recipes` and fails when one has no `get_filtered_recipes` path.
- Deps: forward-fix migration (no down); applied through the usual push path, then `supabase migration list --linked`. Relates FRESCO-427, FRESCO-736.

**2. Catálogo | Corregir los alérgenos omitidos y confirmados en recetas activas (hummus, moussaka, pad thai, crepes, tarta de limón)** - Bug, `ola-0`, BLOCKER, closes A7-SAFEB-01, A7-SAFEA-27, -32, -33, -08, A7-SAFEB-08, A7-SAFEA-09 (croissant, HIGH), effort M.
- AC: after a data migration, `tostada-hummus-pepino` has `sesamo`; moussaka has `gluten` and `sin_gluten=false`; both pad thai rows have `soja` and `gluten` and `sin_gluten=false`; crepes-de-espinacas-y-queso-b124, tarta-de-limon-b145 (and croissant-jamon-queso) have `huevo` and `sin_huevo=false`, or the missing sub-ingredient is added to `ingredientes_principales` and tagged.
- AC: card 6's extended oracle fails on the pre-migration data and passes on the migrated data (red first).
- AC: `supabase/seed.sql` carries the same corrections (TEST-01 found the wrong rows there too).
- Deps: after card 6's red test; same table as 3-5, so serialize. Relates FRESCO-943 (earlier tag fix), FRESCO-908.

**3. Catálogo | Etiquetar `apio` en toda receta con caldo y decidir la regla del miso** - Bug, `ola-0`, BLOCKER, closes A7-SAFEA-34 (+SAFEB-10), A7-SAFEA-35, A7-SAFEA-42 (+SAFEB-02), A7-SAFEB-12 (dashi in miso soup), effort M.
- AC: every active recipe whose ingredients or steps contain `caldo` carries `apio` (27 recipes named in SAFEA-34 and SAFEB-10, count re-derived by query, not by this list); the rule is written once and pinned by the oracle.
- AC: miso recipes are consistent: the same ingredient gives the same `gluten`/`sin_gluten` result in `sopa-miso-con-edamame`, `sopa-miso-tofu-algas`, `sopa-miso-con-tofu-b47`, `crema-de-setas-con-miso-b57`.
- AC: vegetarian/vegano recipes with unspecified stock say "caldo de verduras" in the ingredient list or lose the flag (A7-SAFEA-35, 7 recipes).
- Deps: serialize after card 2. Decision needed from Basi: over-tag by rule (recommended: over-tagging is the safe error) vs name a stock product.

**4. Catálogo | Segunda pasada de alérgenos en productos compuestos y `sin_gluten` con tamari** - Task, `ola-1`, MEDIUM, closes A7-SAFEA-07, -11, -17, -19, -22, -23, -24, -25, -26, -31, -40, -41, -47 (+SAFEB-13), A7-SAFEB-09, -11, -18, -19, A7-SAFEA-48, -06, -18, effort L.
- AC: curry, mayonnaise, barbacoa, vinegar, raisins, beer, nachos, sushi rice, curry paste, tamari recipes are each either tagged (`mostaza`, `sulfitos`, `gluten`, `crustaceos`) or the ingredient names a free-of product ("tamari sin gluten").
- AC: for the 31 tamari recipes the ingredient says "tamari sin gluten" or `sin_gluten` is false.
- AC: recipes whose steps use an unlisted item (crema de limón, salsa de soja, bechamel) list it; query "steps mention X, ingredients do not" returns 0 for the keyword list.
- Deps: human review FRESCO-908 consumes the same CSV; do not run both on the same rows at once.

**5. Catálogo | Etiquetas de dieta (keto, paleo, bajo en FODMAP, halal, kosher, vegetariano) que no cumplen su definición** - Task, `ola-2`, MEDIUM (keto/halal) and LOW (paleo/FODMAP), closes A7-SAFEA-01, -02 (+46), -03, -14, -20 (+36), -37, -39, -44, -45, A7-SAFEB-15 and the LOW paleo/FODMAP rows (SAFEA-04, -05, -10, -12, -13, -15, -16, -28, -29, -38; SAFEB-14, -16, -17), effort L.
- AC: no recipe has `keto=true` with potato, banana, quinoa, wheat tortilla, seitan or more than a small dairy/fruit amount (rule written in the oracle).
- AC: `halal=false` for any recipe with unspecified or mixed minced meat unless the ingredient names the meat; `kosher=false` with wine unless certified; `vegetariano=false` with PDO Parmesan/Gruyère unless "vegetariano" cheese is named.
- AC: paleo and bajo_fodmap are either corrected by rule (grain, dairy, legume, garlic, asparagus, cauliflower, mushrooms, leeks) or removed from the catalogue filter until reviewed.
- Deps: after cards 2-4. Product decision: keep or retire `paleo`/`bajo_fodmap` as labels (cheaper).

**6. Tests | El oráculo de alérgenos lee ingredientes y pasos, usa el vocabulario completo de la UE y se ejecuta contra el catálogo real** - Task, `ola-0`, HIGH, closes A7-TEST-01, effort M.
- AC: unit test (no stack) with one row per gap: hummus, salsa de soja, caldo, vinagre/pasas, curry, miso, tamari, steps-only sub-ingredient, plus the reverse check (diet flag true while a breaker keyword appears).
- AC: the oracle scans `pasos_resumen` and `ingredientes_principales` together, with the species lists of fish, molluscs, crustaceans and cereals.
- AC: a nightly or pre-promotion job runs the coherence test against a read-only dump of the hosted catalogue and fails the run on any hit.
- Deps: none. Relates FRESCO-908 (owner review), FRESCO-943.

**7. Seguridad alimentaria | Que la promesa de la web y del onboarding diga lo que la app hace** - Story, `ola-0`, HIGH, closes A7-LAUNCH-03, A7-LOGIC-08, effort S.
- AC: the landing FAQ no longer says "nunca" or "absolutos" (copy lint test fails on those words in `faq-data.ts`); the replacement states which allergens are excluded and that the user must read the label.
- AC: a persistent allergen disclaimer is present in menu, recipe detail and onboarding (e2e asserts it).
- AC: the two onboarding free-text boxes either filter (matched against `ingredientes_principales` in `get_filtered_recipes`) or say next to the input that they are not used for filtering and point to the chips.
- Deps: none; copy can ship before the data cards.

### Theme B: payments

**8. Pagos | Rechazar eventos de Stripe de otro modo y cortar el efecto de pre y de dev sobre producción** - Bug, `ola-0`, BLOCKER (launch gate), closes A7-PAY-01, A7-PAY-03 (+A7-TEST-03 livemode part), effort M.
- AC: webhook unit test: a `livemode:false` `checkout.session.completed` handled with a live-mode configuration writes nothing and answers a refusal; the inverse for a test-mode environment.
- AC: grant and checkout store the mode with the Stripe ids and refuse a mismatch; production profile rows never take ids of a test-mode customer.
- AC: the fresco-dev webhook endpoint is disabled in Stripe (or points at a current deploy) and a release-checklist line says every Stripe endpoint targets a deploy at the current SHA.
- Deps: owner action in the Stripe dashboard (endpoint). Splitting the Supabase project (the structural fix, ADR-0020 reopen trigger, FRESCO-911) needs Supabase Pro = spending; the livemode guard is the no-spend path. Needs an ADR for the guard (next number after ADR-0060).

**9. Pagos | Evitar dos suscripciones por doble checkout y que un reembolso cancele la suscripción equivocada** - Bug, `ola-0`, BLOCKER (launch gate), closes A7-PAY-02 (+A7-TEST-03 double checkout part), A7-PAY-05, A7-PAY-09, effort L.
- AC: route test: with a live subscription on the customer, checkout answers 409; two concurrent POSTs create one session per idempotency key; sessions carry a short `expires_at`.
- AC: refund handler resolves the charge's own subscription and ignores a refund for a different subscription than the stored one (unit test).
- AC: `handleSubscriptionUpdated` and `deleted` decide on the live subscription (`subscriptions.retrieve`), so a late `active` snapshot after `deleted` writes nothing; transient errors (Stripe 5xx, connection) answer 500 so Stripe retries.
- Deps: relates FRESCO-890 (Listo, refund e2e), FRESCO-900.

**10. Pagos | Endurecer el cobro: disputas, gracia acotada, waiver exigido por el servidor, checkout sin perfil, límites de precio y portal** - Task, `ola-1`, MEDIUM, closes A7-PAY-04, -06, -07, -10, A7-API-04, effort L.
- AC: `charge.dispute.created` cancels that charge's subscription and reports to Sentry (unit test).
- AC: entitlement unit test "past_due for 30 days is not entitled"; the checkout route returns 400 without a recent `withdrawal_waiver` row and 409 when the profile is missing.
- AC: `/api/stripe/pro-price` reads from the cached `readProPrices()` (at most one Stripe call per cache window) and `/api/stripe/portal` has a per-user rate limit.
- Deps: events must be subscribed in the Stripe dashboard (owner).

**11. Lanzamiento | Lista de paso a modo live: portal, IVA, desistimiento, dunning y claves por entorno, con script de verificación** - Task, `ola-1`, HIGH, closes A7-PAY-08, A7-LAUNCH-04, A7-LAUNCH-05, effort M.
- AC: `docs/workflows/stripe-go-live.md` lists every live prerequisite (portal default configuration, webhook events incl. dispute, dunning setting, price `tax_behavior`, env vars by name per Vercel scope and Supabase secrets).
- AC: a read-only script exits non-zero on any missing item.
- AC: Terms and checkout summary state how to exercise the 14-day withdrawal (channel, period, model text); landing, summary and email always print "IVA incluido" when the Price is inclusive.
- Deps: owner (Stripe dashboard, autónomo/VAT status FRESCO-911/883); no spending by itself.

**12. Pagos | La confirmación de suscripción debe llegar al cliente o dejar rastro y alerta** - Bug, `ola-0`, BLOCKER (launch gate), closes A7-LAUNCH-01 (+A7-OPS-03), A7-LAUNCH-02, effort M.
- AC: a rejected send calls Sentry with tag `email: subscription-confirmation` and writes a pending marker that the reconcile cron retries (unit test).
- AC: the template states the interval (monthly or annual) and, for a card-less trial, "hoy 0 €, primer cobro de X el <fecha>" (snapshot test month/year/trial).
- AC: the launch gate "verified sender domain before live Stripe" is written in the go-live checklist (card 11) and real delivery to a non-owner address is verified once the domain exists.
- Deps: **FRESCO-886 (domain, Blocked, no-spend rule)**; root cause stays there, this card only makes failure visible and the content correct. Free interim option: send the durable-medium text from the already-working Gmail SMTP path or show and store it in-app (owner decision).

**13. Auth | Proteger con captcha y límite el cambio de correo del invitado y documentar la cuota de correos** - Bug, `ola-1`, HIGH, closes A7-ABUSE-02 (+A7-OPS-04), effort M.
- AC: step 1 of progressive signup goes through a server route that verifies a Turnstile token and calls `check_and_increment_rate_limit` (missing token gives 400, fourth call per hour gives 429).
- AC: hosted "minimum interval between emails" and hourly email limit are read in the dashboard and written in ADR-0021; a PostHog alert exists for `otp_failed` with `over_email_send_rate_limit`.
- Deps: owner (hosted Auth dashboard). Moving off Gmail SMTP needs a domain (FRESCO-886). Relates FRESCO-907.

### Theme C: consents and legal pages

**14. RGPD | Registrar términos, privacidad y edad en cuentas existentes, volver a pedirlos al subir la versión y blindar el registro** - Story, `ola-1`, HIGH, closes A7-PRIV-02, A7-PRIV-01, A7-API-02 (+A7-ABUSE-03), effort L.
- AC: a real e2e signup on a local stack produces `terms`, `privacy` and `age_14` rows after confirmation.
- AC: bumping `LEGAL_TEXTS_VERSION` makes the authenticated layout show a blocking re-consent dialog for users whose rows are older (integration test); the cookie decision carries version and date and the banner reappears on a policy bump.
- AC: direct PostgREST insert into `user_consents` is refused (revoked grant), writes go through a DEFINER function that stamps the server version; one user cannot exceed a per-user row cap.
- Deps: legal wording belongs to the lawyer review (FRESCO-434 closed; texts still provisional). No spending.

**15. RGPD | Lista de espera con aviso, doble confirmación y límite, y política alineada con los datos reales** - Task, `ola-1`, MEDIUM, closes A7-PRIV-03 (+A7-API-01), A7-PRIV-04, -05, -06, A7-LAUNCH-06, effort L.
- AC: the privacy policy has a "Lista de espera" paragraph (purpose, basis, retention, how to leave); `waitlist_signups` is insert-only through a function that stamps the server version, with a per-IP limit on the route and a confirmation step (only confirmed rows are mailed).
- AC: the policy says what the guest cleanup really does (3 days from creation) and the cleanup queues the PostHog erasure for each deleted guest.
- AC: the `sexo` field is removed or used and listed in the policy; the consent text names religious belief for `dieta_halal`; Sentry is declared in the cookie table (or gated).
- Deps: lawyer review for wording; relates FRESCO-922 (recorded the waitlist surface as left open).

### Theme D: shopping list, budget, search, menu

**16. Lista de la compra | Precio por unidad correcto, una sola línea por ingrediente y presupuesto por personas** - Bug, `ola-1`, HIGH, closes A7-LOGIC-01, A7-LOGIC-02, A7-LOGIC-03, effort L.
- AC: table test: for every price-override key and every unit the catalogue uses, a line of up to 1 kg prices under a sane bound (no 175 € yogurt); a DB check that every (name, unit) pair in `ingredientes_cantidades` has a priced path.
- AC: the same ingredient in `g` and `unidades` consolidates to one line; 1 cucharada of fresh herb is not 15 g.
- AC: `selectMenu` with `num_personas: 4`, 21 `medio` slots, budget 150 produces the over-budget advertencia; `num_personas: 1` unchanged.
- Deps: relates FRESCO-875/ADR-0042.

**17. Lista de la compra | Que los cambios posteriores (sustitución, descarte, receta nueva) lleguen a la lista** - Story, `ola-2`, MEDIUM, closes A7-LOGIC-07, effort L.
- AC: after an ingredient substitution or recipe replacement, the list is rebuilt keeping `comprado` flags and user-added items, or flagged stale with "Actualizar lista".
- AC: slots already `descartada`/`excluida` at generation time do not contribute ingredients.
- AC: the substitution and replacement flows tell the user what happened to the list.
- Deps: product decision rebuild vs stale flag.

**18. Recetas | Buscar sin tildes y sin comodines** - Bug, `ola-1`, MEDIUM, closes A7-LOGIC-06 (+A7-UI-07), effort S.
- AC: `get_catalog(p_search => 'salmon')` returns the same ids as `'salmón'` (DB test); same for limon, platano, brocoli, champinon.
- AC: searching `%` or `_` does not return the whole catalogue.
- AC: `unaccent` is enabled through a migration (free extension on Supabase) and an immutable wrapper is used.
- Deps: none. Not covered by FRESCO-196 (that was accents in the data).

**19. Menú y aprendizaje | Temporada por semana planificada, respaldo del historial Pro, ranking global no manipulable y señal de valoración** - Task, `ola-2`, MEDIUM, closes A7-AUTHZ-02, A7-LOGIC-05, -09, -10, effort L.
- AC: same user, seed and week with different "now" give the same menu (season derived from `fecha_inicio`).
- AC: when the history exclusion empties a tipo, the selector falls back to unfiltered candidates and does not print the allergy advertencia.
- AC: one user discarding the same recipe in 3 plans increments `veces_descartada` by 1 (per user-recipe feedback table); `copy_meal_plan_to_week` is limited to current/next week.
- AC: decision recorded: add a rating step to "cocinada" or remove the rating weight and path.
- Deps: product decision on rating; shares migration surface with card 1 and 21.

### Theme E: UX and accessibility

**20. Accesibilidad | Nombres accesibles, 404 con landmark, tabla de cookies, encabezados, contraste de lo marcado, vídeo y página offline** - Task, `ola-3`, MEDIUM, closes A7-UI-05 (+UI-08), A7-UI-01, -02, -03, -04, -11, -17, effort M.
- AC: axe e2e on `/calendar`, `/profile`, `/recipes` reports no `label-content-name-mismatch`; slot buttons name the dish and day and start with the visible word.
- AC: axe on `/no-existe-xyz`, `/legal/cookies` at 360 px and `/legal/privacidad` reports no skip-link, scrollable-region or heading-order violation; ticked shopping items reach 4.5:1 in light and dark.
- AC: the landing video shows a visible focus ring and has a Spanish captions track; `offline.html` has a retry button instead of meta refresh.
- Deps: none.

**21. UX | Calendario y lista en móvil: «hoy» correcto, semana válida, abrir en hoy, marcar sin conexión, corregir un marcado y textos coherentes** - Task, `ola-2`, MEDIUM, closes A7-UI-10, A7-UI-06, A7-LOGIC-04 (+A7-UI-12), A7-UI-13, -14, -15, -09, -16, effort L.
- AC: component test: a rejected `toggleShoppingListItem` renders an element with `role="alert"` in view; e2e with `setOffline(true)` keeps the item ticked or queues it.
- AC: `?semana=2026-W99` falls back to the current week; "hoy" appears only in the current week and in Madrid time; mobile opens on today with 44 px day arrows; delete-week text shows the real number of dishes.
- AC: a cooked/discarded mark can be changed within the current week and the snackbar lasts at least 10 s; "Comida" is used everywhere for the midday slot; an expired session redirects to `/login?next=<path>`.
- Deps: relates FRESCO-373.

### Theme F: security, tests, supply chain, abuse and operations, SEO

**22. Seguridad | Quitar permisos de columna y de función que sobran y exigir la contraseña actual al cambiarla** - Task, `ola-1`, MEDIUM, closes A7-AUTHZ-05, A7-AUTHZ-03, A7-AUTHZ-04, A7-API-03, effort M.
- AC: PostgREST PATCH of `tipo_plato` or `fecha_inicio` as `authenticated` fails; `anon` calling `confirm_ingredient_substitution` gets 401/42501; `user_profiles.alergenos` rejects `Soja` (CHECK on the 14 slugs).
- AC: `/update-password` asks for the current password unless the session is recovery/OTP, and hosted "secure password change" is on (also in `config.toml`).
- AC: `jsonb_add_item` rejects a non-object item (22023) and the suggestions endpoint skips malformed stored items.
- Deps: owner for the hosted Auth toggle; relates ADR-0032/0033.

**23. Tests | Cubrir los caminos críticos que hoy solo pasa e2e o ni eso** - Task, `ola-2`, MEDIUM, closes A7-TEST-04, -05, -06, -08, -09, -07, effort L.
- AC: handler-level DB-integration test for `generate-meal-plan` (profile `sesamo` yields 0 of 21 recipes with sesamo; Pro with expired `plan_expires_at` is treated as Free); a test per profile diet flag against `get_filtered_recipes`.
- AC: a scheduled check against fresco-pre loads `/login` and asserts the Turnstile widget renders; every CI job has `timeout-minutes`; smoke cleanup failure fails the run.
- AC: the job summary lists unloaded files and the honest coverage figure is the ratcheted headline.
- Deps: none; relates FRESCO-916.

**24. Mantenimiento | Cadena de suministro, abuso de coste y operación** - Task, `ola-2`, MEDIUM, closes A7-SUPPLY-01..05, A7-ABUSE-01, -04, -05, -06, A7-API-05, A7-OPS-02, -05, effort L.
- AC: `.mcp.json` pins exact versions and the Supabase MCP runs `--read-only --project-ref` (lint test rejects `@latest`); fork-PR approval is `all_external_contributors`; `refresh-mercadona-catalog` uses `persist-credentials: false` and a pinned dataset revision; the open secret-scanning alert is triaged; admin account has a second factor and docs no longer name it.
- AC: `next.config.mjs` `remotePatterns` have non-wildcard `pathname` and fixed `qualities`/sizes (unit test); `generate-shopping-list`, `get-shopping-list-suggestions` and profile export have rate limits; `meal_plans` per-user cap; malformed bodies answer 400, not 500.
- AC: Edge Function rollback is written in `hotfix.md` and the Edge deploy waits for the staging PR Check; the four other pg_cron jobs have heartbeats.
- Deps: owner for the secret alert, admin 2FA and Sentry alert rules (A7-OPS-06).

**25. SEO | Que pre y dev no compitan con producción y verificar Search Console** - Task, `ola-3`, MEDIUM, closes A7-LAUNCH-07, A7-LAUNCH-08, effort S.
- AC: robots on non-production returns `Disallow: /` and metadata `index:false`; OG origin is derived from the base-URL resolver, not `VERCEL_URL`.
- AC: the production landing HTML contains the google-site-verification and msvalidate tags; JSON-LD offers match the Stripe price or carry no price; the sitemap lists the legal pages.
- Deps: owner sets `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` on Vercel Production (closes FRESCO-887).

Cards by priority: BLOCKER 6 (1, 2, 3, 8, 9, 12), HIGH 6 (6, 7, 11, 13, 14, 16), MEDIUM 13 (4, 5, 10, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25) = 25. Findings with no card: the 5 INFO IDs and the 23 absorbed IDs (they ride on their survivor's card).

## 4. Already tracked or accepted (no new card)

| Finding | Mapping | Evidence |
|---|---|---|
| A7-OPS-01 uptime/cron cadence | FRESCO-935 (Finalizada), FRESCO-951 (Listo, external free monitor), FRESCO-803 (WIP) | acli summary match; git `d8083ee1`, `1db460c3` |
| A7-OPS-03 / A7-LAUNCH-01 root cause | FRESCO-886 (Blocked, domain), FRESCO-883 (Blocked), ADR-0021; residual (no Sentry, wrong content) is card 12 | acli; reports w4-01, w4-02 |
| Human sign-off of the allergen CSV (538/538 `revisada_por_fecha` empty) | FRESCO-908 (Listo) | acli summary "Revisión humana del 100 % de las recetas con alérgeno antes del lanzamiento" |
| Earlier catalogue tag fix (41 recipes + coherence test) | FRESCO-943 (Finalizada), git `a7d61dbd`; this audit finds what that test cannot see (card 6) | git log |
| Paying-gate preconditions (Vercel Pro, Supabase Pro, autónomo, legal opinion) | FRESCO-911 (Listo), FRESCO-434 (Finalizada), ADR-0020 reopen triggers | acli |
| A7-PAY-01 shared environment | already known as C-04 (2026-10-12 critical audit) and ADR-0020; no Jira key found for a `livemode` guard (summary searches "livemode", "modo live"; git log `--grep livemode` empty); card 8 is new work | acli, git |
| A7-AUTHZ-01 | only the non-disclosure of the same RPC was fixed (FRESCO-736, git `0674f5d3`); the feature origin is FRESCO-427; no key for the filter bypass | git, acli |
| A7-LOGIC-08 | free-text inputs came from FRESCO-133 (Finalizada); no key found for enforcing them | acli |
| A7-UI-15 mark permanent | FRESCO-373 (Finalizada, undo added); only the window length is residual (LOW, card 21) | acli |
| A7-TEST-07 coverage | FRESCO-916 (Finalizada, floor raised); residual = headline metric (LOW, card 23) | acli |
| A7-API-01 waitlist | FRESCO-922 (Finalizada) "record the public surface left open", git `c439a143`; treated as an accepted surface at that time, re-raised with the consent angle in card 15 | acli, git |
| A7-LAUNCH-08 site verification | FRESCO-887 (Listo, code merged `278d56fd`); the remaining step is the env value, owner action | acli, git |
| A7-ABUSE-06 force-dynamic pages | accepted tradeoff, ADR-0030 / ADR-0031 (FRESCO-386 nonce CSP) | ADR index |
| A7-ABUSE-02 captcha side | FRESCO-907 (Finalizada) covers captcha on Auth sign-in, not `updateUser({email})` | acli |
| A7-SUPPLY-06, -07, -08, A7-UI-04, A7-OPS-06 | INFO, no card | reports |
| Admin bypass on promotion | accepted divergence `admin-bypass-on-promotion` in `.agents/project.yaml` (not re-reported by SUPPLY or OPS) | project.yaml |
| Hosted Auth values (captcha, SMTP, rate limits, `secure_password_change`), Stripe dashboard state, Sentry rules | not readable by the auditors; cards 8, 10, 11, 13, 22, 24 start with an owner read of the dashboard | w1-01, w1-02, w4-01 |

## 5. Order of attack

First, parallel, no owner needed (ola-0): card 6 (red oracle) then cards 2 and 3 (same table, serialize behind it); card 1 (copy filter, independent migration); card 7 (copy and labels, ships in an hour); card 8 (livemode guard) and card 9 (double checkout, refund target), in two worktrees; card 18 (search accents) and card 16 (prices) as quick wins in parallel.

Second (ola-1): card 4, 14, 22 (after card 1's migration lands, avoid migration number clashes), 10, 15; card 12's code part (Sentry, marker, template) in parallel with owner steps.

Third: cards 5, 17, 19, 20, 21, 23, 24, 25.

Blocked on the owner (Basi): FRESCO-886 domain (card 12 real delivery, card 13 sender, SPF/DKIM); Stripe dashboard (cards 8, 10, 11: disable fresco-dev endpoint, dispute event, portal configuration, dunning, tax behavior); hosted Supabase Auth dashboard (cards 13, 22: min interval, email rate limit, secure password change); Vercel env values (card 25); GitHub secret-scanning alert #1 and admin 2FA (card 24); FRESCO-908 human review of the CSV; lawyer wording (cards 14, 15); decision items (stock rule in card 3, keep or retire paleo/FODMAP labels in card 5, rebuild vs stale list in card 17, rating in card 19, interim confirmation channel in card 12). Spending: nothing in the plan needs money except the structural fix of PAY-01 (separate production Supabase project, Pro plan), which the livemode guard in card 8 avoids; FRESCO-911 already records that gate.

Never charge a real user before cards 1, 2, 3, 8, 9 and 12 are done and FRESCO-886 delivers email.

## 6. Overall grade proposal: 3.3 / 5 (rubric v1, same lens as audits 3-6 and the 2026-10-12 critical audit 3.4; audit-4 3.5, audit-6 3.2; the external audit-6 3.8 used another lens and is not comparable)

- Perimeter and platform are good: no RLS gaps in 24 relations, DEFINER bodies read live, webhook signature and idempotency sound, backups restored, `bun audit` clean (AUTHZ, SUPPLY, OPS checklists). That keeps security near 4.
- The core promise is not yet earned: 6 BLOCKER IDs sit in allergen data and one RPC bypass; 91 recipes carry an allergen-declaration problem (4 confirmed from the row, 87 plausible or product-dependent) and the repo oracle sees none of it. Safety axis about 2.5.
- Money and legal gates are open but conditional: 0 live subscriptions today, so no harm yet, but shared DB without a `livemode` guard, double checkout and an undeliverable confirmation email would each hurt on day one. Payments and legal about 2.8.
- Correctness and UX are decent but with visible defects (175 € yogurt, accent-blind search, ignored free text) and honest coverage is 58.7 %; tests axis about 3.4.
- Net 0.1 below the 2026-10-12 score: fewer perimeter findings, but a deeper, evidence-based look at catalogue data and payment edge cases.
- What moves it above 4.0: all 6 BLOCKER clusters closed with the red tests of cards 1, 2, 3, 6, 8, 9; the HIGH set closed (PAY-08, PRIV-02 with a real signup e2e, LAUNCH-03 copy, LOGIC-01, LOGIC-08, ABUSE-02, TEST-01, SAFEA-01/33/42, SAFEB-02); FRESCO-908 human review finished and the CSV signed; FRESCO-886 resolved so email is deliverable; hosted Auth and Stripe settings read and recorded; honest coverage headline above 65 %. Zero BLOCKER and no more than three HIGH at the next audit would justify 4.0-4.2.
