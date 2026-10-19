import type { Recipe, TipoPlatoSlot } from './types.ts'
import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { captureDenoServe, edgeRequest, type EdgeHandler, fakeEdgeClient, type FakeEdgeClient, getEdgeHandler } from '@/tests/mocks/edge-function'

/**
 * FRESCO-991 — orchestration coverage for `generate-meal-plan/index.ts`.
 * Selection itself (`menu-selector`), the entitlement and the explanation
 * keep their own tests; this pins the wiring that decides who may generate,
 * what is read per tier, and what is written: auth, rate limit, body,
 * profile, one-plan-per-week, catalogue floor, Pro-only history, the single
 * service-role `create_meal_plan` write and its error map.
 */

let supa: FakeEdgeClient
let svc: FakeEdgeClient
captureDenoServe()
mock.module('../_shared/supabase-client.ts', () => ({ createRequestClient: () => supa.client }))
mock.module('../_shared/service-role-client.ts', () => ({ createServiceRoleClient: () => svc.client }))

await import('./index.ts')
const handler: EdgeHandler = getEdgeHandler()

const USER = { id: 'user_1' }
const BODY = { semana_iso: '2026-W43', fecha_inicio: '2026-10-19' }
const TIPOS: TipoPlatoSlot[] = ['desayuno', 'comida', 'cena']

function recipe(id: string, tipo: TipoPlatoSlot): Recipe {
  return {
    id,
    nombre: `Receta ${id}`,
    slug: id,
    meta: { tiempo_prep_min: 10, tiempo_coccion_min: 10, tiempo_total_min: 20, raciones: 2, coste_estimado: 'bajo', dificultad: 'facil' },
    clasificacion: { tipo_plato: tipo, categoria: 'guiso', cocina: 'española', es_contundente: false, es_ligero: true, es_comfort_food: false, apto_tupper: true, apto_congelar: false },
    alergenos: null,
    temporada: ['todo_el_ano'],
    veces_cocinada: 0,
    veces_descartada: 0,
    rating_promedio: null,
    ultima_vez_en_menu: null,
  } as unknown as Recipe
}

const CATALOG = TIPOS.flatMap(tipo => Array.from({ length: 10 }, (_, i) => recipe(`${tipo}-${i}`, tipo)))

const ALL_SLOTS = Object.fromEntries(
  ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map(d => [d, TIPOS]),
)

function profile(over: Record<string, unknown> = {}) {
  return { id: 'user_1', plan: 'free', plan_expires_at: null, payment_failed_at: null, alergenos: [], ingredientes_odiados: [], planning_selection: ALL_SLOTS, ...over }
}

const OK = {
  check_and_increment_rate_limit: { data: true },
  get_filtered_recipes: { data: CATALOG },
}

function setup(over: { rpc?: Record<string, { data?: unknown, error?: unknown }>, rows?: Record<string, unknown>, svcRpc?: Record<string, { data?: unknown, error?: unknown }> } = {}) {
  supa = fakeEdgeClient({
    user: USER,
    rpc: { ...OK, ...over.rpc },
    rows: { user_profiles: profile(), meal_plans: null, ...over.rows },
  })
  svc = fakeEdgeClient({ rpc: { create_meal_plan: { data: 'mp_1' }, ...over.svcRpc } })
}

beforeEach(() => setup())

