# ADR-0005 — Deterministic algorithm fills the 21 menu slots; Gemini scoped to the Pro learning explanation only

- **Status:** Accepted
- **Date:** 2026-08-01
- **Deciders:** Founder (product + technical decision, drafted by AI workflow for approval, approved live in-session)
- **Tags:** performance, ai-integration, cross-cutting-invariant, generation-pipeline
- **Supersedes:** —
- **Superseded by:** —

---

## Context

`generate-meal-plan` originally asked Gemini (`gemini-3.6-flash`) to pick all 21 recipe_ids for the week in one call, given the full SQL-filtered candidate catalog serialized into the prompt. That made sense when the catalog was ~35–55 recipes: too small and too sparsely tagged for a plain scoring algorithm to reliably fill 21 slots while respecting the soft quality rules (category variety, seasonal preference, contundencia balance, rating/history weighting).

The catalog grew to 314 recipes this session (`.context/bitacora.md`, 2026-08-01 entries), specifically to guarantee every onboarding restriction axis has real depth per meal type. That same growth made generation visibly slower for the least-restrictive profiles: a lenient profile's filtered candidate set can now exceed 300 rows, and `gemini-3.6-flash` is a thinking model — `_shared/gemini.ts`'s own comment already documents 241–283+ `thoughtsTokenCount` reasoning tokens spent before any visible output, on *any* input size. A prompt-size cap (`prompt.ts`, capped at 40 recipes/tipo_plato) shipped earlier the same session and helped marginally, but the dominant latency source is the model's own reasoning time, not input size — a lever prompt trimming can't pull further.

The user reported the live effect directly (screenshot, onboarding step 3 stuck on "Generando menú…" for the full ~60s window) and proposed the real fix: with a catalog this large and this well-structured (every recipe carries `dieta`, `alergenos`, `meta.tiempo_total_min`, `clasificacion.categoria/es_contundente/es_ligero`, `veces_cocinada`/`veces_descartada`/`rating_promedio`), filling 21 slots is no longer a task that needs a language model's judgment — it is a constrained-selection problem with clean, structured inputs, which is exactly what a scoring algorithm is for.

## Decision

**We will select all 21 weekly menu slots with a deterministic in-process algorithm, and call Gemini only for the Pro-tier learning-explanation text — never for slot selection itself.**

Concretely:
- `menu-selector.ts` (new) replaces the menu-generation half of `prompt.ts` + the retry loop in `index.ts`. It consumes the same SQL-pre-filtered candidate set `get_filtered_recipes()` already produces (FR-8.1 Layer 1 is untouched — the absolute allergen/diet/disliked-ingredient rules stay enforced at the SQL layer, same as before) and picks one recipe per slot via a scored heuristic: time-limit fit (weekday vs weekend), no lunch/dinner repeat within the week (breakfast capped at 3 repeats — same limits `validator.ts` used to check post-hoc, now enforced by construction), category-variety and contundencia-balance penalties against the immediately preceding slot, seasonal-match and rating/history bonuses, a `veces_descartada > 2` soft penalty, and a small randomization jitter so repeat generations for an identical profile don't always return the identical week.
- **Pro-tier history avoidance (ADR-0001's core mechanism) moves from a prompt instruction to a hard exclusion filter**: `recentRecipeIds` (last 2 weeks, Pro only) are removed from the candidate pool before scoring, rather than being *told* to an LLM as a rule it might not perfectly follow. This makes the ADR-0001 invariant — "no code path may pass Free-tier history into a generation prompt" — easier to hold, not harder: Free-tier code never reads `recentRecipeIds` at all (unchanged), and Pro's avoidance is now a hard filter instead of a soft instruction.
- When a slot's filtered-and-scored pool is empty (a real "no safe recipe" case, FR-8.2 / AC Scenario 4, same case FRESCO-23 handles), the algorithm assigns `NO_SAFE_RECIPE_SENTINEL` and appends the same explanatory `advertencias` entry the prompt-based version used to ask Gemini to write — now templated directly in TypeScript, guaranteeing the "never silent" rule holds by construction instead of by hoping the model complies.
- Gemini is still called, but only for `explicacion_aprendizaje` (FR-5.5), and only when `isPro && recentRecipeIds.length > 0` — a small, focused prompt ("here are the specific recipes avoided/prioritized and why, write 2-3 warm sentences"), not a 21-slot selection task. This is the one place genuine natural-language generation is actually needed, and it stays real.
- `validator.ts`'s structural checks (JSON-parse failure, ID not in catalog, malformed shape, lunch/dinner repeat, breakfast-repeat cap) become largely unreachable by construction (the algorithm can't emit an invalid recipe_id or a structural malformation the way parsing untrusted LLM JSON could) — the file is trimmed to just the budget soft-warning calculation, called directly from `menu-selector.ts`.

