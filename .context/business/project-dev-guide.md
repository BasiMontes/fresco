# Development Guide: Fresco

╔══════════════════════════════════════════════════════════════════════════════╗
║ DEVELOPMENT GUIDE                                                             ║
║ "What you need to know to work here"                                         ║
╚══════════════════════════════════════════════════════════════════════════════╝

> **Regenerated 2026-09-03 (FRESCO-403):** completes the partial de-Gemini pass of
> 2026-09-01 (FRESCO-379, A4-H18). Every "menu selection / aisle classification /
> learning text is a Gemini call" statement and the whole `GEMINI_API_KEY` story
> are stale as of 2026-08-01 (`ADR-0005`) and stay rewritten. This pass adds the
> `excluida` state to §3, four shipped flows to §2 (guest onboarding + account
> conversion, Pro subscription lifecycle, weekly re-engagement push, user recipe
> curation), the scheduled jobs to §4, and a real per-integration "what will bite
> you" write-up to §5. Base maps `business-data-map.md` (Flow 6) and
> `business-api-map.md` were brought current with the `{targetAccessToken}`
> reassign contract and the edge-function hardening on 2026-09-03 (FRESCO-418).

> This document assumes you've already read `.context/business/business-data-map.md`
> to understand the business flows. Here I'll walk you through what to consider
> when you touch each part of the system.
>
> **One thing before we start:** Fresco is built and in production. The `recipes`
> catalog (1000 rows — see `.context/business/business-data-map.md` §2), the four other core tables (`user_profiles`, `meal_plans`,
> `meal_plan_recipes`, `shopping_lists`), the Edge Functions, and the learning
> trigger are all live. Read this guide as "here's how it works and what will bite
> you," alongside the code itself.

---

#### 1. UNDERSTANDING THE PROJECT

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🏗️ UNDERSTANDING THE PROJECT                                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## How it's designed to be organized

Fresco is a split-runtime system, not a "Next.js does everything" app, and that's a
deliberate choice worth internalizing before you write a single line. The frontend
(Next.js on Vercel) talks to the backend for all product logic through Supabase Edge
Functions — the menu, shopping-list, and learning paths have no Next.js API route in
them (the only `app/api/*` routes are the Stripe cron/webhook glue). The Edge Functions
run on Deno,
a genuinely different runtime from the Node/Vercel environment the frontend lives in.
Two module systems, two deploy pipelines, two places to think about when something
breaks.

The reason for this shape isn't accidental — it's a founder-time constraint. Supabase
bundles database, auth, serverless compute, and row-level security into one vendor,
which minimizes the number of moving pieces a solo, part-time founder has to operate
(`.context/SRS/architecture.md` §2). The trade-off is that you, the developer, absorb
the complexity the founder saved: you have to keep two runtimes straight in your head.

The core product loop funnels through three narrow surfaces: the Edge Functions
`generate-meal-plan`, `generate-shopping-list`, and `update-recipe-status`, plus a few
direct-to-Postgres client calls that bypass the Edge Function layer entirely for pure
state toggles (the shopping-list `comprado` checkbox, for instance). A handful of other
Edge Functions handle account and catalog lifecycle rather than the generation loop
(`delete-account`, `delete-catalog-recipe`, `reassign-guest-data`,
`get-shopping-list-suggestions`, `send-weekly-reengagement-push`). If you're looking
for "where does the generation business logic live," the answer is always: inside one
of those three core Edge Functions, never in the client, never in a raw RPC call
(`.context/business/business-api-map.md` §4).

## Architecture diagram

    ┌───────────────────────────┐
    │  Client — Next.js/Vercel   │   holds the JWT, calls Edge Functions
    │  onboarding · calendar ·   │   directly via supabase.functions.invoke()
    │  shopping list · toggle    │
    └──────────────┬─────────────┘
                   │  Authorization: Bearer <supabase-jwt>
                   ▼
    ┌───────────────────────────────────────────────┐
    │  Supabase Edge Functions (Deno runtime)         │
    │  generate-meal-plan · generate-shopping-list ·  │
    │  update-recipe-status                           │
    └──────┬───────────────────────────────┬──────────┘
           │                               │
           ▼                               ▼
    ┌───────────────────┐        ┌───────────────────────────────┐
    │  SQL pre-filter /  │        │  Deterministic in-process     │
    │  aggregate reads   │        │  algorithms (Deno):           │
    │  (get_filtered_    │        │  menu-selector.ts (slot       │
    │  recipes, cooked/  │        │  scoring) · aisle-pricing.ts  │
    │  discarded marks)  │        │  (13-aisle static map)        │
    └─────────┬─────────┘        └───────────────────────────────┘
              ▼
    ┌──────────────────────────────────────────────┐
    │  Supabase Postgres + RLS                       │
    │  recipes · user_profiles · meal_plans ·        │
    │  meal_plan_recipes · shopping_lists            │
    │  + recipe_learning_trigger (AFTER UPDATE)       │
    └──────────────────────────────────────────────┘

There is **no external LLM call anywhere in production** (`ADR-0005`, 2026-08-01). Menu
selection and shopping-list aisle classification are deterministic in-process algorithms;
the Pro learning-explanation text is templated in TypeScript, not model-generated. The
diagram's original "Gemini Flash" box was removed here for that reason.

## The general flow of data

