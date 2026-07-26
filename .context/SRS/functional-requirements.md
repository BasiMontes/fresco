# Functional Requirements — Fresco

> SRS output of `/project-foundation` Phase 3 (Architecture — Software side). Traces to `.context/PRD/mvp-scope.md`'s eight epics, which in turn trace to `.context/business/business-model.md`'s Scope Anchor. This document turns the PRD's vendor-agnostic user stories into a concrete, testable technical contract — it names the actual mechanisms (SQL filters, prompt rules, Edge Functions, trigger behavior) that the PRD deliberately left unspecified.
>
> **Primary source for this phase**: the founder's own technical brief — `fresco-core-tecnico.md` (recipe schema, user-profile schema, the menu-selection and batch-recipe-generation prompts), `fresco-edge-function-generate.md` (menu-generation orchestration + validation), `fresco-shopping-list.md` (aisle-grouping logic), `fresco-aprendizaje.md` (the learning loop) — richer and more current than anything consulted in the Constitution/PRD phases. Where these technical docs use Spanish field/table names (`recipes`, `veces_cocinada`, `alergenos`, …), those are quoted verbatim as literal schema identifiers, not translated, since they are the actual system vocabulary.
>
> FR numbering: `FR-<epic-number>.<sequence>`. One section per epic, in the same priority order as `mvp-scope.md`.

## EPIC-FRESCO-1: Onboarding

Traces to US 1.1, US 1.2.

