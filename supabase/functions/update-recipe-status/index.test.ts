import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { semanaActualMadrid } from './week.ts'
import { captureDenoServe, edgeRequest, type EdgeHandler, fakeEdgeClient, type FakeEdgeClient, getEdgeHandler } from '@/tests/mocks/edge-function'

/**
 * FRESCO-411 — orchestration coverage for `update-recipe-status/index.ts`.
 * The pure validators (`assertEstadoValido`, `assertRatingValido`,
 * `buildUpdatePayload`) keep their own tests in `./validation.test.ts`; this
 * pins the handler wiring: auth → rate-limit → body validation → ownership
 * → terminal-state guard → substitution safety → write, and the error map.
 */

let supa: FakeEdgeClient
let svc: FakeEdgeClient
captureDenoServe()
mock.module('../_shared/supabase-client.ts', () => ({ createRequestClient: () => supa.client }))
mock.module('../_shared/service-role-client.ts', () => ({ createServiceRoleClient: () => svc.client }))

await import('./index.ts')
const handler: EdgeHandler = getEdgeHandler()

const USER = { id: 'user_1' }
const R2 = '00000000-0000-4000-8000-000000000002'
const R_BAD = '00000000-0000-4000-8000-0000000000bd'
const OK_RATE = { check_and_increment_rate_limit: { data: true } }

function slotRow(over: Record<string, unknown> = {}) {
  return { id: 'mpr_1', estado: 'pendiente', meal_plan_id: 'mp_1', meal_plans: { user_id: 'user_1', semana_iso: '2020-W01' }, ...over }
}

beforeEach(() => {
  supa = fakeEdgeClient({ user: USER, rpc: OK_RATE, rows: { meal_plan_recipes: slotRow() } })
  svc = fakeEdgeClient()
})

function call(body: unknown, init = {}) {
  supa = fakeEdgeClient({ user: USER, rpc: OK_RATE, rows: { meal_plan_recipes: slotRow() }, ...init })
  return handler(edgeRequest(body, init))
}

