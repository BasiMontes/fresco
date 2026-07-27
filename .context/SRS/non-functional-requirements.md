# Non-Functional Requirements — Fresco

> SRS output of `/project-foundation` Phase 3 (Architecture — Software side). Traces to `.context/PRD/executive-summary.md` (Success Metrics) and the founder's technical brief (`fresco-core-tecnico.md`, `fresco-edge-function-generate.md`, `fresco-shopping-list.md`, `fresco-schema-sql.md`). Scoped deliberately to what a solo, part-time founder's MVP actually needs — see `business-model.md` (Key Resources: "Founder time and attention, currently the primary constraint") — not a generic enterprise NFR checklist. Metrics are quantified wherever a source document supports a number; anything without source backing is marked `[PLACEHOLDER]` rather than invented.

## 1. Performance

**NFR-PERF-1 — Menu generation completes in under 30 seconds, end-to-end, including the Gemini Flash call.**
- Source: `mvp-scope.md` US 2.2 ("under 30 seconds… so the experience feels effortless") and `executive-summary.md` Success Metrics ("full weekly menu + shopping list produced in under 30 seconds").
- **Scope clarification (resolving an ambiguity between those two source statements):** the founder's own Edge Function implementation (`fresco-edge-function-generate.md`) treats menu generation and shopping-list generation as **two separate, independently invoked Edge Functions** — `generate-meal-plan` runs at the end of onboarding / on regeneration; `generate-shopping-list` is invoked later, on demand, "right after generating the menu, or when the user taps 'View shopping list' for the first time." Given that implementation reality, this NFR reads the 30-second promise as applying to the **menu-generation call alone**: request → user-profile load → SQL pre-filter → prompt build → Gemini Flash `generateContent` call (including up to `MAX_RETRIES = 2` retries on invalid output) → validation → persist to `meal_plans`/`meal_plan_recipes` → response. It is a hard, measurable, p95 SLA, not a UI-perceived estimate — the retries live inside the budget, not outside it. The Executive Summary's combined "menu + shopping list" phrasing is read as the *pitch-level* promise, not a single technical SLA spanning two independently-triggered backend calls; if the founder intends a literal end-to-end 30s bound covering both actions in sequence, that is a scope change to confirm explicitly, not to assume here.

**NFR-PERF-2 — Shopping-list generation.**
- `[PLACEHOLDER]` — no source document states an explicit latency target for `generate-shopping-list` alone. It is architecturally similar to menu generation (same retry pattern, same Gemini Flash call shape) but classification-only (temperature 0.2, no creative variety needed) against a much smaller payload (~60–80 unique ingredients vs. a ~300-recipe catalog), so it should be materially faster in practice. Recommend adopting the same reliability envelope (`MAX_RETRIES = 2`) without inventing a numeric target; set one from real measurement once the Edge Function exists.

