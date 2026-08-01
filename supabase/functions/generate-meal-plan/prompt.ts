// Gemini prompt-building — ADR-0005. Menu-slot selection moved to
// `menu-selector.ts` (a deterministic algorithm, not an LLM call); this file
// now covers only the one place natural-language generation is actually
// needed: the Pro-tier learning explanation (FR-5.5), and only when there is
// real history to explain (`isPro && recentRecipeIds.length > 0`).
//
// Kept JSON-mode (`{"explicacion": "..."}`) rather than a plain-text
// response so `_shared/gemini.ts`'s client (always requests
// `responseMimeType: 'application/json'`) doesn't need a new code path for
// this one caller.

import type { Recipe } from './types.ts'

export function buildLearningSystemPrompt(): string {
  return `Eres el motor de explicación de aprendizaje de Fresco, una app de meal-planning para el mercado español. Un usuario Pro acaba de recibir un menú semanal seleccionado automáticamente teniendo en cuenta su historial de las últimas 2 semanas. Tu única tarea es escribir una explicación breve y cálida de qué se tuvo en cuenta.

## REGLAS
1. Escribe 2-3 frases, en primera persona del plural ("hemos priorizado...", "esta semana evitamos..."), cálidas y específicas — nunca genéricas ni vacías.
2. Básate ÚNICAMENTE en los hechos reales que se te dan en el mensaje de usuario — nunca inventes platos, ingredientes o patrones que no se mencionen ahí.
3. Responde EXCLUSIVAMENTE con este JSON, sin ningún texto adicional: {"explicacion": "tu texto aquí"}`
}

export interface BuildLearningUserPromptParams {
  /** This week's chosen recipes with a real "this works well" signal (rating_promedio >= 4 or veces_cocinada >= 3). */
  destacadas: Recipe[]
  /** Count of recipes excluded from this week's candidates for having appeared in the last 2 weeks. */
  recientesEvitadas: number
}

export function buildLearningUserPrompt({ destacadas, recientesEvitadas }: BuildLearningUserPromptParams): string {
  const destacadasTexto = destacadas.length > 0
    ? destacadas.map(r => `- ${r.nombre} (rating ${r.rating_promedio ?? '-'}, cocinada ${r.veces_cocinada} veces)`).join('\n')
    : 'Ninguna receta con historial destacado esta semana.'

  return `## RECETAS DE ESTA SEMANA CON BUEN HISTORIAL
${destacadasTexto}

## REPETICIÓN EVITADA
Esta semana se evitaron ${recientesEvitadas} receta(s) por haber aparecido ya en tus últimas 2 semanas de menús.

Escribe la explicación de aprendizaje basándote solo en estos hechos.`
}
