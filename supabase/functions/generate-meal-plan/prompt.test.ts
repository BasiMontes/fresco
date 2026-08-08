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

describe('buildLearningExplanation (ADR-0005 — deterministic, no Gemini call; FRESCO-120 — real cocinada/descartada signal)', () => {
  test('mentions a single destacada by name', () => {
    const texto = buildLearningExplanation({
      destacadas: [makeRecipe({ nombre: 'Fabada asturiana' })],
      cocinadasEvitadas: 0,
      descartadasEvitadas: 0,
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
      cocinadasEvitadas: 0,
      descartadasEvitadas: 0,
    })

    expect(texto).toContain('Fabada asturiana, Tortilla de patatas y Gazpacho')
  })

  test('states the real cocinadasEvitadas count, singular', () => {
    const texto = buildLearningExplanation({ destacadas: [], cocinadasEvitadas: 1, descartadasEvitadas: 0 })

    expect(texto).toContain('evitamos 1 receta ')
    expect(texto).toContain('ya cocinaste')
  })

  test('states the real cocinadasEvitadas count, plural', () => {
    const texto = buildLearningExplanation({ destacadas: [], cocinadasEvitadas: 5, descartadasEvitadas: 0 })

    expect(texto).toContain('evitamos 5 recetas ')
  })

  test('states the real descartadasEvitadas count, singular, and never calls a discard "cocinaste"', () => {
    const texto = buildLearningExplanation({ destacadas: [], cocinadasEvitadas: 0, descartadasEvitadas: 1 })

    expect(texto).toContain('dejamos fuera 1 receta ')
    expect(texto).toContain('descartaste')
    expect(texto).not.toContain('cocinaste')
  })

  test('states the real descartadasEvitadas count, plural', () => {
    const texto = buildLearningExplanation({ destacadas: [], cocinadasEvitadas: 0, descartadasEvitadas: 3 })

    expect(texto).toContain('dejamos fuera 3 recetas ')
  })

  test('mentions both cocinadas and descartadas when both are present, never conflating them', () => {
    const texto = buildLearningExplanation({ destacadas: [], cocinadasEvitadas: 2, descartadasEvitadas: 1 })

    expect(texto).toContain('evitamos 2 recetas que ya cocinaste')
    expect(texto).toContain('dejamos fuera 1 receta que descartaste')
  })

  test('never invents a destacada when none qualify and there is nothing recent avoided — falls back to a generic warm sentence', () => {
    const texto = buildLearningExplanation({ destacadas: [], cocinadasEvitadas: 0, descartadasEvitadas: 0 })

    expect(texto).toContain('armamos el menú priorizando variedad y equilibrio nutricional')
  })
})