**NFR-PERF-3 — Baseline frontend performance (conventional targets, not founder-sourced).**
- Largest Contentful Paint < 2.5s, Time to Interactive < 3s, on the Vercel Edge Network. These are standard Next.js/Vercel baselines, not a number from the founder brief — included because a slow *shell* around a fast menu-generation call would still undermine the "faster than doing nothing" promise (`user-personas.md` — Laura's willingness-to-pay threshold: a usable menu in under 60 seconds total).

## 2. Security

**NFR-SEC-1 — Authentication is Supabase Auth (JWT), verified on every Edge Function call.**
- Every Edge Function (`generate-meal-plan`, `generate-shopping-list`, `update-recipe-status`) requires an `Authorization` header and calls `supabase.auth.getUser()` before doing any work; a missing or invalid token returns `401` (source: all three Edge Function drafts, `fresco-edge-function-generate.md`, `fresco-shopping-list.md`, `fresco-aprendizaje.md`).
- **Known gap, not resolved here:** this auth requirement conflicts with EPIC-FRESCO-6 (Guest Mode, no account required) — see FR-6.1's `[PLACEHOLDER]`. Guest mode needs its own auth story before `generate-meal-plan` can serve it; this NFR does not silently assume a resolution.

**NFR-SEC-2 — Row Level Security (RLS) must be enabled on every user-owned table, scoped to `auth.uid()`.**
- `user_profiles`, `meal_plans`, `meal_plan_recipes`, `shopping_lists`: `select`/`insert`/`update`/`delete` policies restricted to the row's own `user_id` (directly, or via a join back to `meal_plans.user_id` for `meal_plan_recipes`) — per `fresco-schema-sql.md` §8.
- `recipes`: **resolved.** `schema_supabase.sql` is the confirmed-live, executed schema (see `architecture.md` §4) — its `select`-to-`anon` policy is authoritative, and it is also the correct one functionally: EPIC-FRESCO-6 requires guest (unauthenticated) menu generation to read the recipe catalog. `fresco-schema-sql.md`'s stricter `authenticated`-only policy describes the un-executed design and does not apply.
- Recipe **writes** (the batch-generation pipeline) go through `service_role` only, bypassing RLS from the backend with the service key — never from the client (`fresco-schema-sql.md` §8, "Notas Importantes").

**NFR-SEC-3 — The Gemini API key must never be exposed to the client.**
- Stored as a Supabase Edge Function secret (`GEMINI_API_KEY`), read via `Deno.env.get()` inside the Edge Function runtime only. `SUPABASE_URL` / `SUPABASE_ANON_KEY` are injected automatically and are safe for client use; `GEMINI_API_KEY` is not (source: `fresco-edge-function-generate.md` — "Variables de entorno necesarias").

**NFR-SEC-4 — Allergen and dietary-restriction safety is a reliability-critical NFR, not merely a functional feature.**
- This restates FR-8.1/FR-8.2 as a non-functional guarantee: the two-layer enforcement (SQL pre-filter + prompt hard rule) must maintain a zero-tolerance error budget for allergen leakage. Unlike ordinary feature bugs, a single allergen-leakage incident is a trust and safety failure, not a UX defect — `market-context.md` (Risks: "Food-safety risk (allergies / dietary restrictions handled incorrectly)") names this explicitly as a top-tier product risk, mitigated during the concierge phase by the manual checklist (FR-8.3) precisely because code-level enforcement alone is not yet trusted as sufficient.

**NFR-SEC-5 — Standard input validation and transport security.**
- Server-side validation on every Edge Function input (request body shape, required fields) before any DB or LLM call — already present in each Edge Function draft's early-return error handling. HTTPS/TLS in transit is inherited from the Vercel + Supabase platforms; no source document calls for anything beyond platform defaults, and none is invented here.

## 3. Scalability

Deliberately scoped to the MVP's real, current scale — a solo, part-time founder with a concierge cohort of 8–10 users during validation (`market-context.md` — Validation Plan). No premature horizontal-scaling, sharding, or multi-region design belongs in this document.

**NFR-SCALE-1 — The platform choices are inherently serverless/auto-scaling at MVP scale.**
- Vercel (frontend) and Supabase Edge Functions (Deno-based backend) both scale automatically within their platform limits; no custom scaling configuration is needed for a cohort measured in single-digit-to-low-double-digit concurrent users.

**NFR-SCALE-2 — The recipe catalog (~230–300 rows at launch, per the batch-generation plan in `fresco-core-tecnico.md` §4) is well within comfortable range for the documented GIN-indexed filtering approach** (`idx_recipes_dieta`, `idx_recipes_alergenos`, etc., `schema_supabase.sql` §2) — no partitioning or caching layer is warranted at this size.

**NFR-SCALE-3 — Concurrent-user targets.**
- `[PLACEHOLDER]` — no source document states a numeric concurrency target beyond the concierge cohort size (8–10 users, `market-context.md`). Setting a formal capacity target now would be fabricated precision; revisit once concierge-validation usage data exists.

## 4. Reliability

**NFR-REL-1 — Both Gemini-calling Edge Functions retry on invalid or malformed model output, bounded at `MAX_RETRIES = 2`.**
- Applies to `generate-meal-plan` (JSON-parse failure or validator failure) and `generate-shopping-list` (JSON-parse failure, missing `pasillos` field, or < 90% ingredient-count retention). A menu or list that still fails after all retries never persists a partial or silently-invalid result: `generate-meal-plan` surfaces this as an explicit `422` (AC-4, distinct from a genuine upstream `502`); `generate-shopping-list` surfaces it as `502` (source: both Edge Function drafts).

**NFR-REL-2 — Known gap: `generate-meal-plan` has no atomic multi-table write.**
- The founder's own draft persists `meal_plans` first, then `meal_plan_recipes`; if the second insert fails, it performs a manual compensating delete of the orphaned `meal_plans` row rather than relying on a real transaction, because "Supabase no tiene transacciones nativas en Edge Functions" (`fresco-edge-function-generate.md` — Notas de implementación). This is documented here as a known reliability gap and a candidate for a future single-transaction Postgres RPC, not silently resolved or hidden.

**NFR-REL-3 — Uptime and error-rate targets.**
- `[PLACEHOLDER]` — no source document states a formal uptime SLA or error-rate budget, and inventing enterprise-grade figures (99.9% uptime, < 1% error rate) for a pre-launch, concierge-stage product with a single founder operating it would misrepresent operational maturity that does not exist yet. The concierge-stage reliability bar that *is* explicit in the source material is qualitative, not a percentage: **no menu is ever delivered without a surfaced warning if `advertencias` is non-empty** (NFR-SEC-4 / FR-8.2) — that is the operative reliability contract for launch, not a numeric SLA.

## 5. Accessibility

**NFR-A11Y-1 — WCAG 2.2 Level AA across the product**, per `DESIGN.md`'s own stated compliance target for its component set (design tokens were lint-checked against AA during the design-system phase).

**NFR-A11Y-2 — One documented, scoped exception is inherited from `DESIGN.md`, not newly introduced here:** the `button-action` component (orange fill, cream/white text) measures ~2.4:1 contrast — below the 4.5:1 AA minimum for normal text. `DESIGN.md` explicitly scopes this bypass to short, heading-font, all-caps-weight CTA labels (the "Cocinar ya" pattern, one per screen) and explicitly forbids extending it to body copy or any text longer than two-to-three words. This SRS carries that constraint forward as a hard boundary: any implementation reusing the `button-action` treatment for longer text is an accessibility regression, not a legitimate reuse of an approved exception.

**NFR-A11Y-3 — Body text has a hard floor of 15px for anything read while cooking.**
- Directly tied to the product's real usage context — Laura is planning or cooking while glancing at a phone from across a counter (`DESIGN.md` — Don'ts: "the target user is planning and cooking at the same time"). This is treated as an accessibility/usability NFR, not a purely visual-design preference: shrinking recipe-step or shopping-list body text for density trades away legibility in the exact moment the product is most likely to be used one-handed and at a distance.

