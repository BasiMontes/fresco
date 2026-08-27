# Domain Glossary — Fresco

> Discovery output of `/project-foundation` Phase 4, Step 6 — the final Discovery step. Canonical domain terminology: the single vocabulary every later artifact (Jira content, docs, code comments, UI copy) must speak. Seeded from the Constitution (`.context/business/business-model.md`, `market-context.md`), the PRD (`.context/PRD/`), the SRS (`.context/SRS/`), and `ADR-0001-behavioral-learning-moat.md`.
>
> **This file is hand-maintained and append-only from this point forward.** `/project-foundation` runs this step exactly once and will never regenerate or overwrite this file on a future run — unlike the `[SYNC]`-tagged files under `.context/PBI/`, this is authored content, not a Jira mirror. See §5 for the update protocol.

---

## §0 — Read This First: Spanish Identifiers Are Literal, Not Placeholders

This system deliberately mixes English prose with **literal Spanish schema and field identifiers** — e.g., "the `recipes` table's `aprendizaje` sub-object tracks `veces_cocinada`" or "a slot's `estado` transitions through `pendiente → cocinada / descartada / sustituida`."

A newcomer might reasonably assume these Spanish terms are translation artifacts, placeholder text, or illustrative examples. **They are not.** They are the actual, real, load-bearing table names, column names, enum values, and prompt-schema field names in the live and designed database (`.context/SRS/architecture.md` §4, `.context/SRS/api-contracts.md`). The founder's own technical brief (`fresco-core-tecnico.md`, `fresco-schema-sql.md`, `fresco-aprendizaje.md`) defines the system in Spanish because the product's market and content (Spanish/Latin home cooking, per `api-contracts.md` §5) are Spanish-first — this is not an incomplete localization pass.

**Rule for anyone writing code, migrations, or prompts against this system: do not rename these identifiers to English equivalents.** `veces_cocinada` stays `veces_cocinada`, not `times_cooked`; `estado_receta_menu` stays `estado_receta_menu`, not `recipe_status_enum`. Renaming them would silently diverge implementation from every spec document that references them by their real name, and would break the traceability chain from FR → API contract → data model that this whole `.context/` tree depends on.

English prose is used for everything else in this glossary and its sibling documents (explanations, business framing, UI-copy guidance) — only the schema/field/enum vocabulary itself stays Spanish, because that vocabulary IS the system, not a description of it.

---

## §1 — Core Acronyms

| Term | Expansion | Definition |
|---|---|---|
| **MVP** | Minimum Viable Product | The P0 scope defined in `.context/business/business-model.md` (Scope Anchor) and `.context/PRD/mvp-scope.md` — the 8 epics that must ship before the concierge validation loop runs. Not a synonym for "small" or "rough" — the MVP still carries a P0 food-safety guarantee (EPIC-FRESCO-8). |
| **KPI** | Key Performance Indicator | This product has exactly one **north-star KPI**: weekly menus generated **and used** — explicitly not money "saved" or receipts scanned (`business-model.md` — Value Propositions; `executive-summary.md` — Success Metrics). |
| **PRD** | Product Requirements Document | The `.context/PRD/` folder — vendor-agnostic product definition (executive summary, personas, MVP scope, user journeys). Traces back to the Constitution (`business-model.md`, `market-context.md`); precedes the SRS. |
| **SRS** | Software Requirements Specification | The `.context/SRS/` folder — turns the PRD's vendor-agnostic user stories into a concrete, testable technical contract (functional requirements, non-functional requirements, architecture, API contracts). Names actual mechanisms (SQL filters, prompt rules, Edge Functions) the PRD deliberately left unspecified. |
| **ADR** | Architecture Decision Record | An append-only record of a hard-to-reverse architecture decision, stored under `.context/ADR/`. This project has 14 (`ADR-0001`–`ADR-0014`; `ADR-0006` is the only gap). `ADR-0001-behavioral-learning-moat.md` formalizes the Free/Pro data-model split; the rest cover guest auth, deterministic menu selection, Stripe, Sentry, PostHog, pg_cron, web-push, rate limiting, and the testing architecture. |
| **RLS** | Row Level Security | The Postgres/Supabase authorization mechanism this system relies on instead of traditional role-based access control — every user-owned table is scoped to `auth.uid()` (`.context/SRS/architecture.md` §5; `non-functional-requirements.md` NFR-SEC-2). There is no `admin`/`user` role distinction anywhere in this system; authorization is row-ownership-based, not role-based. |
| **NFR** | Non-Functional Requirement | A requirement in `.context/SRS/non-functional-requirements.md`, numbered `NFR-<CATEGORY>-<N>` (e.g. `NFR-PERF-1`, `NFR-SEC-2`). Governs performance, security, reliability, and scale constraints that sit alongside, not inside, the FRs. |
| **FR** | Functional Requirement | A requirement in `.context/SRS/functional-requirements.md`, numbered `FR-<epic-number>.<sequence>` (e.g. `FR-2.3`, `FR-5.4`). One section per PRD epic, same priority order as `mvp-scope.md`. |
| **FEAT** | Feature (catalog ID) | The feature-inventory identifier used in `.context/business/business-feature-map.md` and referenced by `.context/master-implementation-plan.md` (e.g. `FEAT-013`, `FEAT-015`, `FEAT-016`). Distinct from FR — FEAT ids track shippable feature units for roadmap sequencing, FR ids track individual testable requirements. |

