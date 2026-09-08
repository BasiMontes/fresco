import type { DiaSemana, Recipe, Temporada, TipoPlatoSlot, UserProfile } from './types.ts'
import { describe, expect, test } from 'bun:test'
import fc from 'fast-check'
import { selectMenu } from './menu-selector.ts'
import { NO_SAFE_RECIPE_SENTINEL, SLOT_EXCLUDED_SENTINEL } from './types.ts'

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const TIPOS: TipoPlatoSlot[] = ['desayuno', 'comida', 'cena']

/** A fixed tie-break seed for the assertions that don't care which specific menu comes out. */
const SEED = 'user-1:2026-W01'

const ALL_DAYS_ALL_MEALS: Record<DiaSemana, TipoPlatoSlot[]> = Object.fromEntries(
  DIAS.map(dia => [dia, TIPOS]),
) as Record<DiaSemana, TipoPlatoSlot[]>

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    planning_selection: ALL_DAYS_ALL_MEALS,
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

function makeRecipe(id: string, tipoPlato: TipoPlatoSlot, overrides: Partial<Recipe> = {}): Recipe {
  return {
    id,
    created_at: '',
    updated_at: '',
    nombre: `Receta ${id}`,
    slug: id,
    descripcion_corta: null,
    meta: { tiempo_prep_min: 10, tiempo_coccion_min: 10, tiempo_total_min: 20, raciones: 2, coste_estimado: 'bajo', dificultad: 'facil' },
    clasificacion: { tipo_plato: tipoPlato, categoria: 'guiso', cocina: 'española', es_contundente: false, es_ligero: true, es_comfort_food: false, apto_tupper: true, apto_congelar: false },
    dieta: null,
    alergenos: null,
    ingredientes_principales: null,
    ingredientes_que_puede_desagradar: null,
    temporada: ['todo_el_ano'],
    pasos_resumen: null,
    veces_cocinada: 0,
    veces_descartada: 0,
    rating_promedio: null,
    ultima_vez_en_menu: null,
    ...overrides,
  }
}

/** A generous, varied catalog — enough real candidates per tipo_plato that no slot needs the sentinel. */
function buildAmpleCatalog(): Recipe[] {
  const recipes: Recipe[] = []
  for (const tipo of TIPOS) {
    for (let i = 0; i < 30; i++) {
      recipes.push(makeRecipe(`${tipo}-${i}`, tipo))
    }
  }
  return recipes
}