**NFR-A11Y-4 — Standard interaction accessibility:** full keyboard navigation for all interactive elements (including drag-and-drop calendar reordering, which needs a keyboard-operable fallback — not specified by any source document beyond the general AA target, `[PLACEHOLDER]` for the specific interaction pattern), and screen-reader labels on the icon-only controls (`button-icon`, the cooked/discard/swap actions) since `DESIGN.md`'s icon set carries no text label by default.

## 6. Maintainability

Kept intentionally light — no source document specifies coverage targets, linting configuration, or documentation standards beyond what `/project-bootstrap` and this repository's own `CLAUDE.md` stack conventions (§10, TypeScript + DRY) already establish.

**NFR-MAINT-1 — Dual runtime awareness.** The frontend (Next.js, per `.agents/project.yaml`) and the backend Edge Functions (Deno, per every founder Edge Function draft) are two different JavaScript/TypeScript runtimes with different module resolution and standard-library behavior. This is not itself a defect, but it is a maintainability fact worth stating explicitly: shared types/utilities between frontend and Edge Functions cannot assume Node-specific or browser-specific APIs are available in both.

**NFR-MAINT-2 — Domain identifiers stay in Spanish, matching the schema.** Every founder source document — recipe fields, user-profile fields, prompt field names — uses Spanish identifiers (`alergenos`, `veces_cocinada`, `ingredientes_odiados`, …) consistently across the schema, the prompts, and the Edge Function types. Future code should preserve this vocabulary rather than silently translating it to English mid-stack, since the prompt text, the DB schema, and any UI copy sourced from `advertencias` all depend on the same literal strings matching.

## 7. Out of scope for this NFR set

Per the Out-of-Scope Blacklist in `mvp-scope.md`, none of the following are addressed here and should not be retrofitted until the blacklist's own gate (MRR > €5,000 **and** 30-day retention > 50%) is met: multi-region deployment, formal disaster-recovery/RPO-RTO targets, load-testing benchmarks beyond the concierge cohort's scale, internationalization/localization beyond the Spain/Spanish-language baseline already implicit in every source document, and a native-app performance profile.