When a request lands, the pattern is always the same: the Edge Function authenticates
the caller via a Supabase Auth JWT first (`401` if missing or invalid — there is no
unauthenticated path through any of these three functions, which is itself one of the
sharpest points of attention below), then does whatever cheap, structural Postgres work
it can (the SQL pre-filter, the aggregate reads), then runs the deterministic
selection / consolidation algorithm on the already-filtered payload, and only then
persists. Nothing gets written to the database in a partial or unvalidated state — a
failure anywhere in that chain surfaces as an explicit error to the caller, never a
silently degraded result.

---

#### 2. WORKING WITH EACH FLOW

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔄 WORKING WITH EACH FLOW                                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Flow: Weekly Menu Generation

    User ──▶ generate-meal-plan ──▶ SQL pre-filter ──▶ menu-selector.ts ──▶ persist ──▶ calendar
                    │                     │                  │
                 auth + 409          allergen/diet/    deterministic slot
              (no silent          hated-ingredient      scoring; 422 if
                overwrite)           exclusion          <21 safe recipes

### Context

This is the entire product promise: onboarding profile in, a full 21-slot week (7
days × breakfast/lunch/dinner) and a ready-to-render calendar out, in under 30
seconds. It's also the one flow that silently forks by subscription tier without ever
exposing that fork as a different endpoint, request field, or auth scope — Free and
Pro call the exact same URL; a server-side `isPro` check is the entire technical basis
for the €4.99/month tier.

### What to keep in mind

- The allergen and hated-ingredient exclusion happens in **two layers**, and neither
  one is trusted alone: a cheap SQL pre-filter (`get_filtered_recipes()`) runs first,
  and the same exclusion rules are re-applied in-code as a safety net before persist
  (`20260901073555_allergen_filter_safety_net.sql` plus the Edge Function re-filter
  hardened in FRESCO-361 / FRESCO-362). Don't assume shipping one layer covers you —
  this two-layer redundancy is itself the architectural invariant (promoted to
  `ADR-0001` for exactly this reason). If you ever touch the filtering logic, touch
  both layers or neither.
- A `409` on regeneration isn't a bug you should "fix away" — a user's existing plan
  for the week is deliberately never silently overwritten.
- If fewer than 21 recipes survive the SQL pre-filter, the call fails closed with
  `422` rather than proceeding with a degraded-safety catalog. That's a feature, not
  an edge case to route around.
- The Free/Pro fork lives entirely upstream of slot scoring: for Free, the
  last-2-weeks cooked/discarded history is never *read* at all — not toggled off,
  never queried. For Pro, those recipe ids are removed from the candidate pool
  **before** scoring — a hard exclusion filter, not an instruction a model might not
  follow (`ADR-0005`). If you're debugging "why doesn't Free see history," the answer
  is structural, not a flag you flip.
- Because Supabase Edge Functions have no native multi-table transaction, persisting
  a plan is a two-step insert (`meal_plans` then 21 `meal_plan_recipes` rows) with a
  manual compensating delete if the second insert fails. This is a documented
  reliability gap, not an oversight — know it's there before you assume atomicity.
- Quality rules (category variety, seasonal preference, richness balancing,
  prioritizing well-cooked/well-rated recipes) are explicitly soft/best-effort. The
  budget ceiling, by contrast, is a hard constraint. Don't conflate the two when
  writing validation.

### Dependencies

    Weekly Menu Generation
         │
         ├──► reads from ──► Cooked/Discarded history (Pro only, last 2 weeks)
         ├──► feeds ────────► Shopping List Generation (on demand, separate call)
         └──► gated by ─────► the two-layer food-safety guardrail (see §6)

---

## Flow: Cooked / Discarded Feedback Loop

    User taps ✓/✗/↔ ──▶ update-recipe-status ──▶ UPDATE estado ──▶ recipe_learning_trigger ──▶ recipes (global aggregate)
                              │                                            │
                        403 if not owner                          fires AFTER UPDATE,
                        409 if already terminal                    only when estado changed

### Context

This is the learning mechanism the whole Pro tier is sold on. A user marks a calendar
slot as cooked, discarded, or swapped; the raw signal is recorded unconditionally for
every tier; only *application* of that signal back into generation is Pro-gated (see
Flow 1 above). It's the cheapest possible feature to build — one toggle, one trigger,
one candidate-pool exclusion for Pro — which is exactly why `ADR-0001` calls it out as
the single hardest-to-reverse bet in the whole architecture.

### What to keep in mind

- The ownership check here is the single highest-blast-radius authorization check in
  the system. `update-recipe-status` joins the target slot back to its parent
  `meal_plans.user_id` and rejects with `403` on mismatch. Skip that join and any
  authenticated user could mutate another user's slot state and pollute the *global*
  aggregate that feeds every Pro user's next generation — a cross-user, product-wide
  blast radius, not a single-account one.
- `cocinada` and `descartada` are terminal. Don't build a "let the user undo" affordance
  on top of this flow without reading the state-machine section below first — repeated
  toggling would double-count the same signal into the aggregate.
- The aggregate update is deliberately a **database trigger**, not application code.
  That's not incidental — it means the learning signal stays reliable even if the
  Edge Function, an admin tool, or a future migration script is what performs the
  `UPDATE`. If you're tempted to move this logic into the Edge Function for
  readability, don't — the whole point is that it fires regardless of the caller.
- Recording is universal across every tier; only the *next generation's candidate pool*
  is where Free/Pro actually diverges. Don't assume "Free users don't get tracked" —
  they do, identically to Pro. What differs is only whether that history is ever read
  back in.

