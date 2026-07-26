# Development Guide: Fresco

╔══════════════════════════════════════════════════════════════════════════════╗
║ DEVELOPMENT GUIDE                                                             ║
║ "What you need to know to work here"                                         ║
╚══════════════════════════════════════════════════════════════════════════════╝

> This document assumes you've already read `.context/business/business-data-map.md`
> to understand the business flows. Here I'll walk you through what to consider
> once you start building.
>
> **One thing before we start: there is no code yet.** Fresco is pre-`/project-bootstrap`.
> The only thing that's actually live is the `recipes` table in Supabase, seeded with
> ~35 recipes by a manual founder process. Everything else you're about to read —
> the four other tables, the three Edge Functions, the learning trigger — is a
> confirmed, detailed *design*, not running code. Think of this guide as "here's how
> it's meant to work and what will bite you once it's built," not "here's how the
> existing code is organized."

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
(Next.js on Vercel) only ever talks to the backend through Supabase Edge Functions —
there are no Next.js API routes doing business logic. The Edge Functions run on Deno,
a genuinely different runtime from the Node/Vercel environment the frontend lives in.
Two module systems, two deploy pipelines, two places to think about when something
breaks.

The reason for this shape isn't accidental — it's a founder-time constraint. Supabase
bundles database, auth, serverless compute, and row-level security into one vendor,
which minimizes the number of moving pieces a solo, part-time founder has to operate
(`.context/SRS/architecture.md` §2). The trade-off is that you, the developer, absorb
the complexity the founder saved: you have to keep two runtimes straight in your head.

Everything in this system funnels through three narrow surfaces: three Edge Functions
(`generate-meal-plan`, `generate-shopping-list`, `update-recipe-status`) plus two
direct-to-Postgres client calls that bypass the Edge Function layer entirely for pure
state toggles (the shopping-list `comprado` checkbox, for instance). If you're looking
for "where does business logic live," the answer is always: inside one of those three
Edge Functions, never in the client, never in a raw RPC call
(`.context/business/business-api-map.md` §4).

## Architecture diagram (as specified — not yet built)

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
    ┌──────────────────┐          ┌──────────────────────┐
    │  SQL pre-filter /  │          │  Gemini Flash          │
    │  aggregate reads   │          │  (menu selection,      │
    │  (get_filtered_    │          │   aisle classify,       │
    │  recipes, get_     │          │   batch recipe gen)     │
    │  recent_recipe_ids)│          └──────────────────────┘
    └─────────┬──────────┘
              ▼
    ┌──────────────────────────────────────────────┐
    │  Supabase Postgres + RLS                       │
    │  recipes (LIVE) · user_profiles · meal_plans · │
    │  meal_plan_recipes · shopping_lists            │
    │  + recipe_learning_trigger (AFTER UPDATE)       │
    └──────────────────────────────────────────────┘

Every arrow in that diagram is a specified contract today, not a running call — worth
repeating because it changes how you should read the rest of this guide. When you
scaffold the real thing, the shape above is what you're building toward.

## The general flow of data

When a request lands, the pattern is always the same: the Edge Function authenticates
the caller via a Supabase Auth JWT first (`401` if missing or invalid — there is no
unauthenticated path through any of these three functions today, which is itself one
of the sharpest points of attention below), then does whatever cheap, structural
Postgres work it can before ever calling Gemini Flash, then calls the model only with
an already-filtered or already-consolidated payload, validates what comes back, and
only then persists. Nothing gets written to the database in a partial or unvalidated
state — a failure anywhere in that chain surfaces as an explicit error to the caller,
never a silently degraded result.

---

#### 2. WORKING WITH EACH FLOW

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔄 WORKING WITH EACH FLOW                                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Flow: Weekly Menu Generation

    User ──▶ generate-meal-plan ──▶ SQL pre-filter ──▶ Gemini Flash ──▶ persist ──▶ calendar
                    │                     │                  │
                 auth + 409          allergen/diet/       validates,
              (no silent          hated-ingredient       retries ≤2,
                overwrite)           exclusion            502 on exhaustion

### Context