**Note on ICP:** "Ideal Customer Profile" is a common product-vocabulary acronym but does **not** appear literally in any Fresco source document — this product's founder-authored docs consistently say "customer segment," "persona," or "target user" (`business-model.md` — Customer Segments; `user-personas.md`). It is deliberately omitted from this table rather than introduced as new vocabulary the source material doesn't use; if the founder starts using "ICP" going forward, add it here per §5.

---

## §2 — Methodology Terms

**Concierge MVP** — The founder-scaled, manual-service validation phase preceding any further product investment: a landing page + waitlist (weeks 1–2), followed by the founder personally generating and delivering menus as PDFs to a small (8–10 person) cohort with weekly follow-up over 3–4 consecutive weeks (`.context/business/market-context.md` — Validation Plan). Success bar: at least 3 of 10 users both pay and repeat for 3+ consecutive weeks. Not a synonym for "beta" or "soft launch" — it is explicitly manual, founder-operated, and precedes any product code being validated at scale.

**Behavioral-learning moat** — ADR-0001's term of art for the product's core defensibility mechanism: the system observes what a household actually cooks versus discards (the `cocinada`/`descartada` toggle) and adjusts future menus from that signal, rather than from declared/typed preferences. Named explicitly as the alternative *rejected* by the founder — "declared-preference personalization" — because a stateless AI chat tool can trivially replicate remembering a typed preference, but cannot replicate a compounding behavioral history without asking the user to redo work every session (`ADR-0001-behavioral-learning-moat.md` — Context, Decision). See also the anti-glossary entry on "preferences" vs. "learning" (§4).

**Master Sprint** — The dependency-ordered execution-cluster unit used in `.context/master-implementation-plan.md` and `.context/dev-roadmap.md` to sequence the 8 PRD epics (Master Sprint 0, 1, 2 — e.g., Master Sprint 0 = EPIC-1 + EPIC-2 + EPIC-8, "prove the core promise, safely"). Distinct from a sprint in the Scrum/agile sense (a fixed time-box) — a Master Sprint here is a dependency cluster of epics that must ship together because none is separately useful, not a calendar interval.

---

## §2.5 — Post-MVP Product Concepts

Concepts introduced after the original 8 MVP epics (all Finalizada/Listo as of Master Sprint 0-2 closeout) shipped. Added here per the §5 Change Protocol, in the same change that introduces the Jira epic using the term.

