// Deterministic learning-explanation text builder — ADR-0005 already moved
// menu-slot selection to `menu-selector.ts`; this was the one place natural-
// language generation was still done via Gemini (FR-5.5, Pro-tier only,
// only when there's real history to explain). Killed per explicit decision
// to stop all Gemini spend now that the 1000+ recipe catalog and the recipe
// stats already computed in index.ts (destacadas, recientesEvitadas) are
// enough to build a warm, factual explanation without an LLM call.

import type { Recipe } from './types.ts'

export interface BuildLearningExplanationParams {
  /** This week's chosen recipes with a real "this works well" signal (rating_promedio >= 4 or veces_cocinada >= 3). */
  destacadas: Recipe[]
  /** Count of recipes excluded from this week's candidates for having appeared in the last 2 weeks. */
  recientesEvitadas: number
}

function joinNombres(nombres: string[]): string {
  if (nombres.length === 1) return nombres[0]
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

/**
 * Builds the Pro-tier learning-explanation text (FR-5.5) directly from the
 * recipe stats already computed by the caller — same 2-3 warm, first-person-
 * plural sentences the old Gemini prompt asked for, grounded only in the
 * real facts passed in.
 */
export function buildLearningExplanation({ destacadas, recientesEvitadas }: BuildLearningExplanationParams): string {
  const frases: string[] = []

  if (destacadas.length > 0) {
    const lista = joinNombres(destacadas.map(r => r.nombre))
    frases.push(`Esta semana hemos priorizado recetas que ya te funcionaron bien, como ${lista}.`)
  }

  if (recientesEvitadas > 0) {
    const receta = recientesEvitadas === 1 ? 'receta' : 'recetas'
    frases.push(`También evitamos ${recientesEvitadas} ${receta} que ya cocinaste en las últimas 2 semanas, para darte variedad.`)
  }

  if (frases.length === 0) {
    frases.push('Esta semana no teníamos historial reciente tuyo, así que armamos el menú priorizando variedad y equilibrio nutricional.')
  }

  return frases.join(' ')
}
