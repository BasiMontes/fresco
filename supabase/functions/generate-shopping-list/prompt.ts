// Gemini prompt-building for aisle classification + unit normalization —
// api-contracts.md §2b. Deferred to /sprint-development per the bootstrap
// scope: this file defines the real function signatures the index.ts control
// flow calls, but the prompt text itself is left as a TODO rather than
// copied in wholesale, so the actual model-tuning pass (temperature,
// wording, few-shot examples if needed) happens as a reviewable story, not
// silently baked in during infrastructure scaffolding.
//
// Full specification to implement against: api-contracts.md §2b (rules +
// exact output JSON schema), fresco-shopping-list.md (system/user prompt
// text + the 13 fixed aisles in walking order), functional-requirements.md
// FR-4.1-FR-4.4.

import type { IngredienteConsolidado } from './types.ts'

/**
 * TODO(sprint-development): return the system prompt from api-contracts.md
 * §2b / fresco-shopping-list.md — the 13-aisle vocabulary (exact names, in
 * walking order), unit-normalization rules, and the "never invent, never
 * drop an ingredient" constraint (FR-4.1).
 */
export function buildShoppingSystemPrompt(): string {
  throw new Error(
    'buildShoppingSystemPrompt() not implemented — see api-contracts.md §2b, fresco-shopping-list.md'
  )
}

export interface BuildShoppingUserPromptParams {
  ingredientes: IngredienteConsolidado[]
  semanaIso: string
  numPersonas: number
  numRecetas: number
}

/**
 * TODO(sprint-development): serialize `ingredientes` (already consolidated
 * by consolidator.ts — never send raw per-recipe ingredients here) plus
 * semanaIso/numPersonas/numRecetas as context-only fields, per
 * fresco-shopping-list.md's USER PROMPT template.
 *
 * CLAUDE.md §10: 3+ params → object param, hence the single-object signature.
 */
export function buildShoppingUserPrompt({
  ingredientes,
  semanaIso,
  numPersonas,
  numRecetas,
}: BuildShoppingUserPromptParams): string {
  throw new Error(
    `buildShoppingUserPrompt() not implemented — ${ingredientes.length} ingredients, ` +
      `${semanaIso}, ${numPersonas}p, ${numRecetas} recetas — see api-contracts.md §2b`
  )
}