**Recetas disponibles** — The count of catalog `recipes` a given user can actually eat, i.e. the size of the result set `get_filtered_recipes(p_user_id)` returns for them (excludes anything matching their declared allergens/disliked ingredients/diet flags — see `user_profiles` in §3 below). Surfaced to the user as a single number (e.g. on the Inicio panel's recipe-count card) — not the raw `recipes` catalog total, which is the same for every user regardless of restrictions.

---

## §2.6 — Post-MVP Subscription, Observability & Delivery Terms

Terminology introduced by the five August 2026 epics — Suscripción Pro / Stripe (EPIC-FRESCO-227), Centro de Avisos (EPIC-FRESCO-223), product analytics (FRESCO-240), weekly re-engagement push (FRESCO-241), and production error tracking (FRESCO-242). Added as a catch-up per FRESCO-284 (the glossary had drifted behind these epics); from here forward the §5 Change Protocol applies — add the term in the same change that introduces it.

**Suscripción (Pro)** — The paid plan state on `user_profiles` (`plan = 'pro'`, plus `plan_expires_at`, `stripe_customer_id`, `stripe_subscription_id`, `payment_failed_at`). Introduced by EPIC-FRESCO-227, which reverses the MVP-scope deferral of self-serve payment (`ADR-0007`; `.context/PRD/mvp-scope.md` — "Scope reversal"). Pricing is fixed: Free €0 vs Pro €4.99/mes, 7-day trial with no card at signup (`.context/business/business-model.md` — Revenue Streams). **Not an auth tier** — see the anti-glossary entry on "Free-tier access / Pro-tier permission" (§4); `plan` only branches application logic.

**Stripe** — The payment vendor for the Pro subscription, fixed by `ADR-0007` (Stripe Checkout in `subscription` mode: Stripe-hosted page, server-created session, `client_reference_id` = the Supabase `auth.uid()`). The PRD stays vendor-agnostic and does not name it; the SRS/ADR layer does. Do **not** introduce a parallel `subscriptions` table without superseding `ADR-0007` — the `user_profiles` columns above are the subscription state of record.

**trial** — The 7-day free-access window granted when a user starts a Pro subscription, with **no card required at signup** (`trial_period_days: 7`, `payment_method_collection: 'if_required'` — `ADR-0007`). A trial is a Pro subscription that has not yet converted to a paid period — distinct from the permanent €0 **Free plan**.

**webhook** — In this system, the Stripe webhook handler (`POST /api/stripe/webhook`, verified against `STRIPE_WEBHOOK_SECRET`). It is the **only** write path into `user_profiles` for subscription state (`plan`, `stripe_customer_id`, `stripe_subscription_id`, `plan_expires_at`, `payment_failed_at`) — never written from the client or the checkout-return page (`ADR-0007` — the single-writer invariant, enforced by DB policy: `20260818190000_protect_subscription_columns_from_client_writes`). Stripe is the source of truth for subscription state; the webhook is the projection into our DB.

**analytics (product analytics)** — Event-stream instrumentation for measuring the North-star KPI ("weekly menus generated **and used**") and the repeat-usage MVP hypothesis (`FRESCO-240`). Answers "what did users do". Not the same as error tracking (see "Sentry"). Vendor fixed by `ADR-0013`.

**PostHog** — The product-analytics vendor (`ADR-0013`): PostHog Cloud, EU region, wired via `posthog-js` (client provider in `app/layout.tsx`) + `posthog-node` (`lib/posthog/server.ts`, for API routes and the Stripe webhook where a browser `capture()` cannot fire). Every `identify()` uses the Supabase `auth.uid()` as `distinct_id`, including guest/anonymous users (`ADR-0003`), so a guest's pre-signup events merge losslessly into the post-signup stream. The single product-analytics sink — no parallel tracking calls.

**Sentry** — The error-tracking vendor (`ADR-0009`, `FRESCO-242`): `@sentry/nextjs` wired across all three Next.js runtimes (client / server / edge) via `sentry.*.config.ts` + `instrumentation.ts` (`onRequestError`). Answers "what broke". The single error-tracking sink — any new runtime entry point routes through the existing wiring, never a second parallel path.

**push (web push)** — Browser Web Push notifications, used only by the weekly re-engagement reminder (`FRESCO-241`). **Distinct from Centro de Avisos** (passive in-app content) and from the blacklisted "aggressive push notifications" (`.context/PRD/mvp-scope.md`) — this is a single weekly opt-in reminder, not a briefing stream. Pipeline: a `pg_cron` + `pg_net` scheduled job (`ADR-0011`) invokes the `send-weekly-reengagement-push` Edge Function, which does VAPID signing + payload encryption via the `web-push` library (`ADR-0012`) against rows in `push_subscriptions`. Opt-in is a per-device toggle in `/profile`.

**Centro de Avisos / aviso** — The in-app `/notifications` page and the passive notices it shows when the user opens it (EPIC-FRESCO-223): welcome message (FRESCO-224), main-app-routes guide (FRESCO-225), recipe recommendations (FRESCO-226), plus a payment-failure notice (FRESCO-232). **Explicitly not push, not email, not native notifications** — those are out of MVP scope. An `aviso` is content rendered inside the page, gated by flags on `user_profiles` (e.g. `aviso_bienvenida_visto`, `aviso_rutas_descartado`). Contrast with **push** (browser notification, proactive).

**pg_cron / pg_net** — The database-native scheduler (`pg_cron`) and async-HTTP extension (`pg_net`) for all time-based jobs (`ADR-0011`). Pure-SQL jobs (e.g. `cleanup-abandoned-guest-users`, `FRESCO-238`) run inside the DB; a job that must reach an Edge Function uses a `pg_cron` entry whose body is a `net.http_post()` to the function URL, authenticated with the service-role key (Vault-backed, never a literal in the migration). No second scheduler (Vercel Cron, GitHub Actions cron) for database-adjacent work.

---

## §3 — Product Entities

Short-form definitions only — full column shapes, relationships, and status (live vs. designed) live in `.context/business/business-data-map.md` §2 (Entity Map).

- **`recipes`** — The shared, cross-user recipe catalog every menu is selected from. The only entity that is **live** (executed in Supabase, ~35 seeded as of this Discovery pass, ~230-recipe target). JSONB-flexible shape (`meta`, `clasificacion`, `dieta`, `alergenos`, `ingredientes_principales`, `temporada`). → see `business-data-map.md` §2 for the full entity map and its `aprendizaje` (learning-fields) migration gap.
- **`user_profiles`** — One row per authenticated user: onboarding output (diet flags, allergens, disliked ingredients, favorite cuisines, household size, budget). The minimum input any menu-generation call needs. Designed, not yet live. → see `business-data-map.md` §2.
- **`meal_plans`** — One row per user per ISO week; the container for a generated menu's metadata (`semana_iso`, `advertencias`, `completado`). Not the menu content itself — that lives in `meal_plan_recipes`. Designed, not yet live. → see `business-data-map.md` §2.
- **`meal_plan_recipes`** — The join table holding the 21 individual (day × meal-type) slots inside one `meal_plans` row, each with its own lifecycle state (`estado_receta_menu`). This is where the cooked/discarded/substituted signal is actually recorded, slot by slot. Designed, not yet live. → see `business-data-map.md` §2.
- **`shopping_lists`** — One aisle-grouped shopping list per meal plan, stored as `items` jsonb. Generated on demand, not automatically, by a separate Edge Function from menu generation. Designed, not yet live. → see `business-data-map.md` §2.

---

## §4 — Anti-Glossary

Banned or ambiguous terms, their correct replacement, and why.

| Banned / ambiguous term | Correct replacement | Why |
|---|---|---|
| "receipts" (as a feature) | "recipes" | Fresco generates **recipes** (weekly menu content), never **receipts**. Receipt scanning is an explicitly blacklisted feature (`business-model.md` — Out-of-Scope Blacklist), gated behind MRR > €5,000 and 30-day retention > 50%. A stray "receipts" typo or misreading of a founder filename (e.g. one of the founder's own technical-brief files is misleadingly named around "receipts" despite its content being recipe-batch generation) must never be read as license to build the blacklisted feature. |
| "preferences" used loosely for the Pro-tier value proposition | "hard dietary filtering" (declared, always-on, both tiers) vs. "behavioral learning" (Pro-only, from cooked/discarded history) | Per ADR-0001, these are structurally different mechanisms, not interchangeable synonyms. `user_profiles.alergenos` / `ingredientes_odiados` are declared, hard, always-on filters present for every tier (FR-2.3, FR-2.4) — this is *not* the moat. The moat is specifically the behavioral, compounding cooked/discarded signal, which is Pro-gated. Calling hard dietary filtering "personalization" or "learning" muddies the exact distinction the pricing model is built on. |
| "recording" and "application" used interchangeably as "learning" | keep them distinct: **recording** (universal, every tier, unconditional) vs. **application** (Pro-only — reading that history into the next generation prompt) | ADR-0001's Decision section is explicit: "we... gate its *application* — not its *recording* — behind the Pro tier." Every user's cooked/discarded toggle is captured identically regardless of plan (FR-5.1, FR-5.3); only Pro-tier generation *reads that history back in* (FR-5.4). Saying "Free users don't get learning" is imprecise — Free users' behavior IS recorded, it is simply never applied to their own future menus. |
| "menu" meaning a single recipe or a single day | "menu" always means the full 21-slot weekly plan | A `meal_plans` row plus its 21 `meal_plan_recipes` children (7 days × breakfast/lunch/dinner) is "the menu" (FR-2.1, `api-contracts.md` §1). A single dish is a "recipe"; a single day's three meals is not given its own term in any source document — do not invent "daily menu" as a scoped-down reuse of "menu." |
| "Free-tier access" / "Pro-tier permission" implying an auth/RBAC distinction | "Free plan" / "Pro plan" (a business-logic branch, not an authorization boundary) | Per `.context/business/business-api-map.md`, both Free and Pro users are equally "Authenticated" — there is no separate auth tier. `plan_usuario` (`free \| pro \| family`) only changes which branch of application logic runs (e.g., whether `historial_semanas` is read), never which RLS policy or role applies. Do not describe upgrading to Pro as "gaining access" or "getting permission" — say it changes what the generation prompt receives. |

---

## §5 — Change Protocol

This glossary is updated **first**, in the same change (same PR) that introduces new domain terminology — not backfilled afterward. When this glossary conflicts with another document, **this glossary wins**. Jira content (epics, stories, acceptance criteria, comments) must match this glossary's terms exactly, not a paraphrase of them.

This file is hand-maintained and append-only from the moment it is first written: `/project-foundation` runs this Discovery step exactly once per project and will never regenerate or silently overwrite it on a later run, unlike the `[SYNC]`-tagged files under `.context/PBI/`. New terms are added as new entries under the relevant section (§1–§4); existing entries are corrected in place only when the underlying source document they trace to has itself changed — never fabricated or removed to "clean up" the glossary.