describe('generate-meal-plan/index.ts — guards', () => {
  test('401 without an Authorization header', async () => {
    expect((await handler(edgeRequest(BODY, { auth: null }))).status).toBe(401)
  })

  test('401 when the JWT resolves to no user', async () => {
    supa = fakeEdgeClient({ user: null })
    expect((await handler(edgeRequest(BODY))).status).toBe(401)
  })

  test('429 when the 5/h limit is exhausted, before anything else is read', async () => {
    setup({ rpc: { check_and_increment_rate_limit: { data: false } } })
    expect((await handler(edgeRequest(BODY))).status).toBe(429)
    expect(supa.rpcCalls.map(([name]) => name)).toEqual(['check_and_increment_rate_limit'])
  })

  test('500 when the rate-limit RPC itself errors', async () => {
    setup({ rpc: { check_and_increment_rate_limit: { error: { message: 'down' } } } })
    expect((await handler(edgeRequest(BODY))).status).toBe(500)
  })

  test('400 when semana_iso or fecha_inicio is missing, without spending a generation', async () => {
    expect((await handler(edgeRequest({ semana_iso: '2026-W43' }))).status).toBe(400)
    expect((await handler(edgeRequest({ fecha_inicio: '2026-10-19' }))).status).toBe(400)
    expect(supa.rpcCalls).toEqual([])
  })

  test('400, not 500, for a malformed body, and the hourly generation is not spent (A7-API-05)', async () => {
    for (const body of ['{not json', 'null', '[]', '{"semana_iso":{},"fecha_inicio":"2026-10-19"}']) {
      const res = await handler(edgeRequest(undefined, { body }))
      expect(res.status).toBe(400)
    }
    expect(supa.rpcCalls).toEqual([])
  })

  test('404 when the profile does not exist', async () => {
    setup({ rows: { user_profiles: null } })
    expect((await handler(edgeRequest(BODY))).status).toBe(404)
  })

  test('409 when the week already has a plan, and nothing is written', async () => {
    setup({ rows: { meal_plans: { id: 'old' } } })
    expect((await handler(edgeRequest(BODY))).status).toBe(409)
    expect(svc.rpcCalls).toEqual([])
  })

  test('422 when fewer than 21 safe recipes survive the filter, and nothing is written', async () => {
    setup({ rpc: { get_filtered_recipes: { data: CATALOG.slice(0, 20) } } })
    expect((await handler(edgeRequest(BODY))).status).toBe(422)
    expect(svc.rpcCalls).toEqual([])
  })

  test('422 when the filter RPC errors (never plans from an unfiltered catalogue)', async () => {
    setup({ rpc: { get_filtered_recipes: { data: CATALOG, error: { message: 'x' } } } })
    expect((await handler(edgeRequest(BODY))).status).toBe(422)
  })
})

describe('generate-meal-plan/index.ts — write', () => {
  test('free: writes 21 slots through the service-role client with the verified user id, no explanation', async () => {
    const res = await handler(edgeRequest({ ...BODY, user_id: 'forged' }))
    expect(res.status).toBe(200)
    const [name, args] = svc.rpcCalls[0] as [string, Record<string, unknown>]
    expect(name).toBe('create_meal_plan')
    expect(args.p_user_id).toBe('user_1')
    expect(args.p_semana_iso).toBe('2026-W43')
    expect(args.p_fecha_inicio).toBe('2026-10-19')
    expect(args.p_explicacion_aprendizaje).toBeNull()
    expect(args.p_slots).toHaveLength(21)
    const body = await res.json() as { meal_plan_id: string, explicacion_aprendizaje: unknown, menu: Record<string, Record<string, { id: string } | null>> }
    expect(body.meal_plan_id).toBe('mp_1')
    expect(body.explicacion_aprendizaje).toBeNull()
    expect(body.menu.lunes.desayuno?.id).toMatch(/^desayuno-/)
  })

  test('the caller client never writes the plan', async () => {
    await handler(edgeRequest(BODY))
    expect(supa.inserts).toEqual([])
    expect(supa.rpcCalls.map(([name]) => name)).not.toContain('create_meal_plan')
  })

  test('free does not read Pro history', async () => {
    await handler(edgeRequest(BODY))
    const names = supa.rpcCalls.map(([name]) => name)
    expect(names).not.toContain('get_recent_recipe_marks')
    expect(names).not.toContain('get_user_recipe_engagement')
    expect(names).not.toContain('get_user_cooked_recipe_ids')
  })

  test('same user and week give the same menu', async () => {
    const first = await (await handler(edgeRequest(BODY))).json()
    setup()
    const second = await (await handler(edgeRequest(BODY))).json()
    expect((second as { menu: unknown }).menu).toEqual((first as { menu: unknown }).menu)
  })

  test('a slot the user excluded is stored as excluida with no recipe', async () => {
    setup({ rows: { user_profiles: profile({ planning_selection: { ...ALL_SLOTS, lunes: ['comida', 'cena'] } }) } })
    await handler(edgeRequest(BODY))
    const slots = (svc.rpcCalls[0][1] as { p_slots: Array<{ dia: string, tipo_plato: string, estado: string, recipe_id: string | null }> }).p_slots
    const excluded = slots.find(s => s.dia === 'lunes' && s.tipo_plato === 'desayuno')
    expect(excluded).toMatchObject({ estado: 'excluida', recipe_id: null })
    expect(slots.filter(s => s.estado === 'pendiente').every(s => s.recipe_id !== null)).toBe(true)
  })
})

