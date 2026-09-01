# Development Guide: Fresco

╔══════════════════════════════════════════════════════════════════════════════╗
║ DEVELOPMENT GUIDE                                                             ║
║ "What you need to know to work here"                                         ║
╚══════════════════════════════════════════════════════════════════════════════╝

> **Corrected 2026-09-01 (FRESCO-379, A4-H18):** de-Gemini pass per `ADR-0005` —
> every "menu selection / aisle classification / learning text is a Gemini call"
> statement and the whole `GEMINI_API_KEY` story are stale as of 2026-08-01 and
> have been rewritten here. Also flipped the doc's original "nothing is built yet"
> framing to present tense. This pass is **partial** — the §3 state machine still
> misses the `excluida` state and several shipped flows (progressive signup /
> guest-data reassignment, favourites, own-recipes, weekly re-engagement push) are
> not covered here yet; a full `/project-foundation` discovery regeneration is
> tracked as a follow-up.

> This document assumes you've already read `.context/business/business-data-map.md`
> to understand the business flows. Here I'll walk you through what to consider
> when you touch each part of the system.
>
> **One thing before we start:** Fresco is built and in production. The `recipes`
> catalog (~1000 rows), the four other core tables (`user_profiles`, `meal_plans`,
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

This flow produced the ~1000-recipe live catalog. It's founder-operated and **entirely
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

#### 3. THE STATE MACHINES

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📊 THE STATE MACHINES                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

## `meal_plan_recipes.estado`

                     ┌─────────────┐
        (created) ──▶│  pendiente  │
                     └──┬───┬───┬──┘
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
request/response call. Outside the core loop there are a few scheduled / event-driven
pieces — a Vercel cron that reconciles Stripe subscription state
(`app/api/cron/stripe-reconcile/route.ts`), the Stripe billing webhooks, and the
`send-weekly-reengagement-push` Edge Function — but none of them touch the menu /
shopping-list / learning data path.

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

## Third-party services actually in use

    Client (Next.js / Vercel)                 Backend (Supabase Edge Functions)
        │                                          │
        ├─▶ Stripe        checkout + billing       │
        │   (Pro tier — server-side session;       │
        │    webhooks + cron reconcile)            │
        ├─▶ PostHog       product analytics /      │
        │   funnel (reverse-proxied via /ingest,   │
        │    FRESCO-366)                           │
        ├─▶ Sentry        error monitoring +       ├─▶ Sentry (Edge runtime)
        │   CSP reporting                          │
        └─▶ Unsplash      recipe photography       └─▶ (no AI/LLM call)
            (images.unsplash.com, FRESCO-31)

Supabase (database, auth, Edge compute, RLS) is treated as core platform, not an
external line item. Per-integration detail — auth model, webhook contracts, env-var
scoping — lives in `.context/business/business-api-map.md` and `.context/SRS/`; this
guide does not duplicate it. (This subsection is a corrected stub — a full write-up of
each integration's "what will bite you" is part of the deferred `/project-foundation`
regeneration noted in the banner at the top.)

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
  stores each recipe as a JSONB document (~1000 rows). `user_profiles`, `meal_plans`,
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
- Identify which of the four flows above your change actually affects — several of
  them share entities and Edge Functions, so a change that looks scoped to one flow
  (say, shopping-list consolidation) can still touch shared ground (the `recipes`
  catalog every flow reads from).
- Check whether an automatic process is related — right now that's really just the
  `recipe_learning_trigger`, but if you're touching anything in the cooked/discarded
  path, assume it's involved until you've confirmed otherwise.
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