This is the entire product promise: onboarding profile in, a full 21-slot week (7
days × breakfast/lunch/dinner) and a ready-to-render calendar out, in under 30
seconds. It's also the one flow that silently forks by subscription tier without ever
exposing that fork as a different endpoint, request field, or auth scope — Free and
Pro call the exact same URL; a server-side `isPro` check is the entire technical basis
for the €4.99/month tier.

### What to keep in mind

- The allergen and hated-ingredient exclusion happens in **two layers**, and neither
  one is trusted alone: a cheap SQL pre-filter (`get_filtered_recipes()`) runs before
  the model ever sees a recipe, and the same exclusion rules are repeated inside
  Gemini's own system-prompt instructions as "REGLAS ABSOLUTAS." Don't assume shipping
  one layer covers you — this two-layer redundancy is itself the architectural
  invariant (promoted to `ADR-0001` for exactly this reason). If you ever touch the
  filtering logic, touch both layers or neither.
- A `409` on regeneration isn't a bug you should "fix away" — a user's existing plan
  for the week is deliberately never silently overwritten.
- If fewer than 21 recipes survive the SQL pre-filter, the call fails closed with
  `422` rather than proceeding with a degraded-safety catalog. That's a feature, not
  an edge case to route around.
- The Free/Pro fork lives entirely upstream of prompt-building: for Free, the
  last-2-weeks history function (`get_recent_recipe_ids()`) is never *called* at all —
  not toggled off, never invoked. If you're debugging "why doesn't Free see history,"
  the answer is structural, not a flag you flip.
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
one prompt-building conditional — which is exactly why `ADR-0001` calls it out as the
single hardest-to-reverse bet in the whole architecture.

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
- Recording is universal across every tier; only the *next generation's prompt build*
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

    Calendar ──▶ generate-shopping-list ──▶ consolidate (app code, no LLM) ──▶ Gemini (aisle + units only) ──▶ persist
                        │                            │                                  │
                  404/409 checks              scale by household size,           validate ≥90% item
                                               sum compatible units                retention, retry ≤2

### Context

A separate, on-demand Edge Function — not a side effect of menu generation. It's
requested explicitly by the user (typically right after the menu, or on first tap of
"Ver lista de la compra"), and it has its own independent failure/retry posture.

### What to keep in mind

- Quantity math is **deterministic application code**, never something the model
  guesses. Ingredient consolidation — normalizing names, scaling by household size,
  summing compatible units — happens entirely before Gemini is ever called. The model
  is only ever handed an already-consolidated list and asked to classify aisles and
  normalize display units, at a low temperature (0.2, classification not creative
  generation). If you're tempted to let the model "help" with quantities, don't — that
  was an explicit design decision, not an oversight.
- The 90% item-retention check on the model's output exists specifically to catch the
  model silently dropping or inventing items — it isn't a cosmetic validation, it's
  the actual safety net for "did the list stay complete."
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

    Founder ──▶ batch prompt ──▶ Gemini Flash ──▶ manual 8-point review ──▶ service_role insert ──▶ recipes

### Context

This is the one flow that's already real — it's exactly what produced the ~35 live
seeded recipes. It's founder-operated and offline, not a live API endpoint, and it
exists because curated/photographed recipe content was explicitly cut from MVP scope
for cost reasons. This batch-plus-manual-review process is the deliberate substitute.

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

There's exactly one automatic process worth knowing deeply in this system — everything
else is routine `updated_at` housekeeping. No cron jobs, no scheduled tasks, no
background workers, no incoming webhooks exist anywhere in the design. Every entry
point is a synchronous, on-demand, request/response call.

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

## Gemini Flash

### What it does in the system

The only third-party service anywhere in Fresco. No payment, email, analytics, or
monitoring SDK is integrated at the API boundary — Supabase Auth is treated as core
platform, not an external line item.

### Points of contact

    Fresco backend (Supabase Edge Functions)
        │                │                │
        │                │                │
    generate-        generate-        batch recipe
    meal-plan        shopping-        generation
    (menu            list             (founder-operated,
    selection,       (aisle           offline, not a
    temp 0.7)        classify,        live Edge Function)
                      temp 0.2)
        │                │                │
        ▼                ▼                ▼
              Gemini Flash
              generativelanguage.googleapis.com

### What to consider