describe('update-recipe-status/index.ts', () => {
  test('401 when the request carries no Authorization header', async () => {
    const res = await handler(edgeRequest({ meal_plan_recipe_id: 'mpr_1', estado: 'cocinada' }, { auth: null }))
    expect(res.status).toBe(401)
  })

  test('401 when the JWT resolves to no user', async () => {
    supa = fakeEdgeClient({ user: null })
    const res = await handler(edgeRequest({ meal_plan_recipe_id: 'mpr_1', estado: 'cocinada' }))
    expect(res.status).toBe(401)
  })

  test('429 when the rate-limit RPC reports not allowed', async () => {
    supa = fakeEdgeClient({ user: USER, rpc: { check_and_increment_rate_limit: { data: false } } })
    const res = await handler(edgeRequest({ meal_plan_recipe_id: 'mpr_1', estado: 'cocinada' }))
    expect(res.status).toBe(429)
  })

  test('400 when required fields are missing', async () => {
    const res = await call({ estado: 'cocinada' })
    expect(res.status).toBe(400)
  })

  test('400 when estado is not a client-settable value', async () => {
    const res = await call({ meal_plan_recipe_id: 'mpr_1', estado: 'excluida' })
    expect(res.status).toBe(400)
  })

  test('404 when the slot does not exist', async () => {
    supa = fakeEdgeClient({ user: USER, rpc: OK_RATE, rows: { meal_plan_recipes: null } })
    const res = await handler(edgeRequest({ meal_plan_recipe_id: 'mpr_x', estado: 'cocinada' }))
    expect(res.status).toBe(404)
  })

  test('403 when the slot belongs to another user', async () => {
    supa = fakeEdgeClient({ user: USER, rpc: OK_RATE, rows: { meal_plan_recipes: slotRow({ meal_plans: { user_id: 'someone_else' } }) } })
    const res = await handler(edgeRequest({ meal_plan_recipe_id: 'mpr_1', estado: 'cocinada' }))
    expect(res.status).toBe(403)
  })

  test('409 when the slot is already marked and its week is not the current one', async () => {
    supa = fakeEdgeClient({ user: USER, rpc: OK_RATE, rows: { meal_plan_recipes: slotRow({ estado: 'cocinada' }) } })
    const res = await handler(edgeRequest({ meal_plan_recipe_id: 'mpr_1', estado: 'descartada' }))
    expect(res.status).toBe(409)
  })

  describe('a mark inside the current week can be changed (FRESCO-1014, A7-UI-15)', () => {
    const current = () => slotRow({ estado: 'cocinada', meal_plans: { user_id: 'user_1', semana_iso: semanaActualMadrid() } })

    test.each(['pendiente', 'descartada'])('cocinada -> %s is allowed and written', async (nuevo) => {
      supa = fakeEdgeClient({ user: USER, rpc: OK_RATE, rows: { meal_plan_recipes: current() } })
      svc = fakeEdgeClient()
      const res = await handler(edgeRequest({ meal_plan_recipe_id: 'mpr_1', estado: nuevo }))
      expect(res.status).toBe(200)
      expect(svc.updates).toEqual([['meal_plan_recipes', { estado: nuevo }]])
    })

    test('a marked dish is never replaced, even in the current week', async () => {
      supa = fakeEdgeClient({ user: USER, rpc: OK_RATE, rows: { meal_plan_recipes: current() } })
      const res = await handler(edgeRequest({ meal_plan_recipe_id: 'mpr_1', estado: 'sustituida', nueva_recipe_id: R2 }))
      expect(res.status).toBe(409)
    })

    test('an open slot cannot be "un-marked"', async () => {
      supa = fakeEdgeClient({ user: USER, rpc: OK_RATE, rows: { meal_plan_recipes: slotRow({ meal_plans: { user_id: 'user_1', semana_iso: semanaActualMadrid() } }) } })
      const res = await handler(edgeRequest({ meal_plan_recipe_id: 'mpr_1', estado: 'pendiente' }))
      expect(res.status).toBe(409)
    })
  })

  test('422 when a substitution recipe is unsafe for the profile', async () => {
    supa = fakeEdgeClient({
      user: USER,
      rpc: { ...OK_RATE, get_filtered_recipes: { data: [] } },
      rows: { meal_plan_recipes: slotRow() },
    })
    const res = await handler(edgeRequest({ meal_plan_recipe_id: 'mpr_1', estado: 'sustituida', nueva_recipe_id: R_BAD }))
    expect(res.status).toBe(422)
  })

  describe('substitution safety (A4-H1)', () => {
    const SAFE = { ...OK_RATE, get_filtered_recipes: { data: [{ id: R2 }] } }
    const substitute = () => handler(edgeRequest({ meal_plan_recipe_id: 'mpr_1', estado: 'sustituida', nueva_recipe_id: R2 }))

    test('400 when nueva_recipe_id is not a UUID (A8-API-02), before any slot or filter query', async () => {
      const res = await call({ meal_plan_recipe_id: 'mpr_1', estado: 'sustituida', nueva_recipe_id: 'not-a-uuid' })
      expect(res.status).toBe(400)
    })

    test('400 when "sustituida" arrives without nueva_recipe_id', async () => {
      const res = await call({ meal_plan_recipe_id: 'mpr_1', estado: 'sustituida' })
      expect(res.status).toBe(400)
    })

    test('500 when the allergen/diet filter RPC fails, and nothing is written', async () => {
      svc = fakeEdgeClient()
      supa = fakeEdgeClient({ user: USER, rpc: { ...OK_RATE, get_filtered_recipes: { error: { message: 'rpc down' } } }, rows: { meal_plan_recipes: slotRow() } })
      expect((await substitute()).status).toBe(500)
      expect(svc.updates).toEqual([])
    })

    test('409 when the recipe is already placed elsewhere in the same week', async () => {
      svc = fakeEdgeClient()
      supa = fakeEdgeClient({
        user: USER,
        rpc: SAFE,
        selectResults: { meal_plan_recipes: [{ data: slotRow() }, { data: { id: 'mpr_other' } }] },
      })
      expect((await substitute()).status).toBe(409)
      expect(svc.updates).toEqual([])
    })

    test('500 when the duplicate check itself errors', async () => {
      svc = fakeEdgeClient()
      supa = fakeEdgeClient({
        user: USER,
        rpc: SAFE,
        selectResults: { meal_plan_recipes: [{ data: slotRow() }, { error: { message: 'db down' } }] },
      })
      expect((await substitute()).status).toBe(500)
      expect(svc.updates).toEqual([])
    })

    test('a safe, new recipe is written as the slot recipe, through the service-role client only', async () => {
      svc = fakeEdgeClient()
      supa = fakeEdgeClient({
        user: USER,
        rpc: SAFE,
        selectResults: { meal_plan_recipes: [{ data: slotRow() }, { data: null }] },
      })
      const res = await substitute()
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true, estado: 'sustituida' })
      expect(svc.updates).toEqual([['meal_plan_recipes', { estado: 'sustituida', recipe_id: R2 }]])
      expect(supa.rpcCalls.find(([name]) => name === 'get_filtered_recipes')?.[1]).toEqual({ p_user_id: 'user_1', p_recipe_id: R2 })
    })
  })

  test('500 when the meal_plan_recipes update errors', async () => {
    svc = fakeEdgeClient({ updateError: { meal_plan_recipes: new Error('db down') } })
    const res = await handler(edgeRequest({ meal_plan_recipe_id: 'mpr_1', estado: 'cocinada' }))
    expect(res.status).toBe(500)
  })

  test('409 when the slot reached a terminal state between the guard and the write', async () => {
    svc = fakeEdgeClient({ updateRows: { meal_plan_recipes: [] } })
    const res = await handler(edgeRequest({ meal_plan_recipe_id: 'mpr_1', estado: 'cocinada' }))
    expect(res.status).toBe(409)
  })

  test('200 and { ok: true, estado } on the happy path', async () => {
    const res = await call({ meal_plan_recipe_id: 'mpr_1', estado: 'cocinada' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, estado: 'cocinada' })
    expect(svc.updates).toEqual([['meal_plan_recipes', { estado: 'cocinada' }]])
  })

  test('a rating in the body is ignored, not rejected and not written (FRESCO-1012, ADR-0063)', async () => {
    for (const rating of [4, 3.7, '3', null]) {
      svc = fakeEdgeClient({ updateRows: { meal_plan_recipes: [{ id: 'mpr_1' }] } })
      const res = await call({ meal_plan_recipe_id: 'mpr_1', estado: 'cocinada', rating })
      expect(res.status).toBe(200)
      expect(svc.updates).toEqual([['meal_plan_recipes', { estado: 'cocinada' }]])
    }
  })

  test('the protected write never goes through the caller client or a client-callable RPC (audit-6 A6-S1)', async () => {
    await call({ meal_plan_recipe_id: 'mpr_1', estado: 'cocinada' })
    expect(supa.updates).toEqual([])
    expect(supa.rpcCalls.map(([name]) => name)).not.toContain('apply_recipe_status_update')
  })

  test('nothing is written when a guard rejects the request', async () => {
    svc = fakeEdgeClient()
    supa = fakeEdgeClient({ user: USER, rpc: OK_RATE, rows: { meal_plan_recipes: slotRow({ estado: 'cocinada' }) } })
    const res = await handler(edgeRequest({ meal_plan_recipe_id: 'mpr_1', estado: 'descartada' }))
    expect(res.status).toBe(409)
    expect(svc.updates).toEqual([])
  })
})
