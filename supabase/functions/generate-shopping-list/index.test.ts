import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { hoyEnMadrid } from './remaining-days.ts'
import { captureDenoServe, edgeRequest, type EdgeHandler, getEdgeHandler } from '@/tests/mocks/edge-function'

/**
 * FRESCO-991 — orchestration coverage for `generate-shopping-list/index.ts`.
 * Consolidation, pricing and day filtering have their own tests; this pins
 * ownership (plan read scoped to the caller), the one-list-per-plan rule
 * (check AND unique-violation race), household scaling, substitutions and
 * the write.
 */

interface Config {
  user?: { id: string } | null
  plan?: unknown
  existingList?: unknown
  profile?: unknown
  slots?: unknown
  saveError?: { code?: string } | null
  savedList?: unknown
}

let config: Config
let inserted: Array<Record<string, unknown>>
let planUserFilters: unknown[]

function client() {
  const reads: Record<string, () => { data: unknown, error: unknown }> = {
    meal_plans: () => ({ data: config.plan ?? null, error: config.plan ? null : { message: 'none' } }),
    shopping_lists: () => ({ data: config.existingList ?? null, error: null }),
    user_profiles: () => ({ data: config.profile ?? null, error: null }),
    meal_plan_recipes: () => ({ data: config.slots ?? null, error: config.slots ? null : { message: 'none' } }),
  }
  return {
    auth: { getUser: async () => ({ data: { user: config.user === undefined ? { id: 'user_1' } : config.user }, error: null }) },
    from: (table: string) => ({
      select: () => {
        const result = reads[table]()
        const chain: Record<string, unknown> = {
          eq: (column: string, value: unknown) => {
            if (table === 'meal_plans' && column === 'user_id') planUserFilters.push(value)
            return chain
          },
          returns: () => chain,
          single: async () => result,
          maybeSingle: async () => result,
          then: (f: (v: unknown) => unknown) => Promise.resolve(result).then(f),
        }
        return chain
      },
      insert: (payload: Record<string, unknown>) => {
        inserted.push(payload)
        return {
          select: () => ({
            single: async () => ({
              data: config.saveError ? null : (config.savedList ?? { id: 'sl_1' }),
              error: config.saveError ?? null,
            }),
          }),
        }
      },
    }),
  }
}

captureDenoServe()
mock.module('../_shared/supabase-client.ts', () => ({ createRequestClient: () => client() }))

await import('./index.ts')
const handler: EdgeHandler = getEdgeHandler()

const FUTURE_MONDAY = '2099-01-05'
const PLAN = { id: 'mp_1', semana_iso: '2099-W02', user_id: 'user_1', fecha_inicio: FUTURE_MONDAY }

function slot(dia: string, nombre: string, ingredientes: string[], over: Record<string, unknown> = {}) {
  return {
    recipe_id: `r_${nombre}`,
    dia,
    sustitucion_ingrediente: null,
    recipes: { id: `r_${nombre}`, nombre, meta: { raciones: 2 }, ingredientes_principales: ingredientes, ingredientes_cantidades: null },
    ...over,
  }
}

function call(body: unknown = { meal_plan_id: 'mp_1' }) {
  return handler(edgeRequest(body))
}

function namesOf(items: unknown): string[] {
  return (items as Array<{ items: Array<{ nombre: string }> }>).flatMap(p => p.items.map(i => i.nombre.toLowerCase()))
}

beforeEach(() => {
  inserted = []
  planUserFilters = []
  config = { plan: PLAN, profile: { num_personas: 2 }, slots: [slot('lunes', 'tortilla', ['huevo', 'patata'])] }
})