**FR-1.1 — The system must collect a 3-step onboarding profile before any menu can be generated.**
- **Related to:** EPIC-FRESCO-1, US 1.1
- **Input:** diet & restrictions (`dieta_vegetariano`, `dieta_vegano`, `dieta_sin_gluten`, `dieta_sin_lactosa`, `dieta_sin_huevo`, `dieta_keto`, `dieta_halal`), allergens (`alergenos` — a subset of the 14 EU-regulated allergens), disliked ingredients (`ingredientes_odiados`), favorite cuisines (`cocinas_favoritas`), household size (`num_personas`, `adultos`, `ninos`).
- **Processing:** persist as a `user_profiles` record keyed to the authenticated user (or a guest-session equivalent — see FR-6.1's open gap).
- **Output:** a complete `user_profiles` record, sufficient on its own to call the menu-generation contract (`api-contracts.md` §1).
- **Validations:** `adultos <= num_personas`; `num_personas > 0`; if `dieta_vegano = true` then `dieta_vegetariano` must also be `true` (both constraints per the documented relational schema — see `architecture.md` §4 for a note on which schema file is authoritative for which table).

**FR-1.2 — Onboarding must not exceed 3 screens/steps.**
- **Related to:** EPIC-FRESCO-1, US 1.2
- **Input:** none — this is a flow constraint, not a data constraint.
- **Processing / Output:** n/a.
- **Validations:** any additional step beyond the 3 named ones (diet, favorite cuisines, household size) violates this requirement. Extending onboarding is a product decision requiring explicit sign-off, not something an implementation should add silently for "just one more field."

## EPIC-FRESCO-2: AI Weekly Menu Generation

Traces to US 2.1, US 2.2. Primary source: `fresco-core-tecnico.md` §3 (menu-selection prompt) and `fresco-edge-function-generate.md`.

**FR-2.1 — The system must generate a full 21-meal weekly menu (7 days × breakfast/lunch/dinner) in a single request.**
- **Related to:** EPIC-FRESCO-2, US 2.1
- **Input:** the user's filtered recipe catalog, `user_profiles` record, and (Pro only) the last-2-weeks recipe history.
- **Processing:** build a system + user prompt pair and call Gemini Flash with `responseMimeType: application/json`; validate and persist the result (see FR-2.9).
- **Output:** a `meal_plans` row plus 21 `meal_plan_recipes` rows (one per day × meal-type slot).
- **Validations:** see FR-2.9.

**FR-2.2 — Menu generation must complete within 30 seconds end-to-end.**
- **Related to:** EPIC-FRESCO-2, US 2.2
- See `non-functional-requirements.md` NFR-PERF-1 for the precise scope of "end-to-end" (it is a hard performance NFR, not a UI-perceived estimate — see that document for why).

**FR-2.3 — HARD CONSTRAINT: the system must never include a recipe containing any allergen declared by the user.**
- **Related to:** EPIC-FRESCO-2 / EPIC-FRESCO-8, US 2.1, US 8.1
- Enforced at two independent layers (defense in depth), formalized as its own cross-cutting requirement in FR-8.1: a SQL pre-filter (`get_filtered_recipes()`, excludes any recipe whose `alergenos` overlaps the user's declared `alergenos`) and the Gemini Flash system prompt's "REGLAS ABSOLUTAS" rule 1. Neither layer is trusted as sufficient on its own — see ADR-0001 and `architecture.md` §5.
- This is the single highest-priority signal in the system (see the priority table in FR-5.4).

**FR-2.4 — HARD CONSTRAINT: the system must never include a recipe containing an ingredient on the user's disliked-ingredients list.**
- **Related to:** EPIC-FRESCO-2 / EPIC-FRESCO-8, US 2.1, US 8.1
- Same two-layer enforcement as FR-2.3 (SQL pre-filter + system-prompt rule 2), one priority level below allergen exclusion.

**FR-2.5 — HARD CONSTRAINT (Pro tier only): the system must never repeat a recipe that appeared in the user's meal plans over the prior 2 weeks.**
- **Related to:** EPIC-FRESCO-2 / EPIC-FRESCO-5, US 2.1, US 5.2
- Free tier: no history is passed to the prompt at all (`historial_semanas` is omitted; `recentRecipeIds = []`), so this constraint does not — and structurally cannot — apply. Every Free-tier week is generated from zero. This is a deliberate pricing-model boundary encoded directly in the prompt-building code, not an accidental gap (see `business-model.md` Revenue Streams; ADR-0001).

**FR-2.6 — HARD CONSTRAINT: the system must never exceed the user's declared weekly budget.**
- **Related to:** EPIC-FRESCO-2, US 2.1
- Computed as the sum of each selected recipe's `coste_estimado` bucket (`muy_bajo` < 2€/person, `bajo` 2–4€, `medio` 4–7€, `alto` > 7€) across all 21 slots, implicitly scaled by household size. Compared against `presupuesto_semana_euros`.

**FR-2.7 — The generation response must be structured JSON only, matching the documented schema exactly.**
- **Related to:** EPIC-FRESCO-2, US 2.1
- Fields: `semana` (`YYYY-WXX`), `menu` (7 days × 3 meal-type slots, each a `recipe_id`), `advertencias` (array of strings). No explanatory prose, no markdown code fences — enforced by `responseMimeType: application/json` at the Gemini API level plus JSON-parse validation on receipt. Full schema: `api-contracts.md` §1.

**FR-2.8 — Quality rules apply on a best-effort basis (soft constraints, not hard-blocking):**
- **Related to:** EPIC-FRESCO-2, US 2.1
- No single category (e.g. pasta) two days in a row; alternate proteins.
- Prefer in-season recipes (`temporada`) over `todo_el_año` when both are available for a slot.
- Balance richness: a heavy stew (`es_contundente`) one day should be followed by something lighter (`es_ligero`) the next.
- Prioritize recipes with higher `veces_cocinada` and `rating_promedio` — the household/global signal that a recipe already works.
- Avoid recipes with `veces_descartada > 2` unless no alternative exists in the filtered catalog.
- Weekday slots (Mon–Fri) respect `tiempo_max_semana_min`; weekend slots (Sat–Sun) may use the longer `tiempo_max_finde_min`.
- Breakfast may repeat up to 3 times per week; lunch and dinner must never repeat within the same week (hard-validated — see FR-2.9).

**FR-2.9 — The backend must validate every generated `recipe_id` against the filtered catalog before persisting, and retry on failure.**
- **Related to:** EPIC-FRESCO-2, US 2.1
- **Input:** raw model output (untrusted).
- **Processing:** parse as JSON; verify `semana` matches the requested ISO week; verify all 7 days × 3 slots are present; verify every `recipe_id` exists in the pre-filtered catalog; verify no lunch/dinner recipe repeats within the week; verify breakfast repeat count ≤ 3. Retry up to 2 additional times (`MAX_RETRIES = 2`) on invalid JSON or a failed validation pass.
- **Output:** a validated menu object ready to persist, or an error surfaced to the caller once retries are exhausted.
- **Validations:** see the rule set above; a menu that still fails validation after all retries must not be silently accepted.

**FR-2.10 — The `advertencias` (warnings) field must be read by the backend and surfaced to the user whenever non-empty.**
- **Related to:** EPIC-FRESCO-2, US 2.1
- The model populates `advertencias` only when: no suitable recipe existed for a given slot (and what was substituted instead), the budget was too tight to preserve variety, or — the critical case — no available recipe satisfied a mandatory filter at all. The backend must not silently discard this array. A non-empty `advertencias` array indicating a mandatory-filter failure is a P0 signal, not a log line — see FR-8.2 for the safety-critical escalation this feeds.

## EPIC-FRESCO-3: Editable Calendar

Traces to US 3.1, US 3.2. Source: `schema_supabase.sql` / `fresco-schema-sql.md` (`meal_plan_recipes.estado`), `fresco-aprendizaje.md`.

**FR-3.1 — Users must be able to rearrange meals on the weekly calendar via drag & drop.**
- **Related to:** EPIC-FRESCO-3, US 3.1
- **Input:** source slot (`dia`, `tipo_plato`), target slot.
- **Processing:** move or swap the corresponding `meal_plan_recipes` row(s) between slots.
- **Output:** updated calendar view reflecting the new arrangement.
- **Validations:** a slot (`meal_plan_id`, `dia`, `tipo_plato`) must remain unique after the move (documented schema constraint `unique_slot`).

**FR-3.2 — Users must be able to change (substitute) a meal they don't like.**
- **Related to:** EPIC-FRESCO-3, US 3.2
- **Input:** `meal_plan_recipe_id`, `nueva_recipe_id`.
- **Processing:** `PATCH estado = 'sustituida'` with the new `recipe_id`.
- **Output:** updated slot. Explicitly **no effect on `aprendizaje` statistics** — a substitution is neutral, distinct from a discard (`fresco-aprendizaje.md`: "No afecta estadísticas — es neutral").
- **Validations:** `nueva_recipe_id` is required when `estado = 'sustituida'`.

## EPIC-FRESCO-4: Shopping List

Traces to US 4.1, US 4.2. Source: `fresco-shopping-list.md`.

**FR-4.1 — The system must generate a shopping list automatically from the 21 recipes in a meal plan.**
- **Related to:** EPIC-FRESCO-4, US 4.1
- **Input:** `meal_plan_id`.
- **Processing:** (1) load all 21 slots' recipes and their `ingredientes_principales`; (2) consolidate — deduplicate ingredient names (accent/case-normalized) and sum quantities, scaled per recipe by `raciones_usuario / raciones_receta`, using a base-quantity lookup table; (3) send only the already-consolidated ingredient list to Gemini Flash for aisle classification and unit normalization. The model never estimates or invents quantities — that arithmetic happens in the consolidation step, before the model is ever called.
- **Output:** a `shopping_lists` row with `items` (jsonb, grouped by aisle) plus a cost-estimate summary.
- **Validations:** the model's response must account for at least 90% of the consolidated ingredient count, or the backend retries (up to `MAX_RETRIES = 2`); an ingredient must never be silently dropped or invented.

**FR-4.2 — The shopping list must be grouped by supermarket aisle, in a fixed logical walking order.**
- **Related to:** EPIC-FRESCO-4, US 4.2
- The 13 standard aisles, in this order: Frutas y verduras, Carnes y aves, Pescados y mariscos, Charcutería y embutidos, Lácteos y huevos, Pan y bollería, Pasta/arroz/legumbres, Conservas y salsas, Aceites/vinagres/condimentos, Congelados, Bebidas, Higiene y limpieza, Otros. Only aisles with at least one item are included in the response.

**FR-4.3 — Units must be normalized to a fixed vocabulary.**
- **Related to:** EPIC-FRESCO-4, US 4.1
- `ml`/`l` for liquids, `g`/`kg` for solids, `unidades` for countables, `latas`/`botes` for canned/jarred goods — never an ambiguous abbreviation.

**FR-4.4 — Users must be able to mark individual shopping-list items as purchased.**
- **Related to:** EPIC-FRESCO-4, US 4.2
- **Processing:** a targeted `jsonb_set` update on the `comprado` boolean of a single item, addressed by `(pasillo_idx, item_idx)` — a direct client-side Supabase call, not routed through an Edge Function.

## EPIC-FRESCO-5: Cooked / Discarded Learning Toggle (Pro-gated)

Traces to US 5.1, US 5.2, US 5.3 — **the product's core moat** (see ADR-0001). Source: `fresco-aprendizaje.md`, `fresco-schema-sql.md` (`recipe_learning_trigger`).

**FR-5.1 — Every user, regardless of tier, must be able to mark a meal-plan slot as cooked, discarded, or substituted.**
- **Related to:** EPIC-FRESCO-5, US 5.1
- **Input:** `meal_plan_recipe_id`, target `estado` (`cocinada` | `descartada` | `sustituida`), optional `rating` (1–5, cooked only), `nueva_recipe_id` (substituted only).
- **Processing:** `PATCH` via the `update-recipe-status` interface (`api-contracts.md` §4); a database trigger (`recipe_learning_trigger`) reacts to the state change.
- **Output:** updated slot `estado`; for `cocinada`/`descartada`, an aggregate update to the recipe's `veces_cocinada` / `veces_descartada` / `rating_promedio` (global across all users in the MVP — see FR-5.3).
- **Validations:** a slot already `cocinada` or `descartada` is terminal and cannot be changed again (rejected). `rating`, if present, must be 1–5.

**FR-5.2 — Rating is optional and only offered after a slot is marked cooked.**
- **Related to:** EPIC-FRESCO-5, US 5.1
- The system must not force a rating; cooked/discarded alone is the primary, always-present signal — the product still learns without it.

**FR-5.3 — Recording cooked/discarded/rating must update the recipe's aggregate learning statistics.**
- **Related to:** EPIC-FRESCO-5, US 5.1
- `veces_cocinada += 1` and `ultima_vez_en_menu = today` on cook; `veces_descartada += 1` on discard; `rating_promedio` recomputed as a running average whenever a cook is rated. This aggregation is **global across all users** in the MVP by deliberate design choice (more robust with a small user base than a per-user signal would be), not per-user — the documented schema explicitly defers true per-user personalization to a future `user_recipe_stats` table (see `architecture.md` §4).

**FR-5.4 — HARD GATE (Pro only): the next weekly generation must read the user's last-2-weeks cooked/discarded history and apply it.**
- **Related to:** EPIC-FRESCO-5, US 5.2
- Free tier: recording (FR-5.1) is universal, but *application* is not — `historial_semanas` / `recentRecipeIds` is never passed to the prompt for a Free user, so generation stays from-zero regardless of accumulated data (this is the exact situation named as Edge Case 2 in `user-journeys.md`).
- Pro tier: signals are weighed in this priority order (`fresco-aprendizaje.md`):

| Priority | Signal | Source | Behavior |
|---|---|---|---|
| 1 (strongest) | Declared allergen | `user_profiles.alergenos` | hard filter, never broken |
| 2 | Disliked ingredient | `user_profiles.ingredientes_odiados` | hard filter |
| 3 | Discarded > 2 times | `recipes.veces_descartada` | avoid unless no alternative |
| 4 | In last-2-weeks history | `get_recent_recipe_ids()` | never repeat |
| 5 | Low rating (< 3) | `recipes.rating_promedio` | deprioritize |
| 6 | High rating (> 4) | `recipes.rating_promedio` | prioritize |
| 7 (softest) | Favorite cuisine | `user_profiles.cocinas_favoritas` | prefer, never force |

**FR-5.5 — HARD GATE (Pro only): a visible, specific explanation of what changed must accompany a history-informed menu.**
- **Related to:** EPIC-FRESCO-5, US 5.3
- The `advertencias` field must carry 2–3 first-person-plural sentences (e.g. *"Vimos que descartaste las recetas con berenjena, así que las hemos evitado"*) — warm, concrete, never condescending or robotic — generated only when `isPro = true` **and** real history exists (i.e. not on a Pro user's first week). This is the direct in-product answer to the Constitution's "learning must be visible" risk mitigation (`market-context.md` — Risks) and is what `DESIGN.md`'s `card-insight` component is built to render.

**FR-5.6 — Free-tier users must be shown an explicit, non-silent signal that history-based learning is Pro-only.**
- **Related to:** EPIC-FRESCO-5, US 5.1 (Edge Case 2, `user-journeys.md`)
- If a Free user's cooked/discarded toggles are not changing future menus, the product must communicate this as an upsell (e.g. *"Actualiza a Pro para que Fresco aprenda de tus gustos"*), not let the user conclude the feature is broken.

## EPIC-FRESCO-6: Guest Mode

Traces to US 6.1.

**FR-6.1 — A first-time visitor must be able to generate one full menu without creating an account.**
- **Related to:** EPIC-FRESCO-6, US 6.1
- **Input / Processing / Output:** same as FR-1.1 + FR-2.1, but keyed to an unauthenticated session rather than a Supabase Auth user.
- `[PLACEHOLDER]` — the source technical docs specify the menu-generation Edge Function as requiring a Supabase Auth `Authorization` header and returning `401` when absent (`fresco-edge-function-generate.md`, step 1). Guest mode's actual auth mechanism (an anonymous Supabase session, a client-side-only generation path, a guest-scoped token) is **not resolved by any source document** — this is a genuine, unreconciled gap between the PRD's requirement (EPIC-FRESCO-6) and the founder's own Edge Function draft, not an invented resolution here. Flagged for `/project-bootstrap` or Stage-1 story planning to resolve explicitly.

**FR-6.2** `[PLACEHOLDER]` — the fate of an unsaved guest-generated menu (discarded, retained temporarily, tied to a session cookie) is not specified in any source document (the same gap is already flagged in `user-journeys.md` Journey 1). Not invented here.

## EPIC-FRESCO-7: Progressive Signup

Traces to US 7.1.

**FR-7.1 — The signup prompt must appear only after the guest has already seen a generated menu, never before.**
- **Related to:** EPIC-FRESCO-7, US 7.1
- **Processing:** the "keep this menu" call-to-action doubles as the signup trigger, framed as retaining value already seen rather than a paywall gate (`user-journeys.md` Journey 1, Step 5).

## EPIC-FRESCO-8: Food-Safety Guardrail (cross-cutting, P0)

Traces to US 8.1. This epic does not introduce new mechanics beyond FR-2.3 / FR-2.4 / FR-2.10 — it **elevates their enforcement to a system-level invariant** every other epic must respect, per `mvp-scope.md`'s explicit "P0 regardless of the MRR/retention blacklist gate" status.

**FR-8.1 — Allergen and hated-ingredient exclusion must be enforced at two independent layers, and neither layer may be silently disabled by a future change.**
- **Related to:** EPIC-FRESCO-8, US 8.1
- **Layer 1 (structural, cheap):** `get_filtered_recipes()` excludes any recipe whose `alergenos` overlaps the user's declared `alergenos`, and any recipe whose `ingredientes_principales` overlaps `ingredientes_odiados`, before the catalog ever reaches the model.
- **Layer 2 (semantic, model-level):** the Gemini Flash system prompt repeats the same exclusion as "REGLAS ABSOLUTAS" 1–2, so the model itself refuses to select an unsafe recipe even if Layer 1 were ever bypassed or misconfigured.
- This two-layer design is the ADR-worthy architectural invariant behind the product's safety guarantee — see ADR-0001 and `architecture.md` §5.

**FR-8.2 — A non-empty `advertencias` array indicating an unmet mandatory filter must trigger a prominent, blocking-style warning to the user — never a silently logged event.**
- **Related to:** EPIC-FRESCO-8, US 8.1
- This is the safety-critical instance of the general warnings-surfacing behavior defined in FR-2.10: if the model reports it could not honor an allergen or hated-ingredient constraint for any slot, that is a P0 incident-level signal, and the affected menu must not be presented to the user as safe-by-default.

**FR-8.3 — Manual review remains the standing backstop during the pre-launch/concierge validation phase, independent of code-level enforcement.**
- **Related to:** EPIC-FRESCO-8, US 8.1
- Per `business-model.md` (Key Activities) and `market-context.md` (Risks), a human food-safety checklist runs before every menu delivered during concierge validation, regardless of whether FR-8.1/FR-8.2 are implemented yet. This SRS defines the code-level contract (FR-8.1, FR-8.2); it does not replace or supersede the manual process, which is a business-process concern outside this document's scope.
