---
topic_key: pbi/FRESCO-9/review
---

# Code Review — FRESCO-9 (Food Safety Guardrail)

Stage 3 review run retroactively (solo-main strategy — commit `34310b2` already committed and pushed to `main` before this review). Native `gentle-ai` bounded review lifecycle: `lineage=review-9f0d32b46f3e1f27`, `risk_level=high` (1542 changed lines across FRESCO-5+9 combined diff, base `87bf9cb`), full 4R lens sweep. Findings below are the FRESCO-9-relevant subset, adjudicated.

## Adjudicated findings

| # | Severity | File:line | Finding | Verdict | Action |
|---|---|---|---|---|---|
| 1 | WARNING | `supabase/functions/generate-meal-plan/prompt.ts` | Prompt-injection surface: `alergenos`/`ingredientes_odiados` interpolated unescaped into the LLM prompt from unconstrained DB columns (same root cause as FRESCO-5 finding #2 — see `.../STORY-FRESCO-5.../review.md`). Impact is bounded — `validator.ts`'s unchanged `validRecipeIds` membership check means Layer 1 (SQL pre-filter) cannot be bypassed regardless of prompt content — but could defeat Layer 2's "advertencias" warning honesty. | legitimate | **fix now** (same fix as FRESCO-5 #2, shared root cause) |
| 2 | WARNING | `supabase/functions/generate-meal-plan/prompt.ts` | Zero test coverage for `buildSystemPrompt`/`buildUserPrompt` — the actual guardrail-text deliverable of this story. Prior session's assumption ("no test runner for `supabase/functions/**`") does not hold: no `deno.json`/`bunfig.toml` exists, `prompt.ts`/`types.ts` are Deno-API-free (type-only imports), so `bun test` would in fact discover and run a co-located `prompt.test.ts`. `tsconfig.json` only excludes the directory from `tsc --noEmit`, not from bun's test runner. | legitimate, actionable | **fix now** — add `prompt.test.ts` |
| 3 | WARNING | `supabase/functions/generate-meal-plan/validator.ts`, `index.ts` (both unchanged by this diff) | AC scenario 4 ("no safe recipe for a slot → visible warning, menu never delivered as fully safe") cannot actually reach a user today: `validator.ts` treats an empty/invalid slot as a hard error → bounded retry → flat `502` on exhaustion, never a partial menu + `advertencias` banner. This diff's prompt-text change makes the scenario *exercisable* for the first time (previously both prompt functions threw unconditionally), but the gap itself lives entirely in `validator.ts`/`index.ts`. | legitimate observation, **not a FRESCO-9 blocker** — story's own Jira "Fuera de Alcance" field explicitly excludes "el resto del flujo de generación de menú semanal (propiedad de la historia de Generación de Menú)" | **no fix** — tracked as a FRESCO-7 dependency, not touched (out of this story's stated scope, S8) |
| 4 | INFORMATIONAL | `components/ui/alert-banner.tsx` | Component built but not wired into any real page — confirmed accurate: its own doc comment scopes wiring to FRESCO-7, matches the story's Jira Out-of-Scope field. Not a defect or a misrepresented completion claim. | accurate, no defect | none |
| 5 | NIT | `components/ui/alert-banner.tsx:49-51` | List items keyed by array index instead of content. | legitimate, trivial | **fix now** (1-line, zero risk) |

## Spec Compliance Matrix

| AC scenario (Gherkin) | covered_by | evidence | status |
|---|---|---|---|
| Single allergen → zero matching recipes in menu | test (pre-existing, unchanged) | `get_filtered_recipes()` SQL pre-filter (Layer 1, `20260725120100_create_fresco_core_tables.sql` + `20260726000000_fix_get_filtered_recipes_keto_halal.sql`) — structural exclusion, independent of this diff | covered |
| Single disliked ingredient → zero matching recipes | test (pre-existing, unchanged) | same `get_filtered_recipes()` function, same WHERE clause | covered |
| Multiple simultaneous restrictions, none deprioritized | test (pre-existing, unchanged) | both clauses ANDed in one WHERE — no priority trade-off possible by construction | covered |
| No safe recipe for a slot → clear visible warning, never delivered as fully safe | **uncovered**, tracked as FRESCO-7 dependency | Layer 2 prompt text added (this diff) instructs the model correctly, but `validator.ts`/`index.ts` (FRESCO-7 territory per this story's own Out-of-Scope) has no structural path to deliver a partial menu + warning — it hard-fails instead. `AlertBanner` component exists and is ready but unwired. | uncovered — explicitly deferred to FRESCO-7 per story's Fuera de Alcance field, not silently dropped |

## Next

Fixes 1-2 and 5 applied as forward commits (shared with FRESCO-5's fix batch where root cause overlaps). Finding 3's AC-4 gap is real but belongs to FRESCO-7 (Menu Generation) — already reflected in `.context/dev-roadmap.md`'s FRESCO-7 hard-blocker note; no action here beyond this record.
