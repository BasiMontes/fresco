import type { Recipe, UserProfile } from './types.ts'
import { describe, expect, test } from 'bun:test'
import { buildSystemPrompt, buildUserPrompt } from './prompt.ts'

/** Minimal valid UserProfile fixture — only the fields prompt.ts reads matter for these tests. */
function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    created_at: '',
    updated_at: '',
    plan: 'free',
    plan_expires_at: null,
    num_personas: 2,
    adultos: 2,
    ninos: 0,
    dieta_vegetariano: false,
    dieta_vegano: false,
    dieta_sin_gluten: false,
    dieta_sin_lactosa: false,
    dieta_sin_huevo: false,
    dieta_keto: false,
    dieta_halal: false,
    alergenos: [],
    ingredientes_odiados: [],
    ingredientes_favoritos: [],
    cocinas_favoritas: [],
    nivel_picante: 'medio',
    contundencia_preferida: 'media',
    tiempo_max_semana_min: 30,
    tiempo_max_finde_min: 60,
    presupuesto_semana_euros: null,
    ...overrides,
  }
}

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

describe('buildSystemPrompt', () => {
  test('states both food-safety absolute rules (FR-2.3 allergens, FR-2.4 disliked ingredients)', () => {
    const prompt = buildSystemPrompt()

    expect(prompt).toContain('alérgenos declarados por el usuario')
    expect(prompt).toContain('ingredientes que no le gustan')
  })

  test('mandates a visible advertencia when no safe recipe exists for a slot, never a silent unsafe substitution', () => {
    const prompt = buildSystemPrompt()

    expect(prompt).toContain('NUNCA inventes ni fuerces una receta insegura')
    expect(prompt).toContain('un menú nunca debe entregarse como seguro en silencio')
  })
})

describe('buildUserPrompt', () => {
  test('serializes declared allergens and disliked ingredients verbatim, so the guardrail is visible to the model', () => {
    const prompt = buildUserPrompt({
      profile: makeProfile({ alergenos: ['gluten', 'huevo'], ingredientes_odiados: ['cebolla'] }),
      recipes: [makeRecipe()],
      recentRecipeIds: [],
      semanaIso: '2026-W05',
      isPro: false,
    })

    expect(prompt).toContain('gluten, huevo')
    expect(prompt).toContain('cebolla')
  })

  test('Free tier never includes recentRecipeIds in the prompt, even when the caller passes some (ADR-0001 invariant)', () => {
    const prompt = buildUserPrompt({
      profile: makeProfile(),
      recipes: [makeRecipe()],
      recentRecipeIds: ['recipe-should-never-appear'],
      semanaIso: '2026-W05',
      isPro: false,
    })

    expect(prompt).not.toContain('recipe-should-never-appear')
    expect(prompt).toContain('Plan Free: no se aplica historial de repetición')
  })

  test('Pro tier with history includes recentRecipeIds so REGLA ABSOLUTA 3 can be enforced', () => {
    const prompt = buildUserPrompt({
      profile: makeProfile({ plan: 'pro' }),
      recipes: [makeRecipe()],
      recentRecipeIds: ['recipe-42'],
      semanaIso: '2026-W05',
      isPro: true,
    })

    expect(prompt).toContain('recipe-42')
    expect(prompt).toContain('NO repetir (REGLA ABSOLUTA 3)')
  })

  test('notes the catalog is already SQL-filtered by allergens/disliked ingredients (Layer 1 of FR-8.1)', () => {
    const prompt = buildUserPrompt({
      profile: makeProfile(),
      recipes: [makeRecipe()],
      recentRecipeIds: [],
      semanaIso: '2026-W05',
      isPro: false,
    })

    expect(prompt).toContain('Ya filtrado por alérgenos/dieta/ingredientes no deseados a nivel SQL')
  })
})
