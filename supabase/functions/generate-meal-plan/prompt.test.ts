import type { Recipe } from './types.ts'
import { describe, expect, test } from 'bun:test'
import { buildLearningSystemPrompt, buildLearningUserPrompt } from './prompt.ts'

/** Minimal valid Recipe fixture — only the fields the learning prompt reads matter here. */
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

describe('buildLearningSystemPrompt (ADR-0005 — Gemini scoped to the learning explanation only)', () => {
  test('mandates 2-3 warm, specific sentences grounded only in the given facts', () => {
    const prompt = buildLearningSystemPrompt()

    expect(prompt).toContain('2-3 frases')
    expect(prompt).toContain('ÚNICAMENTE en los hechos reales')
  })

  test('mandates the JSON-mode contract the shared Gemini client requires', () => {
    const prompt = buildLearningSystemPrompt()

    expect(prompt).toContain('{"explicacion"')
  })
})

describe('buildLearningUserPrompt', () => {
  test('lists real destacadas by name with their rating and veces_cocinada', () => {
    const prompt = buildLearningUserPrompt({
      destacadas: [makeRecipe({ nombre: 'Fabada asturiana', rating_promedio: 4.5, veces_cocinada: 7 })],
      recientesEvitadas: 3,
    })

    expect(prompt).toContain('Fabada asturiana')
    expect(prompt).toContain('rating 4.5')
    expect(prompt).toContain('cocinada 7 veces')
  })

  test('states the real recientesEvitadas count', () => {
    const prompt = buildLearningUserPrompt({ destacadas: [], recientesEvitadas: 5 })

    expect(prompt).toContain('se evitaron 5 receta(s)')
  })

  test('never invents a destacada when none qualify — states so explicitly instead of an empty section', () => {
    const prompt = buildLearningUserPrompt({ destacadas: [], recientesEvitadas: 0 })

    expect(prompt).toContain('Ninguna receta con historial destacado esta semana.')
  })
})