describe('generate-meal-plan/index.ts — Pro', () => {
  test('active Pro reads history and returns the learning explanation', async () => {
    setup({ rows: { user_profiles: profile({ plan: 'pro' }) } })
    const res = await handler(edgeRequest(BODY))
    expect(res.status).toBe(200)
    const names = supa.rpcCalls.map(([name]) => name)
    expect(names).toEqual(expect.arrayContaining(['get_recent_recipe_marks', 'get_user_recipe_engagement', 'get_user_cooked_recipe_ids']))
    const body = await res.json() as { explicacion_aprendizaje: string | null }
    expect(typeof body.explicacion_aprendizaje).toBe('string')
    expect((svc.rpcCalls[0][1] as Record<string, unknown>).p_explicacion_aprendizaje).toBe(body.explicacion_aprendizaje)
  })

  test('Pro with a lapsed entitlement is treated as free', async () => {
    setup({ rows: { user_profiles: profile({ plan: 'pro', plan_expires_at: '2020-01-01T00:00:00Z' }) } })
    const res = await handler(edgeRequest(BODY))
    expect(((await res.json()) as { explicacion_aprendizaje: unknown }).explicacion_aprendizaje).toBeNull()
    expect(supa.rpcCalls.map(([name]) => name)).not.toContain('get_recent_recipe_marks')
  })

  test('recipes the Pro user cooked or discarded recently are not repeated', async () => {
    const recent = ['desayuno-0', 'desayuno-1', 'comida-0', 'cena-0']
    setup({
      rows: { user_profiles: profile({ plan: 'pro' }) },
      rpc: { get_recent_recipe_marks: { data: recent.map((recipe_id, i) => ({ recipe_id, estado: i % 2 ? 'descartada' : 'cocinada' })) } },
    })
    await handler(edgeRequest(BODY))
    const used = (svc.rpcCalls[0][1] as { p_slots: Array<{ recipe_id: string | null }> }).p_slots.map(s => s.recipe_id)
    for (const id of recent) expect(used).not.toContain(id)
  })

  test('pendiente and sustituida marks are not a signal and do not exclude', async () => {
    setup({
      rows: { user_profiles: profile({ plan: 'pro' }) },
      rpc: { get_recent_recipe_marks: { data: [{ recipe_id: 'desayuno-0', estado: 'pendiente' }, { recipe_id: 'desayuno-1', estado: 'sustituida' }] } },
    })
    const res = await handler(edgeRequest(BODY))
    expect(res.status).toBe(200)
  })
})

describe('generate-meal-plan/index.ts — create_meal_plan error map', () => {
  test('400 on 22023 (invalid week or start date)', async () => {
    setup({ svcRpc: { create_meal_plan: { data: null, error: { code: '22023', message: 'bad' } } } })
    expect((await handler(edgeRequest(BODY))).status).toBe(400)
  })

  test('409 on 23505 (a concurrent request created the week first)', async () => {
    setup({ svcRpc: { create_meal_plan: { data: null, error: { code: '23505', message: 'dup' } } } })
    expect((await handler(edgeRequest(BODY))).status).toBe(409)
  })

  test('403 with a readable message on 23514 (the per-user cap of 104 plans, FRESCO-1017)', async () => {
    setup({ svcRpc: { create_meal_plan: { data: null, error: { code: '23514', message: 'meal_plans: limit of 104 plans per user reached' } } } })
    const res = await handler(edgeRequest(BODY))
    expect(res.status).toBe(403)
    expect(((await res.json()) as { error: string }).error).toContain('104')
  })

  test('500 on any other failure', async () => {
    setup({ svcRpc: { create_meal_plan: { data: null, error: { code: 'XX000', message: 'boom' } } } })
    expect((await handler(edgeRequest(BODY))).status).toBe(500)
  })

  test('500 when the function returns no id and no error', async () => {
    setup({ svcRpc: { create_meal_plan: { data: null } } })
    expect((await handler(edgeRequest(BODY))).status).toBe(500)
  })
})