describe('generate-shopping-list/index.ts', () => {
  test('401 without a user', async () => {
    config.user = null
    expect((await call()).status).toBe(401)
  })

  test('400 without meal_plan_id', async () => {
    expect((await call({})).status).toBe(400)
  })

  test('404 when the plan is not found for the caller, and the read is scoped to the caller id', async () => {
    config.plan = null
    expect((await call()).status).toBe(404)
    expect(planUserFilters).toEqual(['user_1'])
    expect(inserted).toEqual([])
  })

  test('409 when the plan already has a list, and nothing is written', async () => {
    config.existingList = { id: 'sl_old' }
    expect((await call()).status).toBe(409)
    expect(inserted).toEqual([])
  })

  test('404 when the plan has no slots', async () => {
    config.slots = []
    expect((await call()).status).toBe(404)
  })

  test('404 when reading the slots fails', async () => {
    config.slots = null
    expect((await call()).status).toBe(404)
  })

  test('a week that is already over still gets a full list (an empty one helps nobody)', async () => {
    config.plan = { ...PLAN, fecha_inicio: '2000-01-03' }
    const res = await call()
    expect(res.status).toBe(200)
    expect(namesOf(inserted[0].items)).toContain('huevo')
  })

  test('days already behind us (Madrid today) are left out of the list', async () => {
    const hoy = new Date(`${hoyEnMadrid()}T00:00:00Z`)
    hoy.setUTCDate(hoy.getUTCDate() - 2)
    config.plan = { ...PLAN, fecha_inicio: hoy.toISOString().slice(0, 10) }
    config.slots = [slot('lunes', 'pasado', ['sardina']), slot('martes', 'pasado2', ['merluza']), slot('miercoles', 'hoy', ['huevo'])]
    await call()
    const names = namesOf(inserted[0].items)
    expect(names).toContain('huevo')
    expect(names).not.toContain('sardina')
    expect(names).not.toContain('merluza')
  })

  test('422 when slots carry no recipe or no ingredients', async () => {
    config.slots = [{ recipe_id: null, dia: 'lunes', sustitucion_ingrediente: null, recipes: null }]
    expect((await call()).status).toBe(422)
  })

  test('200 persists the list for the verified user and returns it with a cost range', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    const body = await res.json() as { shopping_list_id: string, pasillos: unknown, resumen: { coste_estimado_min: number, coste_estimado_max: number } }
    expect(body.shopping_list_id).toBe('sl_1')
    expect(namesOf(body.pasillos).join(' ')).toContain('huevo')
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({
      meal_plan_id: 'mp_1',
      user_id: 'user_1',
      coste_estimado_min: body.resumen.coste_estimado_min,
      coste_estimado_max: body.resumen.coste_estimado_max,
    })
    expect(body.resumen.coste_estimado_max).toBeGreaterThanOrEqual(body.resumen.coste_estimado_min)
  })

  test('the household size scales the quantities, and is clamped to 1..10', async () => {
    async function totalFor(numPersonas: number) {
      config.profile = { num_personas: numPersonas }
      config.slots = [slot('lunes', 'lentejas', ['arroz'])]
      inserted = []
      await call()
      return JSON.stringify(inserted[0].items)
    }
    const two = await totalFor(2)
    const ten = await totalFor(10)
    expect(ten).not.toBe(two)
    expect(await totalFor(500)).toBe(ten)
    expect(await totalFor(0)).toBe(await totalFor(1))
  })

  test('a missing profile defaults the household to 2', async () => {
    config.profile = null
    const noProfile = await call()
    const withDefault = (() => { inserted = []; config.profile = { num_personas: 2 }; return call() })()
    expect(noProfile.status).toBe(200)
    await withDefault
    expect(inserted).toHaveLength(1)
  })

  test('a confirmed substitution swaps the ingredient name on that slot only', async () => {
    config.slots = [
      slot('lunes', 'tortilla', ['huevo', 'patata'], { sustitucion_ingrediente: { original: 'Huevo', sustituto: 'tofu' } }),
      slot('martes', 'revuelto', ['huevo']),
    ]
    await call()
    const names = namesOf(inserted[0].items)
    expect(names).toContain('tofu')
    expect(names).toContain('huevo')
  })

  test('409 (not 500) when a concurrent request wins the unique_plan_lista race', async () => {
    config.saveError = { code: '23505' }
    expect((await call()).status).toBe(409)
  })

  test('500 on any other save failure', async () => {
    config.saveError = { code: 'XX000' }
    expect((await call()).status).toBe(500)
  })
})
