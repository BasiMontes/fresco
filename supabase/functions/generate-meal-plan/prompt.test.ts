import type { Recipe } from './types.ts'
import { describe, expect, test } from 'bun:test'
import { buildLearningExplanation } from './prompt.ts'

/** Minimal valid Recipe fixture — only the fields the learning explanation reads matter here. */
function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-1',
    created_at: '',
    updated_at: '',
    nombre: 'Receta de prueba',
    slug: 'receta-de-prueba',
    descripcion_corta: null,
    meta: null,
    clasificacion: null,
    dieta: null,
    alergenos: null,
    ingredientes_principales: null,
    ingredientes_que_puede_desagradar: null,
    temporada: null,
    pasos_resumen: null,
    veces_cocinada: 0,
    veces_descartada: 0,
    rating_promedio: null,
    ultima_vez_en_menu: null,
    ...overrides,
  }
}

describe('buildLearningExplanation (ADR-0005 — deterministic, no Gemini call)', () => {
  test('mentions a single destacada by name', () => {
    const texto = buildLearningExplanation({
      destacadas: [makeRecipe({ nombre: 'Fabada asturiana' })],
      recientesEvitadas: 0,
    })

    expect(texto).toContain('Fabada asturiana')
  })

  test('joins multiple destacadas with "y" before the last one', () => {
    const texto = buildLearningExplanation({
      destacadas: [
        makeRecipe({ nombre: 'Fabada asturiana' }),
        makeRecipe({ nombre: 'Tortilla de patatas' }),
        makeRecipe({ nombre: 'Gazpacho' }),
      ],
      recientesEvitadas: 0,
    })

    expect(texto).toContain('Fabada asturiana, Tortilla de patatas y Gazpacho')
  })

  test('states the real recientesEvitadas count, singular', () => {
    const texto = buildLearningExplanation({ destacadas: [], recientesEvitadas: 1 })

    expect(texto).toContain('evitamos 1 receta ')
  })

  test('states the real recientesEvitadas count, plural', () => {
    const texto = buildLearningExplanation({ destacadas: [], recientesEvitadas: 5 })

    expect(texto).toContain('evitamos 5 recetas ')
  })

  test('never invents a destacada when none qualify and there is nothing recent avoided — falls back to a generic warm sentence', () => {
    const texto = buildLearningExplanation({ destacadas: [], recientesEvitadas: 0 })

    expect(texto).toContain('armamos el menú priorizando variedad y equilibrio nutricional')
  })
})