- `responseMimeType: 'application/json'` is a deliberate choice, not a default —
  it's specifically why the model "rarely returns malformed JSON," which is what
  makes the 30-second generation budget realistic in the first place. Don't assume
  you can drop JSON mode for some future call without re-validating that budget.
- The model string is pinned to a specific version. That's a real versioning risk —
  if Google deprecates or silently changes that model's behavior, nothing in the
  current design detects it automatically. If you're the one who eventually bumps
  the model version, budget time to re-validate output shape and the 0.7/0.2
  temperature tuning, not just swap the string.
- Failure handling differs by failure type: a non-2xx HTTP response from Gemini fails
  immediately with `502`, no retry of the transport failure itself. Malformed or
  invalid JSON output, on the other hand, gets retried up to `MAX_RETRIES = 2` before
  giving up. Know which failure mode you're looking at before you "fix" a retry loop
  that was never meant to retry that case.
- No rate-limiting or abuse-prevention mechanism exists anywhere for the two
  LLM-calling endpoints. Fine at concierge scale (8–10 users); a real, currently
  undocumented cost and abuse exposure the moment this goes past a private cohort.
- The `GEMINI_API_KEY` lives exclusively as a Supabase Edge Function secret — it must
  never be reachable from the client. If you ever see this key referenced anywhere in
  frontend code, that's a security incident, not a convenience.

---

#### 6. POINTS OF ATTENTION

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ POINTS OF ATTENTION                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Things that could bite you

- **The guest-mode gap is real, and you will hit it.** The PRD promises a first-time
  visitor can generate a full menu with zero signup (EPIC-FRESCO-6). But every
  documented Edge Function — including `generate-meal-plan`, the one this promise
  depends on — hard-requires a Supabase Auth Bearer JWT and returns `401` when it's
  absent. No source document (not the PRD, not the SRS, not the founder's own Edge
  Function draft) says whether a guest gets an anonymous Supabase session, a
  client-side-only path that bypasses this API entirely, or a guest-scoped token.
  Whoever picks up the guest-mode story needs to resolve this *before* writing code,
  not discover it mid-implementation — it's flagged as the top unresolved gap in both
  the data map and the API map.

- **The split-runtime gotcha will trip you if you're not deliberate about it.** The
  frontend runs on Node/Vercel; the backend runs on Deno inside Supabase Edge
  Functions. Two different module systems, two different standard libraries, two
  independent deploy pipelines (a frontend deploy and an Edge Function deploy are
  separate release events — fixing a broken Edge Function never requires a frontend
  redeploy, and vice versa). Don't assume an npm package that works in the frontend
  will work inside an Edge Function, and don't assume a frontend build failure means
  the backend is also broken.

- **The schema-shape gap is not a bug — it's the current, confirmed state.** Today,
  only `recipes` is live (JSONB-shaped, ~35 seeded rows). `user_profiles`,
  `meal_plans`, `meal_plan_recipes`, and `shopping_lists` don't exist as tables yet.
  Even more pointedly: the `aprendizaje` learning columns (`veces_cocinada`,
  `veces_descartada`, `rating_promedio`, `ultima_vez_en_menu`) — the entire technical
  basis for the Pro tier — are **not present on the live `recipes` table**. That means
  the learning moat, as designed, literally cannot function yet. This isn't something
  to "fix" as a bug you found; it's the expected pre-`/project-bootstrap` state, and
  the required migration is explicitly deferred to that phase. Don't be alarmed when
  you query the live table and the columns aren't there — and don't build against
  them as if they already exist.

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
- `.context/business/business-api-map.md` — the auth model, the four critical
  business journeys, and the unresolved guest-mode gap in full detail.
- `.context/SRS/architecture.md` — tech-stack rationale, the full data model, the
  security architecture, and the deployment topology.
- `.context/ADR/ADR-0001-behavioral-learning-moat.md` — the single most important
  "why does this exist" story in the system; read this before touching anything in
  the cooked/discarded or menu-generation paths.
- `DESIGN.md` — the visual system and component vocabulary (colors, typography,
  spacing, the shared `card-insight` component the Pro-tier explanation and the
  generation-warnings surfacing both rely on).

---

<!-- human-notes: anything written below this comment is preserved across regenerations -->
