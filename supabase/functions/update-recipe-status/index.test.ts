import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { captureDenoServe, edgeRequest, type EdgeHandler, fakeEdgeClient, type FakeEdgeClient, getEdgeHandler } from '@/tests/mocks/edge-function'

/**
 * FRESCO-411 — orchestration coverage for `update-recipe-status/index.ts`.
 * The pure validators (`assertEstadoValido`, `assertRatingValido`,
 * `buildUpdatePayload`) keep their own tests in `./validation.test.ts`; this
 * pins the handler wiring: auth → rate-limit → body validation → ownership
 * → terminal-state guard → substitution safety → write, and the error map.
 */

let supa: FakeEdgeClient
captureDenoServe()
mock.module('../_shared/supabase-client.ts', () => ({ createRequestClient: () => supa.client }))

await import('./index.ts')
const handler: EdgeHandler = getEdgeHandler()

const USER = { id: 'user_1' }
const OK_RATE = { check_and_increment_rate_limit: { data: true } }

function slotRow(over: Record<string, unknown> = {}) {
  return { id: 'mpr_1', estado: 'pendiente', meal_plan_id: 'mp_1', meal_plans: { user_id: 'user_1' }, ...over }
}

beforeEach(() => {
  supa = fakeEdgeClient({ user: USER, rpc: OK_RATE, rows: { meal_plan_recipes: slotRow() } })
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

  test('400 when rating is not an integer 1-5', async () => {
    const res = await call({ meal_plan_recipe_id: 'mpr_1', estado: 'cocinada', rating: 3.7 })
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

  test('409 when the slot is already in a terminal state', async () => {
    supa = fakeEdgeClient({ user: USER, rpc: OK_RATE, rows: { meal_plan_recipes: slotRow({ estado: 'cocinada' }) } })
    const res = await handler(edgeRequest({ meal_plan_recipe_id: 'mpr_1', estado: 'descartada' }))
    expect(res.status).toBe(409)
  })

  test('422 when a substitution recipe is unsafe for the profile', async () => {
    supa = fakeEdgeClient({
      user: USER,
      rpc: { ...OK_RATE, get_filtered_recipes: { data: [] } },
      rows: { meal_plan_recipes: slotRow() },
    })
    const res = await handler(edgeRequest({ meal_plan_recipe_id: 'mpr_1', estado: 'sustituida', nueva_recipe_id: 'r_bad' }))
    expect(res.status).toBe(422)
  })

  test('500 when the meal_plan_recipes update errors', async () => {
    supa = fakeEdgeClient({ user: USER, rpc: OK_RATE, rows: { meal_plan_recipes: slotRow() }, updateError: { meal_plan_recipes: new Error('db down') } })
    const res = await handler(edgeRequest({ meal_plan_recipe_id: 'mpr_1', estado: 'cocinada' }))
    expect(res.status).toBe(500)
  })

  test('200 and { ok: true, estado } on the happy path', async () => {
    const res = await call({ meal_plan_recipe_id: 'mpr_1', estado: 'cocinada', rating: 4 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, estado: 'cocinada' })
    expect(supa.updates[0][0]).toBe('meal_plan_recipes')
  })
})
