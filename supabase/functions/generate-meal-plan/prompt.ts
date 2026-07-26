// Gemini prompt-building for weekly menu selection. Deferred to
// /sprint-development per the bootstrap scope: index.ts's control flow
// (auth, SQL pre-filter, Free/Pro history branch, retry loop, persistence,
// rollback) is real; the prompt text itself is left as a TODO so the actual
// model-tuning pass happens as a reviewable story.
//
// This does NOT weaken the food-safety guardrail (FR-8.1 Layer 2): the rules
// below are the exact, already-specified requirements the implementation
// MUST carry over verbatim — nothing here is left to the implementer's
// judgment. Full text: functional-requirements.md FR-2.3-FR-2.8,
// fresco-core-tecnico.md §3 SYSTEM PROMPT.
//
// ## REGLAS ABSOLUTAS (non-negotiable — FR-2.3, FR-2.4, FR-2.5, FR-2.6, FR-2.7)
// 1. NEVER include a recipe containing any of the user's declared allergens.
// 2. NEVER include a recipe with an ingredient on the user's ingredientes_odiados list.
// 3. NEVER repeat a recipe from the last-2-weeks history (Pro only — history is
//    omitted entirely for Free, see the isPro branch in index.ts).
// 4. NEVER exceed the user's declared weekly budget (sum of per-recipe coste_estimado).
// 5. Respond ONLY with the specified JSON — no prose, no markdown fences.
//
// ## REGLAS DE CALIDAD (best-effort — FR-2.8)
// - Vary categories/proteins day to day; prefer in-season recipes; balance
//   contundente/ligero; prioritize high veces_cocinada/rating_promedio; avoid
//   veces_descartada > 2 unless no alternative; respect weekday vs weekend
//   time budgets; breakfast may repeat up to 3x, lunch/dinner never.
//
// ## PRO-ONLY ADDENDUM (FR-5.5) — only when isPro && real history exists:
// populate advertencias with 2-3 warm, specific, first-person-plural sentences
// explaining what was adjusted and why.

import type { Recipe, UserProfile } from './types.ts'

/**
 * TODO(sprint-development): return the literal system prompt built from the
 * rules documented above (fresco-core-tecnico.md §3 has the exact wording).
 */
export function buildSystemPrompt(): string {
  throw new Error(
    'buildSystemPrompt() not implemented — see functional-requirements.md FR-2.3-FR-2.8, fresco-core-tecnico.md §3'
  )
}

export interface BuildUserPromptParams {
  profile: UserProfile
  recipes: Recipe[]
  recentRecipeIds: string[]
  semanaIso: string
  isPro: boolean
}

/**
 * TODO(sprint-development): serialize profile + filtered catalog + history
 * section into the user prompt. `isPro` gates whether `recentRecipeIds` is
 * included at all — per ADR-0001, no code path may pass Free-tier history
 * into a generation prompt; keep that invariant when implementing this.
 *
 * CLAUDE.md §10: 3+ params → object param, hence the single-object signature.
 */
export function buildUserPrompt({
  profile,
  recipes,
  recentRecipeIds,
  semanaIso,
  isPro,
}: BuildUserPromptParams): string {
  throw new Error(
    `buildUserPrompt() not implemented — ${recipes.length} recipes, ` +
      `${recentRecipeIds.length} history ids, isPro=${isPro}, week=${semanaIso}, ` +
      `profile=${profile.id} — see api-contracts.md §1a, fresco-core-tecnico.md §3`
  )
}