### Dependencies

    Cooked/Discarded Feedback Loop
         │
         ├──► triggers ──► recipe_learning_trigger (automatic process, see §4)
         └──► feeds ─────► Weekly Menu Generation, step 6 (Pro tier's next request only)

---

## Flow: Shopping List Generation

    Calendar ──▶ generate-shopping-list ──▶ consolidate (app code) ──▶ aisle-pricing.ts (static map) ──▶ persist
                        │                            │                              │
                  404/409 checks              scale by household size,      classify into 13 aisles
                                               sum compatible units          + cost range, no model

### Context

A separate, on-demand Edge Function — not a side effect of menu generation. It's
requested explicitly by the user (typically right after the menu, or on first tap of
"Ver lista de la compra"), and it has its own independent failure posture.

### What to keep in mind

- The whole flow is **deterministic application code** — no model anywhere. Ingredient
  consolidation (normalizing names, scaling by household size, summing compatible
  units) runs first, then `aisle-pricing.ts` classifies each consolidated ingredient
  into one of 13 fixed aisles and attaches a cost range via a static map. Ingredient
  names are a controlled vocabulary (the recipe catalog's own ingredient list), so
  aisle classification never needed a language model (`ADR-0005`). Aisle classification
  and the Pro learning text used to be Gemini calls; both were removed 2026-08-01.
- Because the classification is a static map, there's no "did the model drop or invent
  items" failure mode to guard against — the old ≥90% item-retention check existed
  only because a model was in the loop, and it went away with the model.
- One list per plan is enforced (`409` if one already exists) — this flow is
  idempotent-by-rejection, not idempotent-by-overwrite.
- The individual "mark as purchased" toggle on a shopping-list item bypasses the Edge
  Function entirely — it's a direct, targeted client call. Don't assume every mutation
  in this flow goes through the same orchestration layer as generation.

### Dependencies

    Shopping List Generation
         │
         ├──► reads from ──► an existing meal_plan's 21 slots (must already exist)
         └──► independent of ──► the 30-second performance budget that applies to
                                  menu generation (no numeric latency target defined
                                  for this flow specifically — see §6)

---

## Flow: Batch Recipe-Catalog Seeding

    Founder ──▶ offline batch drafting ──▶ manual 8-point review ──▶ service_role insert ──▶ recipes

### Context

This flow produced the 1000-recipe live catalog (canonical count: `business-data-map.md` §2). It's founder-operated and **entirely
offline** — not a live API endpoint, and **not a runtime dependency of anything**. It
exists because curated/photographed recipe content was cut from MVP scope for cost
reasons; this batch-plus-manual-review process is the deliberate substitute. The
drafting step was historically Gemini-assisted, but that is an offline authoring
convenience, not part of the running system — there is no LLM call in production
(`ADR-0005`; `business-data-map.md` §11).

### What to keep in mind

- This is a human-in-the-loop gate, not a live validation function — the same
  manual-safety posture as the food-safety checklist that still runs before every
  concierge-stage menu delivery. Nothing gets inserted without a human reviewing it
  against an 8-point checklist (allergen accuracy against the 14 EU-regulated
  allergens, diet-flag correctness, cost realism for the Spanish market, category
  variety, and more).
- Writes here go through the `service_role` key, which bypasses RLS. This is the one
  genuinely privileged write path in the whole system — the client never has write
  access to `recipes`, ever.
- If you're building any tooling around this process, remember it's explicitly not
  meant to become fully automated at MVP scale — the manual review is additive to
  whatever future validation code exists, not something code is meant to replace.

### Dependencies

    Batch Recipe-Catalog Seeding
         │
         └──► feeds ──► the shared recipes catalog every other flow reads from
                         (all 21 slots in every generated menu ultimately trace
                          back to a recipe that passed through this process)

---

## Flow: Guest Onboarding & Account Conversion

    Visitor ──▶ /onboarding ──▶ signInAnonymously() ──▶ real anon JWT ──▶ profile + menu
                                                             │
    later: /signup ──▶ updateUser({email}) + verifyOtp ──────┤ same auth.uid() kept
                          │                                   │
                          └─ email_exists ──▶ reassign-guest-data ──▶ move plans to target acct

### Context

The PRD promises a first-time visitor generates a full week with zero signup
(EPIC-FRESCO-6). Every landing CTA routes to `/onboarding`, not `/signup` — `/signup`
is only the returning-user escape hatch. On mount, `ensureGuestSession()` calls
`supabase.auth.signInAnonymously()` and gets a **real Supabase Auth JWT** with
`is_anonymous = true` and a real `auth.uid()` (`ADR-0003`). This is the single most
important thing to internalize about auth here: there is no separate guest code path.
Every RLS policy is keyed to `auth.uid()` (never a role check), so an anonymous
session satisfies `requireAuthenticatedUser()` and every policy unmodified.

### What to keep in mind

- **A guest's anonymous session *is* her account.** Logging out destroys her menu
  with no recovery, which is why `GuestLogoutDialog` gates a guest logout with an
  explicit confirmation (FRESCO-90) while a registered logout stays one click. Don't
  add a "save your progress later" affordance that implies the data is recoverable.
- **Anonymous sign-in is rate-limited** (`rate_limit_anonymous_users`, ~30/hour on
  this project) and it *does* get hit — surface it inline, never as a silent hang.
- **Abandoned guests are GC'd by a daily cron** after 3 days (`is_anonymous = true AND
  created_at < now() - 3 days`, see §4). An upgraded guest flips `is_anonymous =
  false` and is never a candidate again.
- **Conversion has two paths.** Happy path: `updateUser({ email })` → `verifyOtp`
  (`email_change`) → `updateUser({ password })`, all keeping the same `auth.uid()`, so
  `user_profiles` + `meal_plans` survive untouched. Conflict path (`email_exists` — the
  email already belongs to a *different* real account): the client posts to
  `reassign-guest-data` with `{ targetAccessToken }` — a session token the client got
  by logging into the target account through native Supabase Auth (`ADR-0022` /
  FRESCO-395; the function verifies the token, never a password, so it can't be a
  brute-force oracle — the pre-`ADR-0022` `{email, password}` contract is gone).
- **`reassign_guest_data()` is the project's only cross-user write.** `EXECUTE` is
  revoked from every ordinary role and granted only to `service_role`; the Edge
  Function is its sole caller. It moves `meal_plans` (skipping any `semana_iso` the
  target already has — the conflicting week is silently dropped, a documented
  data-loss trade-off), mirrors onto `shopping_lists`, deletes the orphaned guest
  profile, then `admin.deleteUser()`s the guest. The target's own allergen/diet
  profile is **never** merged — a food-safety call.

### Dependencies

    Guest Onboarding & Account Conversion
         │
         ├──► issues ──────► the anon JWT every other flow's auth check accepts
         ├──► feeds ───────► Weekly Menu Generation (step 6 of onboarding)
         └──► gated by ────► anonymous-sign-in staying enabled in Supabase Auth
                              (external_anonymous_users_enabled — ADR-0003)

---

## Flow: Pro Subscription Lifecycle

    /profile ──▶ POST /api/stripe/checkout ──▶ Stripe-hosted page ──▶ (events, signed)
                                                                          │
    POST /api/stripe/webhook ◀────────────────────────────────────────────┘
         │  service_role UPDATE user_profiles (plan / expires_at / failed_at / ids)
         │
    GET /api/cron/stripe-reconcile  (daily 04:17 UTC) ──▶ same columns, drift-correcting

### Context

The entire €4.99/month tier is `user_profiles.plan` plus four supporting columns.
There is **no `subscriptions` table** and `ADR-0007` says do not add one without
superseding it. Checkout is Stripe-hosted (`subscription` mode, 7-day trial, no card
at signup); the webhook projects Stripe's state into `user_profiles`; and since
2026-08-28 a daily cron (`ADR-0015`, still `Proposed`) re-derives the same state from
`stripe.subscriptions.retrieve()` to self-heal a lost webhook.

### What to keep in mind

- **Only `service_role` can write subscription columns** (`plan`, `plan_expires_at`,
  `stripe_customer_id`, `stripe_subscription_id`, `payment_failed_at`). A
  `prevent_client_subscription_writes()` BEFORE UPDATE trigger raises unless
  `auth.role() = 'service_role'` — RLS is row-scoped, not column-scoped, so a plain
  policy could not stop an authenticated user self-granting Pro (`ADR-0007`).
- **The webhook re-verifies the price** (`== STRIPE_PRICE_ID_PRO_MONTH`) on every
  activation and renewal — any non-Pro subscription is refused a Pro grant.
- **`past_due` keeps Pro; `unpaid` / `deleted` drop to Free.** `past_due` only stamps
  `payment_failed_at = now()` — Stripe's own retry window is the grace period, and
  the payment-failed notice in `/notifications` reads that column. Cancellation takes
  effect only when the paid period ends, not when the user clicks cancel.
- **After signature verification, a downstream failure logs and still returns `200`.**
  Returning non-2xx makes Stripe retry a bug forever; the recovery path is a manual
  replay from the Stripe dashboard.
- **Webhook secrets are per-environment** (`STRIPE_WEBHOOK_SECRET_{DEV,PRE,PROD}`,
  resolved by `resolveWebhookSecret()`) because one Stripe account serves all three
  deploys. The reconcile cron and its `CRON_SECRET` (Vercel Production + a matching
  Supabase Vault secret) are manually provisioned — absent either, the job runs on
  schedule but every call `401`s and silently no-ops.

### Dependencies

    Pro Subscription Lifecycle
         │
         ├──► written by ──► the Stripe webhook (primary) + the reconcile cron (daily)
         ├──► read by ─────► Weekly Menu Generation (the isPro fork), the /notifications payment-failed notice
         └──► never by ────► client code — the BEFORE UPDATE trigger blocks it

---

## Flow: Weekly Re-Engagement Push

    pg_cron (Sun 18:00 UTC) ──▶ pg_net POST ──▶ send-weekly-reengagement-push (verify_jwt: false)
                                                     │  apikey header == Vault secret (else 401)
                                                     ▼
                              one Web Push per push_subscriptions row for a user
                              with NO meal_plans row this ISO week

### Context

The only flow that reaches a user outside the app, and the only Edge Function with
`verify_jwt: false` — so it authenticates differently from everything else:
`requireServiceRoleCaller()` checks the `apikey` header against
`SUPABASE_SECRET_KEYS.default`, not a user JWT. `pg_cron` + `pg_net` is the single
scheduler for every time-based job (`ADR-0011`); there is no Vercel Cron or GitHub
Actions cron for DB-adjacent work.

### What to keep in mind

- **It is fire-and-forget.** `pg_net` is async — `cron.job_run_details` shows no HTTP
  result. Success is observed only in Edge Function logs / Sentry. If it silently
  stops working, nothing alerts you.
- **It depends on a manually-created Vault secret** (`edge_function_secret_key`).
  Absent → every send `401`s and the job no-ops on schedule.
- **VAPID signing + `aes128gcm` encryption is delegated to the `web-push` library**
  (`ADR-0012`), not hand-rolled. Dead endpoints (`404`/`410`) get their
  `push_subscriptions` row deleted; a transient `5xx` logs and skips (row kept); one
  bad send never aborts the batch.
- **The email variant is blocked** — no verified Resend sending domain (FRESCO-241);
  this is a standing constraint, not a TODO.
- If you redeploy this function, pass `--no-verify-jwt` — there is no per-function
  config in `config.toml`, so a plain `supabase functions deploy` re-enables JWT
  verification and breaks the cron.

### Dependencies

    Weekly Re-Engagement Push
         │
         ├──► reads ───────► push_subscriptions, meal_plans (current ISO week)
         ├──► writes ──────► push_subscriptions (prunes dead endpoints only)
         └──► scheduled by ─► pg_cron 'send-weekly-reengagement-push' (ADR-0011)

---

## Flow: User Recipe Curation (favourites + own recipes)

    Recipe detail ──▶ toggle ♥ ──▶ favorites (client → Postgres, RLS auth.uid())
    Biblioteca ─────▶ "Añadir receta" ──▶ recetas_propias (client → Postgres, RLS auth.uid())

### Context

Two small user-owned tables that never go through an Edge Function — plain
client-to-Postgres writes guarded by RLS (`favorites_insert_own`,
`recetas_propias_*`, both `with check (auth.uid() = user_id)`). `favorites` is a
join row against a catalog `recipe_id`; `recetas_propias` is a free-form recipe the
user typed in.

### What to keep in mind

- **`recetas_propias` never enters menu generation.** `generate-meal-plan` only ever
  reads the `recipes` catalog — a user's own recipe is a Biblioteca-only artifact, by
  design (a user recipe hasn't passed the 8-point food-safety review). If you touch
  the generation candidate pool, do not "helpfully" include it.
- **`favorites` is a real recommendation signal** — `get-shopping-list-suggestions`
  derives its carousel from the ingredients of the user's favorited recipes (real
  data only, no model). It is *not* a generation input.
- Both tables are in the `ON DELETE CASCADE` chain from `auth.users`, so account
  deletion and guest cleanup remove them with no extra code.

### Dependencies

    User Recipe Curation
         │
         ├──► favorites ────────► feeds get-shopping-list-suggestions' carousel
         └──► recetas_propias ──► Biblioteca only; never read by generate-meal-plan

---

#### 3. THE STATE MACHINES

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📊 THE STATE MACHINES                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

## `meal_plan_recipes.estado`

   (generation — day/meal NOT in       ┌─────────────┐
    planning_selection, FRESCO-199) ──▶│  excluida   │  (terminal; recipe_id = null;
                                       └─────────────┘   renders "no planeado", not draggable)

                     ┌─────────────┐
   (generation —  ──▶│  pendiente  │
    normal slot)     └──┬───┬───┬──┘
                        │   │   │
          mark cooked   │   │   │  mark discarded
          ┌─────────────┘   │   └─────────────┐
          │                 │ change meal      │
          ▼                 ▼                  ▼
   ┌─────────────┐   ┌─────────────┐    ┌──────────────┐
   │  cocinada   │   │ sustituida  │    │  descartada  │
   │  (TERMINAL) │   │ (neutral,   │    │  (TERMINAL)  │
   └─────────────┘   │  not final) │    └──────────────┘
                      └──┬───┬─────┘
          mark cooked    │   │  mark discarded
          on new recipe  │   │  on new recipe
                         ▼   ▼
                  (loops back into cocinada / descartada,
                   per the terminal-state rule)

    NOTE: a drag-and-drop position swap (swap_meal_plan_slots) moves
    (recipe_id, estado, rating) between two same-tipo_plato slots WITHOUT
    firing recipe_learning_trigger (§4 / ADR-0002). It rejects a slot in
    estado 'excluida' outright (FRESCO-396 / A4-L9).

### Why it matters

This is the single most consequential piece of state in Fresco, because it's the
direct input to the learning trigger described in §4. Every dollar of the Pro tier's
value proposition traces back to this state machine being correct — get the
transitions wrong and the learning signal that's supposed to justify €4.99/month
either double-counts or silently drops data.

### Things to remember

- `cocinada` and `descartada` are the only terminal states. Once a slot lands there,
  any further attempt to patch it is rejected outright. This is what makes the
  aggregate statistics trustworthy — no double-counting via repeated toggling.
- `excluida` is set **at generation time** for every day/meal combo the user left
  out of `user_profiles.planning_selection` (FRESCO-199). It carries `recipe_id =
  null`, renders as "no planeado", and is not draggable. It never transitions —
  changing which slots are excluded means regenerating the plan, not patching the
  slot. `swap_meal_plan_slots` raises if either side is `excluida` (FRESCO-396).
  Don't write code that assumes every slot in a plan holds a recipe.
- `sustituida` is deliberately **not** terminal and has **no statistics effect at
  all** — it's explicitly neutral. Swapping a disliked meal for another one is
  treated as ordinary calendar editing, not a learning signal. A substituted slot can
  later transition to `cocinada` or `descartada` on the *new* recipe, and that
  transition does count normally.
- Only the owning user can transition their own slot — enforced by the ownership join
  described in §2's feedback-loop flow, not by a role check (Fresco has no
  admin/user role distinction anywhere).
- A rating (1–5) only ever attaches to a `cocinada` transition, and it's always
  optional — the system has to keep learning from the unrated signal alone, since most
  toggles probably won't carry a rating.

---

#### 4. AUTOMATIC PROCESSES

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚡ AUTOMATIC PROCESSES                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

There's exactly one automatic process worth knowing deeply in the core generation loop:
the `recipe_learning_trigger`. Everything else in that loop is a synchronous, on-demand,
request/response call.

Outside the core loop, **all time-based work runs on `pg_cron` + `pg_net`** — there is
no Vercel Cron or GitHub Actions cron for anything DB-adjacent (`ADR-0011`). Four jobs
exist; none touch the menu / shopping-list / learning data path:

| Job (`cron.job`) | Schedule (UTC) | What it does |
|---|---|---|
| `cleanup-abandoned-guest-users` | daily 03:00 | `delete from auth.users where is_anonymous AND created_at < now() - 3 days` — cascades the whole guest footprint away (`ADR-0003`; 7d → 3d, FRESCO-238) |
| `cleanup-expired-rate-limits` | daily 03:15 | `delete from rate_limits where window_start` older than the current hour − 2h (`ADR-0010`) |
| `stripe-reconcile-subscriptions` | daily 04:17 | `pg_net` GET into `https://fresco-pro.vercel.app/api/cron/stripe-reconcile` (Bearer = a Vault secret); the route re-derives each subscribed user's `plan`/`plan_expires_at`/`payment_failed_at` from live Stripe and corrects drift (Flow: Pro Subscription Lifecycle; `ADR-0015`, still `Proposed`) |
| `send-weekly-reengagement-push` | Sun 18:00 | `pg_net` POST into the Edge Function (Flow: Weekly Re-Engagement Push) |

Plus two event-driven pieces: the **Stripe billing webhook** (`POST /api/stripe/webhook`,
the primary writer of subscription state) and the **`ON DELETE CASCADE` chains** rooted
at `auth.users` (one delete removes `user_profiles` → `meal_plans` → `meal_plan_recipes`,
plus `shopping_lists`, `favorites`, `recetas_propias`, `push_subscriptions`).

Every one of these jobs depends on a **manually-created secret** (a Supabase Vault
secret, or a Vercel env var, or both) that no migration provisions. When a secret is
missing the job still fires on schedule but every call `401`s and silently no-ops —
there is no alert. If a scheduled job "isn't working", check the secret before the code.

## `recipe_learning_trigger`

### What it does and when

Fires `AFTER UPDATE` on `meal_plan_recipes`, but only when `estado` actually changed
value. On a transition into `cocinada`, it increments the recipe's global
`veces_cocinada`, stamps `ultima_vez_en_menu`, and recomputes `rating_promedio` as a
running average if a rating was given. On a transition into `descartada`, it
increments `veces_descartada`. On `sustituida`, it does nothing — a deliberate no-op.

### Why you should care

If you're ever touching the cooked/discarded update path — the Edge Function, a
future admin tool, a data-migration script — and you don't understand this trigger
exists, you will silently break the moat without realizing it. The trigger, not the
API, owns the learning side effect specifically so it stays correct regardless of
which code path performs the underlying `UPDATE`. Bypass the normal update path (say,
a raw SQL fix-up script) and the aggregate simply won't move, with no error raised
anywhere to tell you.

    Event                        Process                              Effect
       │                            │                                    │
       ▼                            ▼                                    ▼
    estado changes ──────► recipe_learning_trigger ──────► recipes.veces_cocinada /
    on meal_plan_recipes    (AFTER UPDATE, Postgres)        veces_descartada /
                                                              rating_promedio
                                                              (updated globally,
                                                               not per-user)

---

#### 5. EXTERNAL INTEGRATIONS

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔗 EXTERNAL INTEGRATIONS                                                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

## No external AI / LLM dependency (`ADR-0005`)

**There is no Gemini, no `GEMINI_API_KEY`, and no `generativelanguage.googleapis.com`
call anywhere in the production system.** Menu-slot selection, shopping-list aisle
classification, and the Pro learning-explanation text were all originally single Gemini
Flash calls; all three were replaced with deterministic in-process code on 2026-08-01
(`menu-selector.ts`, `aisle-pricing.ts`, `buildLearningExplanation()` in `prompt.ts`)
and the API key was removed with them (`ADR-0005`; SRS `non-functional-requirements.md`
NFR-SEC-3). The retry loop, the `responseMimeType: 'application/json'` JSON-mode
handling, the `502`-on-non-2xx / `MAX_RETRIES` behaviour, and the temperature tuning
that older versions of this section described are all gone — a deterministic algorithm
has none of those failure modes. If you see `GEMINI_API_KEY` referenced anywhere in
the codebase today, it is dead config to delete, not a secret to protect.

Historical prompt contracts are retained, banner-marked as superseded, in
`api-contracts.md` §1a / §2b for anyone tracing why the code looks the way it does.

## Third-party services actually in use — what will bite you

    Client (Next.js / Vercel)                 Backend (Supabase Edge Functions)
        │                                          │
        ├─▶ Stripe        checkout + billing       │
        │   (server-side session; webhook +        │
        │    daily reconcile cron)                 │
        ├─▶ PostHog       analytics / funnel       │
        │   (same-origin /ingest reverse proxy)    │
        ├─▶ Sentry        error monitoring +       ├─▶ Sentry (Deno / Edge runtime)
        │   CSP report-uri                         │
        └─▶ (browser Web Push services)            └─▶ (no AI / LLM call anywhere)

    offline only, not a runtime dependency:  Unsplash  (recipe photo backfill script)

Supabase (database, auth, Edge compute, RLS) is core platform, not an external line
item — see `.context/SRS/architecture.md`. The rest:

### Stripe

The whole Pro tier. Server-side Checkout + Billing Portal route handlers, the
signature-verified webhook, and the daily reconcile cron. **What bites:** the webhook
is the primary writer of `user_profiles` subscription columns and returns `200` even
on a post-signature failure (non-2xx = infinite Stripe retries), so a silently
half-applied subscription change is possible — the reconcile cron is the safety net
*only if* its `CRON_SECRET` (Vercel Production + matching Supabase Vault secret) is
set. Webhook secret is **per-environment** (`STRIPE_WEBHOOK_SECRET_{DEV,PRE,PROD}`)
because one Stripe account serves all three deploys — get the wrong one and every
event `400`s. Never write subscription columns from client code; the BEFORE UPDATE
trigger blocks it (`ADR-0007`). Secrets: `STRIPE_SECRET_KEY`,
`STRIPE_PRICE_ID_PRO_MONTH`, `STRIPE_WEBHOOK_SECRET_{DEV,PRE,PROD}`, `CRON_SECRET`.

### PostHog (EU Cloud)

Product-funnel analytics — the North-star KPI ("menús generados **y** usados") and the
3-week repeat hypothesis (`ADR-0013`). **What bites:** it is served through a
**same-origin reverse proxy** — `posthog-js` posts to `/ingest` and `next.config.mjs`
`rewrites()` forward to PostHog's EU ingestion + asset hosts (FRESCO-366), so an
ad-blocker filtering `*.posthog.com` can't drop events; if you touch `next.config.mjs`
rewrites or the CSP `connect-src`, you can break analytics without any error. Region
follows `NEXT_PUBLIC_POSTHOG_HOST`. `identify()` is keyed on `auth.uid()` including
guests, so a guest's pre-signup event stream must merge into her post-signup one
(`alias()` on the reassignment path). **No app-DB writes**; autocapture is off on
purpose (it would scrape allergen/diet UI text). Every capture is a silent no-op on
failure or when `NEXT_PUBLIC_POSTHOG_KEY` is unset. Secrets:
`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`.

### Sentry

Unhandled-error capture across all three Next.js runtimes (`instrumentation.ts` +
`sentry.{server,edge}.config.ts` + `instrumentation-client.ts`) and, since FRESCO-385,
the Edge Functions too (`_shared/sentry.ts` reports unexpected errors from the Deno
runtime). Production source-map upload via `withSentryConfig` (`ADR-0009`). The CSP
(`lib/security/csp.ts`) points its `report-uri` at Sentry. **What bites:** degraded
observability only — the app is never affected. If `SENTRY_AUTH_TOKEN` is absent,
source-map upload fails quietly and production stack traces stay minified. Secrets:
`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.

### Browser Web Push services (FCM / Mozilla / Apple / …)

Delivery endpoint for the weekly re-engagement notification (Flow: Weekly
Re-Engagement Push) — one outbound POST per `push_subscriptions` row, VAPID-signed and
`aes128gcm`-encrypted by the `web-push` library (`ADR-0012`). **What bites:** a
`404`/`410` response is the *only* automatic deleter of a `push_subscriptions` row
besides user opt-out; a transient `5xx` logs and keeps the row. Secrets (Edge Function
scope): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

### Unsplash — offline only

Not a runtime integration. `scripts/fetch-recipe-photos.ts` backfills
`recipes.foto_url` from Unsplash's free tier (50 searches/hour) — a founder-operated
batch script in the same category as catalog seeding, run by hand, never called by the
app. The CSP allows `https://images.unsplash.com` as an `img-src` so the applied
photos render; `foto_url` is `null` until a recipe's batch runs (FRESCO-31, ongoing).
Secret (local `.env` only): `UNPLASH_ACCESS_KEY` (sic — the env var is misspelled).

### Supabase Auth

The sole identity provider — email/password, anonymous (guest), password recovery,
email-change OTP, `admin.deleteUser()`. **What bites:** anonymous sign-in must stay
enabled (`external_anonymous_users_enabled`, Management API only, `ADR-0003`) or Guest
Mode breaks entirely; anonymous sign-in is rate-limited (~30/hour); and OTP/recovery
email hits Supabase free-tier limits and rejects non-standard domains — a named risk
on the guest-upgrade path.

---

#### 6. POINTS OF ATTENTION

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ POINTS OF ATTENTION                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Things that could bite you

- **Guest mode runs on an anonymous Supabase session — know this before you touch
  auth.** The PRD promises a first-time visitor can generate a full menu with zero
  signup (EPIC-FRESCO-6). Every Edge Function hard-requires a Supabase Auth Bearer JWT
  and returns `401` without one, so a guest gets a real JWT via
  `supabase.auth.signInAnonymously()` (`ADR-0003`) — a fully-formed session with a real
  `auth.uid()`, which means every RLS policy (all keyed to `auth.uid()`, never a role
  check) works unmodified for a guest. When a guest later signs up, their data is
  migrated to the permanent account by the `reassign-guest-data` Edge Function
  (`20260731140000_create_reassign_guest_data_function.sql`). Don't add a
  client-side-only bypass path or a custom guest token — the anonymous-session model
  is the decided one.

- **The split-runtime gotcha will trip you if you're not deliberate about it.** The
  frontend runs on Node/Vercel; the backend runs on Deno inside Supabase Edge
  Functions. Two different module systems, two different standard libraries, two
  independent deploy pipelines (a frontend deploy and an Edge Function deploy are
  separate release events — fixing a broken Edge Function never requires a frontend
  redeploy, and vice versa). Don't assume an npm package that works in the frontend
  will work inside an Edge Function, and don't assume a frontend build failure means
  the backend is also broken.

- **The `recipes` table is JSONB-shaped — the other core tables are typed.** `recipes`
  stores each recipe as a JSONB document (1000 rows). `user_profiles`, `meal_plans`,
  `meal_plan_recipes`, and `shopping_lists` are typed relational tables
  (`20260725120100_create_fresco_core_tables.sql`), and the `aprendizaje` learning
  columns (`veces_cocinada`, `veces_descartada`, `rating_promedio`, `ultima_vez_en_menu`)
  are flat top-level columns on `recipes`, updated by `recipe_learning_trigger`
  (`20260725120000`, `20260725120200`). When you query a recipe you're reading JSONB;
  when you query a plan or a profile you're reading columns. Don't assume one shape
  across the schema.

- **The Free-tier-cannibalization risk is a UI risk as much as a backend one.**
  `ADR-0001` names it directly: if the "we adjusted your menu because..." explanation
  card is built weakly — vague copy, easy to miss, inconsistent styling — Free users
  simply cannot tell "the product doesn't remember me" from "the product is broken,"
  and Pro subscribers can't feel what they're paying for. The entire business model's
  differentiation depends on that explanation actually landing. If you're the one
  building that card, treat its visibility and clarity as a P0 requirement, not
  a nice-to-have polish pass.

- **The global (not per-user) learning-stats aggregation is deliberate — don't
  quietly "fix" it into per-user stats.** `veces_cocinada`, `veces_descartada`, and
  `rating_promedio` are aggregated across every user, not scoped per household. That
  might look like an obvious improvement to make, but it's an explicit, documented
  trade-off: at concierge-cohort scale (8–10 users), globally-aggregated statistics
  are more robust than sparse per-user data points would be. A future `user_recipe_stats`
  table for true per-user personalization is already earmarked as deferred "Fase 2"
  work. If usage volume ever justifies revisiting this, read `ADR-0001` in full first —
  changing it is simultaneously a schema migration and a pricing-model change, not an
  isolated backend refactor.

## Non-obvious dependencies

"Small" changes in this system tend to have a wider blast radius than they look:

    meal_plan_recipes.estado transition ──── silently drives ────► recipes' global
    (via one Edge Function PATCH)                                   aggregate stats
         │                                                                │
         │                                                                ▼
         └──── which every Pro user's ────────────────────────► next generation's
               NEXT generation reads back in                     prompt content

    generate-meal-plan's isPro branch ──── is the entire ────► technical basis for
    (one conditional, one extra SQL call)   the €4.99/month Pro tier's existence

---

#### 7. FINAL CONSIDERATIONS

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 💡 FINAL CONSIDERATIONS                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Before you start any change

It's always worth taking a moment to:

- Re-read `business-data-map.md` for the flow you're touching — this guide gives you
  the "watch out for" framing, but the data map has the authoritative step-by-step
  narrative and business rules.
- Identify which of the §2 flows your change actually affects — several share
  entities and Edge Functions, so a change that looks scoped to one flow (say,
  shopping-list consolidation) can still touch shared ground (the `recipes` catalog
  every flow reads from). The core generation loop is the first four; guest
  onboarding, the Pro lifecycle, the weekly push, and recipe curation are the rest.
- Check whether an automatic process is related — the `recipe_learning_trigger` for
  anything in the cooked/discarded path, the `prevent_client_subscription_writes`
  trigger for anything near `user_profiles.plan`, and the four `pg_cron` jobs (§4)
  for anything touching guest cleanup, rate limits, Stripe state, or push.
- If your change touches auth, ownership checks, or the allergen/hated-ingredient
  filtering, treat it as security- or safety-relevant by default, not routine —
  those are the two places in this system where a missing check has a blast radius
  well beyond one user's account.

## Useful resources

- `.context/business/business-data-map.md` — entities, flows, state machines,
  automatic processes, integrations; the authoritative source this guide is built on.
- `.context/business/business-feature-map.md` — the full feature inventory, CRUD
  matrix, and endpoint catalog, if you need to know what's specified versus what's
  actually built.
- `.context/business/business-api-map.md` — the auth model and the critical business
  journeys in full detail.
- `.context/SRS/architecture.md` — tech-stack rationale, the full data model, the
  security architecture, and the deployment topology.
- `.context/ADR/ADR-0001-behavioral-learning-moat.md` — the single most important
  "why does this exist" story in the system; read this before touching anything in
  the cooked/discarded or menu-generation paths.
- `.context/ADR/ADR-0005-deterministic-menu-slot-selection.md` — why menu selection,
  aisle classification, and the Pro learning text are deterministic in-process code
  and not LLM calls; read this before touching `menu-selector.ts` or `aisle-pricing.ts`.
- `.context/ADR/ADR-0003-guest-auth-anonymous-sign-in.md` — the anonymous-session
  guest-mode mechanism; read before touching auth or the guest→account migration.
- `DESIGN.md` — the visual system and component vocabulary (colors, typography,
  spacing, the shared `card-insight` component the Pro-tier explanation and the
  generation-warnings surfacing both rely on).

---

<!-- human-notes: anything written below this comment is preserved across regenerations -->