## Consequences

**Positive:**
- Generation drops from ~20–110s (thinking-model latency, unavoidable per-call) to sub-second for the 21-slot fill — the actual user-facing complaint this ADR responds to.
- The MAX_RETRIES retry loop (`index.ts`) and most of the AC-4 "IA no generó un menú válido tras N intentos" 422 path become dead code for the menu-fill step — a deterministic algorithm doesn't produce malformed JSON or hallucinate a truncated uuid the way `gemini-3.6-flash` was observed doing live earlier this session (the bug this ADR's own prior fix, `0ec383f`, had to guard against). An entire class of previously-real bugs stops being reachable.
- Pro's history-avoidance guarantee gets *stronger*, not weaker: a hard filter can't be "talked out of" the way a prompt instruction theoretically could be by an unusual catalog shape or a model that drifts on edge cases.
- Removes the Gemini API as a hard dependency for the Free-tier core promise entirely — a Gemini outage now degrades Pro's explanation card (optional, already null-tolerant) instead of blocking every user's ability to generate a menu at all.

**Negative / trade-offs:**
- The "soft quality rules" (category variety, seasonal preference, contundencia balance) are now whatever the scoring function actually encodes, not whatever an LLM could flexibly infer from a natural-language instruction — genuinely novel/creative variety (an LLM noticing a subtle pattern nobody coded for) is traded for a fixed, auditable, but less adaptive heuristic. Tuning it well is now an ongoing engineering task, not a prompt-wording tweak.
- Two code paths now exist where one did before: the deterministic selector (menu fill) and a small Gemini call (learning explanation) — more surface than a single unified prompt, though each piece is individually simpler.
- The product's "IA que aprende de lo que realmente cocinas" positioning is now literally true only for the Pro-tier explanation text and the history-exclusion mechanism, not for the moment-to-moment choice of which recipe fills which slot. This was disclosed to and accepted by the founder directly in-session as a deliberate trade-off given the course-project/demo context — for a real business decision, this framing should be revisited before any public-facing copy is written that implies the whole menu is LLM-selected.

**Neutral / follow-ups:**
- If the catalog's structured metadata (rating, contundencia, category tags) ever proves too coarse to produce menus that feel as varied/interesting as the old prompt-based approach did, the scoring function is the single place to iterate — not a prompt-engineering exercise.
- `prompt.ts` and `validator.ts` both shrink substantially; a follow-up pass should re-read their doc comments (several of which narrate the now-removed retry/JSON-parse story) so the file's own comments don't describe dead code.

## Alternatives considered

- **Keep the single Gemini call, further shrink the prompt.** Rejected: already tried this session (40-recipe-per-tipo cap) — it helps marginally but the dominant latency source is the thinking model's own reasoning time per call, not input size, so this lever is close to exhausted.
- **Switch to a non-thinking Gemini model.** Rejected: `_shared/gemini.ts`'s own history already documents that `gemini-1.5-flash` (non-thinking) was fully deprecated by Google and `gemini-2.5-flash` was rejected live as unavailable to this project's API key — `gemini-3.6-flash` (thinking) is the only GA flash-tier model this key can currently use, so this option isn't actually available, not just undesirable.
- **Cache full generated menus keyed by exact profile signature.** Considered (raised implicitly by the user's "load them into Supabase" framing) but not the mechanism chosen: profile space (dieta flags × alérgenos × ingredientes_odiados × cocinas_favoritas × household size × budget × time limits) is too large to precompute meaningfully, and a cache still needs *something* to build the first entry for a novel signature — it doesn't remove the need for a selection mechanism, only defers repeat cost. The deterministic algorithm removes the cost at the source instead.

## References

- `.context/ADR/ADR-0001-behavioral-learning-moat.md` — the invariant this ADR's Pro-history-exclusion mechanism must continue upholding (it does; see Decision above).
- `.context/bitacora.md` — 2026-08-01 entries: the 55→150→314-recipe catalog growth that created both the enabling condition (rich structured metadata) and the triggering problem (larger filtered sets, slower prompts) for this decision.
- `supabase/functions/generate-meal-plan/_shared/gemini.ts` — the thinking-model latency characteristics this ADR responds to.
- `.context/PBI/tech-debts/TECHDEBT-FRESCO-23-*` / commit `0ec383f` — the malformed-uuid-from-Gemini bug class this change makes structurally unreachable for the menu-fill step.