describe('selectMenu — structural guarantees (ADR-0005)', () => {
  test('fills all 21 slots from an ample catalog, none as the sentinel', () => {
    const { menu } = selectMenu({ candidates: buildAmpleCatalog(), recentRecipeIds: [], seed: SEED, profile: makeProfile() })

    for (const dia of DIAS) {
      for (const tipo of TIPOS) {
        expect(menu[dia][tipo]).not.toBe(NO_SAFE_RECIPE_SENTINEL)
      }
    }
  })

  test('never repeats a comida or cena recipe within the same week', () => {
    const { menu } = selectMenu({ candidates: buildAmpleCatalog(), recentRecipeIds: [], seed: SEED, profile: makeProfile() })

    const comidaIds = DIAS.map(dia => menu[dia].comida)
    const cenaIds = DIAS.map(dia => menu[dia].cena)
    expect(new Set(comidaIds).size).toBe(comidaIds.length)
    expect(new Set(cenaIds).size).toBe(cenaIds.length)
  })

  test('never repeats a desayuno recipe more than 3 times in the week', () => {
    // A scarce breakfast pool (only 2 distinct recipes for 7 slots) forces
    // real repeats — proves the cap holds under pressure, not just when
    // there's enough variety to never need to repeat at all.
    const candidates = [
      makeRecipe('desayuno-a', 'desayuno'),
      makeRecipe('desayuno-b', 'desayuno'),
      ...buildAmpleCatalog().filter(r => r.clasificacion?.tipo_plato !== 'desayuno'),
    ]
    const { menu } = selectMenu({ candidates, recentRecipeIds: [], seed: SEED, profile: makeProfile() })

    const counts = new Map<string, number>()
    for (const dia of DIAS) {
      const id = menu[dia].desayuno
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    for (const count of counts.values()) {
      expect(count).toBeLessThanOrEqual(3)
    }
  })

  test('Pro-tier recentRecipeIds are hard-excluded from every slot (ADR-0001 invariant, enforced here not by prompt instruction)', () => {
    const catalog = buildAmpleCatalog()
    const recentRecipeIds = catalog.filter(r => r.clasificacion?.tipo_plato === 'cena').slice(0, 25).map(r => r.id)

    const { menu } = selectMenu({ candidates: catalog, recentRecipeIds, seed: SEED, profile: makeProfile({ plan: 'pro' }) })

    const chosenCenaIds = DIAS.map(dia => menu[dia].cena)
    for (const id of chosenCenaIds) {
      expect(recentRecipeIds).not.toContain(id)
    }
  })

  test('a tipo_plato with zero compatible recipes gets the sentinel and one food-safety-framed advertencia (A4-M3)', () => {
    const candidates = buildAmpleCatalog().filter(r => r.clasificacion?.tipo_plato !== 'cena')
    const { menu, advertencias } = selectMenu({ candidates, recentRecipeIds: [], seed: SEED, profile: makeProfile() })

    for (const dia of DIAS) {
      expect(menu[dia].cena).toBe(NO_SAFE_RECIPE_SENTINEL)
    }
    // No safe recipe of this tipo exists at all → the message names allergies
    // and diet, and is deduped to one line per tipo (not one per day).
    const cenaWarnings = advertencias.filter(a => a.includes('cena') && a.includes('compatible con tus alergias'))
    expect(cenaWarnings).toHaveLength(1)
  })

  test('a tipo_plato that runs out of DISTINCT recipes mid-week warns about variety, not food safety (A4-M3)', () => {
    // Only 3 distinct cena recipes exist → days 4-7 cannot be filled without
    // repeating a lunch/dinner. The message must not use food-safety language.
    const ample = buildAmpleCatalog()
    const threeCenas = ample.filter(r => r.clasificacion?.tipo_plato === 'cena').slice(0, 3)
    const candidates = [...ample.filter(r => r.clasificacion?.tipo_plato !== 'cena'), ...threeCenas]

    const { advertencias } = selectMenu({ candidates, recentRecipeIds: [], seed: SEED, profile: makeProfile() })

    const cenaWarnings = advertencias.filter(a => a.includes('cena'))
    expect(cenaWarnings).toHaveLength(1)
    expect(cenaWarnings[0]).toContain('sin repetir plato')
    expect(cenaWarnings[0]).not.toContain('alergias')
  })

  test('relaxes the time limit (never drops the slot) when no candidate fits, with one deduped advertencia', () => {
    const candidates = buildAmpleCatalog().map(r =>
      r.clasificacion?.tipo_plato === 'comida'
        ? { ...r, meta: { ...r.meta!, tiempo_total_min: 999 } }
        : r,
    )
    const { menu, advertencias } = selectMenu({
      candidates,
      recentRecipeIds: [], seed: SEED,
      profile: makeProfile({ tiempo_max_semana_min: 15, tiempo_max_finde_min: 15 }),
    })

    for (const dia of DIAS) {
      expect(menu[dia].comida).not.toBe(NO_SAFE_RECIPE_SENTINEL)
    }
    const relaxWarnings = advertencias.filter(a => a.includes('comida') && a.includes('tiempo de preparación'))
    // One for weekday, one for weekend (different time-limit buckets) — never one per day.
    expect(relaxWarnings.length).toBeLessThanOrEqual(2)
    expect(relaxWarnings.length).toBeGreaterThan(0)
  })

  test('warns when the selected menu exceeds the declared weekly budget (soft warn, never blocks)', () => {
    const candidates = buildAmpleCatalog().map(r => ({
      ...r,
      meta: { ...r.meta!, coste_estimado: 'alto' as const },
    }))
    const { advertencias } = selectMenu({
      candidates,
      recentRecipeIds: [], seed: SEED,
      profile: makeProfile({ presupuesto_semana_euros: 10 }),
    })

    expect(advertencias.some(a => a.includes('supera tu presupuesto'))).toBe(true)
  })

  test('presupuesto_semana_euros: null never triggers the budget check', () => {
    const candidates = buildAmpleCatalog().map(r => ({
      ...r,
      meta: { ...r.meta!, coste_estimado: 'alto' as const },
    }))
    const { advertencias } = selectMenu({
      candidates,
      recentRecipeIds: [], seed: SEED,
      profile: makeProfile({ presupuesto_semana_euros: null }),
    })

    expect(advertencias.some(a => a.includes('supera tu presupuesto'))).toBe(false)
  })

  test('an unknown coste bucket does not turn the budget total into NaN — the over-budget warning still fires (A4-L10)', () => {
    // Bad/legacy data: a coste_estimado outside the 4-value enum. Before the
    // fix `BUCKET_MIDPOINT_EUROS[coste]` was undefined, totalEuros went NaN,
    // `NaN > budget` was false, and the over-budget warning vanished.
    const candidates = buildAmpleCatalog().map(r => ({
      ...r,
      meta: { ...r.meta!, coste_estimado: 'carisimo' as unknown as 'alto' },
    }))
    const { advertencias } = selectMenu({
      candidates,
      recentRecipeIds: [], seed: SEED,
      profile: makeProfile({ presupuesto_semana_euros: 1 }),
    })

    expect(advertencias.some(a => a.includes('supera tu presupuesto'))).toBe(true)
    expect(advertencias.some(a => a.includes('cálculo de presupuesto es aproximado'))).toBe(true)
  })
})

describe('selectMenu — seeded determinism (FRESCO-380 / A4-M1)', () => {
  test('same seed + same inputs yields a byte-identical menu', () => {
    const catalog = buildAmpleCatalog()
    const a = selectMenu({ candidates: catalog, recentRecipeIds: [], seed: 'u:2026-W10', profile: makeProfile() })
    const b = selectMenu({ candidates: catalog, recentRecipeIds: [], seed: 'u:2026-W10', profile: makeProfile() })
    expect(a.menu).toEqual(b.menu)
  })

  test('a different seed can produce a different menu (the jitter is not a no-op)', () => {
    const catalog = buildAmpleCatalog()
    const menus = new Set(
      ['u:w1', 'u:w2', 'u:w3', 'u:w4', 'u:w5'].map(
        seed => JSON.stringify(selectMenu({ candidates: catalog, recentRecipeIds: [], seed, profile: makeProfile() }).menu),
      ),
    )
    expect(menus.size).toBeGreaterThan(1)
  })

  test('the jitter (max 0.5) never overturns a full rating-point gap', () => {
    // 5-star vs 1-star = an 8-point score gap; jitter tops out at 0.5, so the
    // higher-rated recipe wins for every seed.
    const higher = makeRecipe('desayuno-higher', 'desayuno', { rating_promedio: 5 })
    const lower = makeRecipe('desayuno-lower', 'desayuno', { rating_promedio: 1 })
    for (const seed of ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']) {
      const { menu } = selectMenu({ candidates: [higher, lower], recentRecipeIds: [], seed, profile: makeProfile() })
      expect(menu.lunes.desayuno).toBe(higher.id)
    }
  })
})

describe('selectMenu — planning_selection exclusions (FRESCO-199)', () => {
  test('a day+meal excluded from planning_selection becomes the excluded sentinel, not the unsafe-recipe one', () => {
    const profile = makeProfile({
      planning_selection: { ...ALL_DAYS_ALL_MEALS, martes: ['desayuno', 'cena'] },
    })
    const { menu } = selectMenu({ candidates: buildAmpleCatalog(), recentRecipeIds: [], seed: SEED, profile })

    expect(menu.martes.comida).toBe(SLOT_EXCLUDED_SENTINEL)
    expect(menu.martes.desayuno).not.toBe(SLOT_EXCLUDED_SENTINEL)
    expect(menu.martes.cena).not.toBe(SLOT_EXCLUDED_SENTINEL)
  })

  test('an excluded slot raises no advertencia — it is the user\'s choice, not a gap', () => {
    const profile = makeProfile({
      planning_selection: { ...ALL_DAYS_ALL_MEALS, martes: ['desayuno', 'cena'] },
    })
    const { advertencias } = selectMenu({ candidates: buildAmpleCatalog(), recentRecipeIds: [], seed: SEED, profile })

    expect(advertencias).toEqual([])
  })

  test('an excluded slot does not count toward the weekly budget check', () => {
    const candidates = buildAmpleCatalog().map(r => ({
      ...r,
      meta: { ...r.meta!, coste_estimado: 'alto' as const },
    }))
    const allExcludedProfile = makeProfile({
      planning_selection: Object.fromEntries(DIAS.map(dia => [dia, []])) as Record<DiaSemana, TipoPlatoSlot[]>,
      presupuesto_semana_euros: 1,
    })
    const { advertencias } = selectMenu({ candidates, recentRecipeIds: [], seed: SEED, profile: allExcludedProfile })

    expect(advertencias.some(a => a.includes('supera tu presupuesto'))).toBe(false)
  })
})

describe('selectMenu — personal engagement nudge (ADR-0008)', () => {
  // Assertions below check only the FIRST slot filled (lunes): from the
  // second slot onward, the breakfast-repeat cap and the comida/cena
  // no-repeat set start excluding whichever candidate was already chosen —
  // a real invariant (structural-guarantees describe block above), but it
  // would make a multi-slot assertion here about the *scoring nudge* prove
  // the repeat cap instead.
  //
  // FRESCO-380: the tie-break jitter no longer needs to be stubbed. It is a
  // seeded PRNG capped at `rng() * 0.5`, so it can never overturn the ADR-0008
  // nudge (+1.0 per cocinada, -6 per descartada) or a rating-point gap under
  // test here — the comparison is decided by the nudge, not by luck.

  test('a Pro user\'s personal cocinada history is favored over an identical candidate with no history', () => {
    const favored = makeRecipe('desayuno-favored', 'desayuno')
    const plain = makeRecipe('desayuno-plain', 'desayuno')
    const userEngagement = new Map([[favored.id, { cocinada: 3, descartada: 0 }]])

    const { menu } = selectMenu({
      candidates: [favored, plain],
      recentRecipeIds: [], seed: SEED,
      profile: makeProfile({ plan: 'pro' }),
      userEngagement,
    })

    expect(menu.lunes.desayuno).toBe(favored.id)
  })

  test('a Pro user\'s personal descartada mark outweighs an otherwise-identical candidate', () => {
    const discarded = makeRecipe('desayuno-discarded', 'desayuno')
    const plain = makeRecipe('desayuno-plain', 'desayuno')
    const userEngagement = new Map([[discarded.id, { cocinada: 0, descartada: 1 }]])

    const { menu } = selectMenu({
      candidates: [discarded, plain],
      recentRecipeIds: [], seed: SEED,
      profile: makeProfile({ plan: 'pro' }),
      userEngagement,
    })

    expect(menu.lunes.desayuno).toBe(plain.id)
  })

  test('Free tier (no userEngagement) scores unaffected — global rating alone decides', () => {
    const higherRated = makeRecipe('desayuno-higher', 'desayuno', { rating_promedio: 5 })
    const lowerRated = makeRecipe('desayuno-lower', 'desayuno', { rating_promedio: 1 })

    const { menu } = selectMenu({
      candidates: [higherRated, lowerRated],
      recentRecipeIds: [], seed: SEED,
      profile: makeProfile({ plan: 'free' }),
    })

    expect(menu.lunes.desayuno).toBe(higherRated.id)
  })
})

// ---------------------------------------------------------------------------
// FRESCO-465 — property-based verification (fast-check).
//
// The example tests above pin specific menus. These generalise the four
// ADR-0005 / FR-8.2 invariants over hundreds of generated (profile, catalog,
// seed) triples. `selectMenu` is a pure, synchronous, constrained-selection
// function, so an invariant that survives a wide random sweep is structural,
// not incidental to the hand-picked fixtures.
// ---------------------------------------------------------------------------

type Coste = 'muy_bajo' | 'bajo' | 'medio' | 'alto'

const ALLERGEN_VOCAB = [
  'gluten', 'lactosa', 'huevo', 'frutos_secos', 'cacahuetes', 'marisco',
  'pescado', 'soja', 'sesamo', 'sulfitos', 'mostaza', 'apio',
]
const TEMPORADA_VOCAB: Temporada[] = ['primavera', 'verano', 'otono', 'invierno', 'todo_el_ano']
const COSTE_VOCAB: Coste[] = ['muy_bajo', 'bajo', 'medio', 'alto']

/** fast-check seed pinned so a counterexample reproduces byte-for-byte. */
const FC_SEED = 0x46534335 // "FSC5"
const FC_RUNS = 150

interface RecipeShape {
  alergenos: string[]
  temporada: Temporada[]
  rating: number | null
  vecesCocinada: number
  vecesDescartada: number
  tiempoTotal: number
  coste: Coste
}

const recipeShapeArb: fc.Arbitrary<RecipeShape> = fc.record({
  alergenos: fc.subarray(ALLERGEN_VOCAB),
  temporada: fc.subarray(TEMPORADA_VOCAB, { minLength: 1 }),
  rating: fc.option(fc.integer({ min: 0, max: 5 }), { nil: null }),
  vecesCocinada: fc.nat({ max: 40 }),
  vecesDescartada: fc.nat({ max: 12 }),
  tiempoTotal: fc.integer({ min: 5, max: 180 }),
  coste: fc.constantFrom(...COSTE_VOCAB),
})

function applyShape(base: Recipe, s: RecipeShape): Recipe {
  return {
    ...base,
    alergenos: s.alergenos,
    temporada: s.temporada,
    rating_promedio: s.rating,
    veces_cocinada: s.vecesCocinada,
    veces_descartada: s.vecesDescartada,
    meta: { ...base.meta!, tiempo_total_min: s.tiempoTotal, coste_estimado: s.coste },
  }
}

/** Independent recipe counts per tipo_plato; ids unique within a tipo. */
function catalogArb(perTipo: { minLength: number, maxLength: number }): fc.Arbitrary<Recipe[]> {
  return fc.record({
    desayuno: fc.array(recipeShapeArb, perTipo),
    comida: fc.array(recipeShapeArb, perTipo),
    cena: fc.array(recipeShapeArb, perTipo),
  }).map((byTipo) => {
    const recipes: Recipe[] = []
    for (const tipo of TIPOS) {
      byTipo[tipo].forEach((shape, i) => {
        recipes.push(applyShape(makeRecipe(`${tipo}-${i}`, tipo), shape))
      })
    }
    return recipes
  })
}

const planningSelectionArb: fc.Arbitrary<Record<DiaSemana, TipoPlatoSlot[]>> = fc.record(
  Object.fromEntries(DIAS.map(dia => [dia, fc.subarray([...TIPOS])])) as Record<DiaSemana, fc.Arbitrary<TipoPlatoSlot[]>>,
)

const profileArb: fc.Arbitrary<UserProfile> = fc.record({
  adultos: fc.integer({ min: 1, max: 8 }),
  ninos: fc.integer({ min: 0, max: 6 }),
  alergenos: fc.subarray(ALLERGEN_VOCAB),
  dieta_vegetariano: fc.boolean(),
  dieta_vegano: fc.boolean(),
  dieta_sin_gluten: fc.boolean(),
  dieta_sin_lactosa: fc.boolean(),
  dieta_sin_huevo: fc.boolean(),
  dieta_keto: fc.boolean(),
  dieta_halal: fc.boolean(),
  tiempo_max_semana_min: fc.integer({ min: 5, max: 120 }),
  tiempo_max_finde_min: fc.integer({ min: 5, max: 180 }),
  presupuesto_semana_euros: fc.option(fc.integer({ min: 10, max: 400 }), { nil: null }),
  plan: fc.constantFrom('free', 'pro') as fc.Arbitrary<UserProfile['plan']>,
  planning_selection: planningSelectionArb,
}).map(o => makeProfile({ ...o, num_personas: o.adultos + o.ninos }))

describe('selectMenu — property-based invariants (FRESCO-465, fast-check)', () => {
  test('any valid profile + catalog yields a menu with EXACTLY 21 slots', () => {
    fc.assert(
      fc.property(
        profileArb,
        catalogArb({ minLength: 0, maxLength: 14 }),
        fc.string({ minLength: 1 }),
        (profile, candidates, seed) => {
          const { menu } = selectMenu({ candidates, recentRecipeIds: [], profile, seed })

          expect(Object.keys(menu).sort()).toEqual([...DIAS].sort())
          let slots = 0
          for (const dia of DIAS) {
            expect(Object.keys(menu[dia]).sort()).toEqual([...TIPOS].sort())
            for (const tipo of TIPOS) {
              expect(typeof menu[dia][tipo]).toBe('string')
              expect(menu[dia][tipo].length).toBeGreaterThan(0)
              slots++
            }
          }
          expect(slots).toBe(21)
        },
      ),
      { seed: FC_SEED, numRuns: FC_RUNS },
    )
  })

  test('no recipe placed in the plan carries an allergen declared in the profile (A4-B2)', () => {
    fc.assert(
      fc.property(
        profileArb,
        catalogArb({ minLength: 10, maxLength: 24 }),
        fc.string({ minLength: 1 }),
        (profile, rawCandidates, seed) => {
          const profileAllergens = new Set(profile.alergenos)
          // Mimic get_filtered_recipes() Layer 1: the SQL pre-filter drops
          // every recipe carrying a profile allergen before selectMenu runs.
          const candidates = rawCandidates.filter(
            r => !(r.alergenos ?? []).some(a => profileAllergens.has(a)),
          )
          const byId = new Map(candidates.map(r => [r.id, r]))

          const { menu } = selectMenu({ candidates, recentRecipeIds: [], profile, seed })

          for (const dia of DIAS) {
            for (const tipo of TIPOS) {
              const id = menu[dia][tipo]
              if (id === NO_SAFE_RECIPE_SENTINEL || id === SLOT_EXCLUDED_SENTINEL) continue
              const chosen = byId.get(id)
              // selectMenu only ever emits ids from its own candidate set...
              expect(chosen).toBeDefined()
              // ...and never reintroduces an allergen the pre-filter removed.
              for (const a of chosen!.alergenos ?? []) {
                expect(profileAllergens.has(a)).toBe(false)
              }
            }
          }
        },
      ),
      { seed: FC_SEED, numRuns: FC_RUNS },
    )
  })

  test('a fixed seed yields byte-identical output across repeated runs (ADR-0005 / FRESCO-380)', () => {
    fc.assert(
      fc.property(
        profileArb,
        catalogArb({ minLength: 0, maxLength: 16 }),
        fc.string({ minLength: 1 }),
        (profile, candidates, seed) => {
          const runs = [0, 1, 2].map(() => selectMenu({ candidates, recentRecipeIds: [], profile, seed }))
          expect(runs[1]).toEqual(runs[0])
          expect(runs[2]).toEqual(runs[0])
        },
      ),
      { seed: FC_SEED, numRuns: FC_RUNS },
    )
  })

  test('a catalog below the 21-slot minimum never produces a silently-complete plan', () => {
    // The typed 409/422 rejection for an under-sized catalog is index.ts step 5
    // (`recipes.length < MIN_CATALOG_SIZE` -> `HttpError(422)`), which runs
    // inside Deno.serve and is out of reach of `bun test`. What the PURE engine
    // guarantees — the half that makes the gap detectable upstream and visible
    // to the user — is: every unfillable slot is NO_SAFE_RECIPE_SENTINEL and
    // every affected tipo is named in an advertencia. Never a plan that looks
    // full when it is not.
    fc.assert(
      fc.property(
        profileArb.map(p => makeProfile({ ...p, planning_selection: ALL_DAYS_ALL_MEALS })),
        catalogArb({ minLength: 0, maxLength: 6 }),
        fc.string({ minLength: 1 }),
        (profile, candidates, seed) => {
          const { menu, advertencias } = selectMenu({ candidates, recentRecipeIds: [], profile, seed })

          const gapTipos = new Set<TipoPlatoSlot>()
          for (const dia of DIAS) {
            for (const tipo of TIPOS) {
              if (menu[dia][tipo] === NO_SAFE_RECIPE_SENTINEL) gapTipos.add(tipo)
            }
          }
          if (gapTipos.size > 0) {
            expect(advertencias.length).toBeGreaterThan(0)
            for (const tipo of gapTipos) {
              expect(advertencias.some(a => a.includes(tipo))).toBe(true)
            }
          }
        },
      ),
      { seed: FC_SEED, numRuns: FC_RUNS },
    )
  })
})

// ---------------------------------------------------------------------------
// FRESCO-465 (scope expansion, comments.md) — failure-side concrete examples.
// Property-based already covers the positive invariants; these are the
// readable per-scenario regressions for the error side. Where the pure engine
// deliberately emits a sentinel + a franja-naming advertencia instead of
// throwing (ADR-0005 / FR-8.2 / FRESCO-199), the test asserts that documented
// contract — the typed 409/422/404 lives in index.ts (inside Deno.serve, not
// bun-testable) and is documented per case.
// ---------------------------------------------------------------------------
describe('selectMenu — negative / failure-side examples (FRESCO-465)', () => {
  // Row 1 — filtered catalog below the 21-recipe minimum for the profile.
  test('an under-minimum catalog surfaces every gap (sentinel + tipo-named advertencia), never a complete-looking plan', () => {
    // 6 desayunos + 3 comidas + 0 cenas = 9 usable recipes, far below 21.
    const candidates = [
      ...Array.from({ length: 6 }, (_, i) => makeRecipe(`d-${i}`, 'desayuno')),
      ...Array.from({ length: 3 }, (_, i) => makeRecipe(`c-${i}`, 'comida')),
    ]
    const { menu, advertencias } = selectMenu({ candidates, recentRecipeIds: [], seed: SEED, profile: makeProfile() })

    for (const dia of DIAS) {
      expect(menu[dia].cena).toBe(NO_SAFE_RECIPE_SENTINEL)
    }
    // cena: none at all; comida: runs out of distinct recipes mid-week. Both named.
    expect(advertencias.some(a => a.includes('cena'))).toBe(true)
    expect(advertencias.some(a => a.includes('comida'))).toBe(true)
    // index.ts step 5 rejects this same catalog earlier: HttpError 422
    // "Catálogo insuficiente: 9 recetas disponibles (mínimo 21)". MIN_CATALOG_SIZE = 21.
  })

  // Row 2 — zero safe recipes for one concrete slot.
  test('zero safe recipes for a whole tipo -> that slot is the sentinel everywhere + ONE advertencia naming the franja', () => {
    const candidates = buildAmpleCatalog().filter(r => r.clasificacion?.tipo_plato !== 'desayuno')
    const { menu, advertencias } = selectMenu({ candidates, recentRecipeIds: [], seed: SEED, profile: makeProfile() })

    for (const dia of DIAS) {
      expect(menu[dia].desayuno).toBe(NO_SAFE_RECIPE_SENTINEL)
    }
    const desayunoWarnings = advertencias.filter(a => a.includes('desayuno'))
    expect(desayunoWarnings).toHaveLength(1)
    expect(desayunoWarnings[0]).toContain('compatible con tus alergias')
    // comida + cena stay fully filled — the failure is scoped to the one franja.
    for (const dia of DIAS) {
      expect(menu[dia].comida).not.toBe(NO_SAFE_RECIPE_SENTINEL)
      expect(menu[dia].cena).not.toBe(NO_SAFE_RECIPE_SENTINEL)
    }
  })

  // Row 3 — impossible dietary combo. Diet/allergen exclusion is the SQL
  // pre-filter's job (get_filtered_recipes), so an "impossible combo" reaches
  // selectMenu as a catalog already emptied for one or more tipos. Same
  // contract as row 2: a clear per-franja error, never a degraded plan.
  test('a dietary combo that empties the catalog for two tipos -> named sentinels, not a degraded plan', () => {
    const candidates = buildAmpleCatalog().filter(r => r.clasificacion?.tipo_plato === 'desayuno')
    const { menu, advertencias } = selectMenu({ candidates, recentRecipeIds: [], seed: SEED, profile: makeProfile() })

    for (const dia of DIAS) {
      expect(menu[dia].comida).toBe(NO_SAFE_RECIPE_SENTINEL)
      expect(menu[dia].cena).toBe(NO_SAFE_RECIPE_SENTINEL)
    }
    expect(advertencias.some(a => a.includes('comida') && a.includes('compatible con tus alergias'))).toBe(true)
    expect(advertencias.some(a => a.includes('cena') && a.includes('compatible con tus alergias'))).toBe(true)
    expect(DIAS.every(dia => menu[dia].desayuno !== NO_SAFE_RECIPE_SENTINEL)).toBe(true)
  })

  // Row 4 — planning_selection with 0 franjas marked.
  test('planning_selection with zero franjas -> all 21 slots excluded, no crash, no advertencia (documented pure-function behavior)', () => {
    const emptySelection = Object.fromEntries(
      DIAS.map(dia => [dia, [] as TipoPlatoSlot[]]),
    ) as Record<DiaSemana, TipoPlatoSlot[]>
    const { menu, advertencias } = selectMenu({
      candidates: buildAmpleCatalog(),
      recentRecipeIds: [],
      seed: SEED,
      profile: makeProfile({ planning_selection: emptySelection }),
    })

    for (const dia of DIAS) {
      for (const tipo of TIPOS) {
        expect(menu[dia][tipo]).toBe(SLOT_EXCLUDED_SENTINEL)
      }
    }
    expect(advertencias).toEqual([])
    // NOTE (FRESCO-465): the ticket expects an empty planning_selection to be
    // rejected *before generating*. The pure selector does not throw — it
    // returns an all-excluded plan. The "reject" guard is UI-side (and could be
    // added to index.ts); selectMenu's own contract (FRESCO-199) is "the user
    // chose nothing, so nothing is planned, and that is not a gap".
  })

  // Row 5 — profile with no user_profiles row yet.
  test('a missing user_profiles row is index.ts 404; selectMenu never crashes on a minimal valid profile', () => {
    // The 404 ("Perfil de usuario no encontrado") is index.ts step 3, inside
    // Deno.serve — not reachable from bun test. The pure engine's guarantee:
    // given any structurally-valid profile it returns a well-formed result.
    const { menu, advertencias } = selectMenu({
      candidates: buildAmpleCatalog(),
      recentRecipeIds: [],
      seed: SEED,
      profile: makeProfile(),
    })
    expect(Object.keys(menu)).toHaveLength(7)
    expect(Array.isArray(advertencias)).toBe(true)
  })
})
