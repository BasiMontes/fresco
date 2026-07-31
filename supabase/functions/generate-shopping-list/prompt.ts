// Gemini prompt-building for aisle classification + unit normalization —
// api-contracts.md §2b, FR-4.2 (13-aisle vocabulary), FR-4.3 (unit
// vocabulary). Founder's original draft (fresco-shopping-list.md) isn't
// present in this repo — written directly against the authoritative spec
// docs instead, same approach and structure as
// generate-meal-plan/prompt.ts (this project's reference implementation for
// Gemini prompt style).

import type { IngredienteConsolidado } from './types.ts'

const PASILLOS = [
  'Frutas y verduras',
  'Carnes y aves',
  'Pescados y mariscos',
  'Charcutería y embutidos',
  'Lácteos y huevos',
  'Pan y bollería',
  'Pasta/arroz/legumbres',
  'Conservas y salsas',
  'Aceites/vinagres/condimentos',
  'Congelados',
  'Bebidas',
  'Higiene y limpieza',
  'Otros',
]

/**
 * FR-4.2/FR-4.3, api-contracts.md §2b — the 13 fixed aisles (exact names, in
 * walking order) and the fixed unit vocabulary are non-negotiable rules, so
 * this is implemented for real, unlike the TODO this file replaces.
 */
export function buildShoppingSystemPrompt(): string {
  return `Eres el motor de clasificación de listas de la compra de Fresco, una app de meal-planning para el mercado español. Tu única tarea es tomar una lista de ingredientes ya consolidada (sumada y deduplicada) y organizarla en pasillos de supermercado, respetando estrictamente las siguientes reglas.

## REGLAS ABSOLUTAS (no negociables — incumplir cualquiera de estas invalida la lista)
1. Asigna cada ingrediente a EXACTAMENTE uno de estos 13 pasillos fijos, en este orden de pasillo (no reordenes los pasillos): ${PASILLOS.join(', ')}. Cuando un ingrediente podría encajar en más de uno, elige el más específico (p. ej. tomate frito en lata → "Conservas y salsas", no "Frutas y verduras").
2. Normaliza las unidades a este vocabulario fijo, sin abreviaturas ambiguas: "ml"/"l" para líquidos, "g"/"kg" para sólidos, "unidades" para contables, "latas"/"botes" para conservas.
3. Ordena los ítems alfabéticamente dentro de cada pasillo.
4. NUNCA inventes un ingrediente que no esté en la lista de entrada. NUNCA elimines uno de los ingredientes de entrada.
5. Responde ÚNICAMENTE con el JSON especificado más abajo. Sin texto explicativo, sin markdown, sin bloques de código.

## PASILLOS
Incluye en la respuesta SOLO los pasillos que tengan al menos un ítem — omite cualquier pasillo vacío.

## ESTIMACIÓN DE COSTE
"resumen.coste_estimado_min"/"coste_estimado_max" son una estimación de mejor esfuerzo contra precios de supermercado español de referencia (2024), NUNCA un precio exacto o garantizado. Si no tienes confianza suficiente para estimar, responde 0/0 en vez de adivinar.

## FORMATO DE SALIDA
Responde EXCLUSIVAMENTE con este JSON, sin ningún texto adicional:
{
  "pasillos": [
    {
      "nombre": "Frutas y verduras",
      "orden": 1,
      "items": [
        { "nombre": "cebolla", "cantidad": 4, "unidad": "unidades", "comprado": false }
      ]
    }
  ],
  "resumen": {
    "total_items": 0,
    "coste_estimado_min": 0,
    "coste_estimado_max": 0,
    "moneda": "EUR"
  }
}
"orden" es la posición (1-indexada) del pasillo dentro de la lista fija de arriba, no el orden en que aparece en tu respuesta. "comprado" siempre empieza en "false".`
}

export interface BuildShoppingUserPromptParams {
  ingredientes: IngredienteConsolidado[]
  semanaIso: string
  numPersonas: number
  numRecetas: number
}

/**
 * Serializes the already-consolidated ingredient list (consolidator.ts —
 * deterministic, no LLM involved) plus semanaIso/numPersonas/numRecetas as
 * context-only fields, per api-contracts.md §2b: "the model is explicitly
 * told the list is already summed and deduplicated."
 *
 * CLAUDE.md §10: 3+ params → object param, hence the single-object signature.
 */
export function buildShoppingUserPrompt({
  ingredientes,
  semanaIso,
  numPersonas,
  numRecetas,
}: BuildShoppingUserPromptParams): string {
  const catalogo = ingredientes
    .map(ingrediente => `${ingrediente.nombre}|${ingrediente.cantidad}|${ingrediente.unidad}`)
    .join('\n')

  return `## SEMANA
${semanaIso} — ${numPersonas} persona(s) en el hogar, ${numRecetas} recetas en el menú (contexto únicamente, no recalcules cantidades).

## INGREDIENTES YA CONSOLIDADOS (sumados y deduplicados — esta es la única fuente válida, no añadas ni quites ingredientes)
Formato por línea: nombre|cantidad|unidad

${catalogo}

Clasifica cada ingrediente de la lista anterior en su pasillo y responde con el JSON especificado en las instrucciones del sistema.`
}
