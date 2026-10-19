import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { captureDenoServe, edgeRequest, type EdgeHandler, fakeEdgeClient, type FakeEdgeClient, getEdgeHandler } from '@/tests/mocks/edge-function'

/**
 * FRESCO-991 — orchestration coverage for `delete-catalog-recipe/index.ts`:
 * auth → admin allowlist → body → existence → FK precheck → delete. The
 * service-role client is a hand-rolled stub because the shared fake does not
 * model `select(..., { count, head })`.
 */

interface ServiceConfig {
  recipe?: { id: string, slug: string } | null
  recipeError?: unknown
  count?: number | null
  countError?: unknown
  deleteError?: unknown
}

let supa: FakeEdgeClient
let service: ReturnType<typeof serviceStub>
captureDenoServe()
mock.module('../_shared/supabase-client.ts', () => ({ createRequestClient: () => supa.client }))
mock.module('../_shared/service-role-client.ts', () => ({ createServiceRoleClient: () => service.client }))

function serviceStub(config: ServiceConfig) {
  const deletedIds: unknown[] = []
  const client = {
    from: (table: string) => ({
      select: (_cols: string, opts?: { head?: boolean }) => {
        const result = opts?.head
          ? { count: config.count ?? 0, error: config.countError ?? null }
          : { data: config.recipe ?? null, error: config.recipeError ?? null }
        const chain = { eq: () => chain, maybeSingle: async () => result, then: (f: (v: unknown) => unknown) => Promise.resolve(result).then(f) }
        return chain
      },
      delete: () => ({
        eq: async (_column: string, id: unknown) => {
          deletedIds.push([table, id])
          return { error: config.deleteError ?? null }
        },
      }),
    }),
  }
  return { client, deletedIds }
}

process.env.ADMIN_USER_ID = 'admin_1, admin_2'
await import('./index.ts')
const handler: EdgeHandler = getEdgeHandler()

const RECIPE = { id: 'r1', slug: 'tortilla' }

beforeEach(() => {
  supa = fakeEdgeClient({ user: { id: 'admin_1' } })
  service = serviceStub({ recipe: RECIPE })
})

describe('delete-catalog-recipe/index.ts', () => {
  test('401 without a user', async () => {
    supa = fakeEdgeClient({ user: null })
    expect((await handler(edgeRequest({ recipe_id: 'r1' }))).status).toBe(401)
  })

  test('403 for an authenticated user outside the admin allowlist, and nothing is deleted', async () => {
    supa = fakeEdgeClient({ user: { id: 'someone' } })
    const res = await handler(edgeRequest({ recipe_id: 'r1' }))
    expect(res.status).toBe(403)
    expect(service.deletedIds).toEqual([])
  })

  test('400 when recipe_id is missing', async () => {
    expect((await handler(edgeRequest({}))).status).toBe(400)
  })

  test('404 when the recipe does not exist', async () => {
    service = serviceStub({ recipe: null })
    expect((await handler(edgeRequest({ recipe_id: 'nope' }))).status).toBe(404)
  })

  test('500 when reading the recipe fails', async () => {
    service = serviceStub({ recipeError: { message: 'db down' } })
    expect((await handler(edgeRequest({ recipe_id: 'r1' }))).status).toBe(500)
  })

  test('409 when a meal plan still references the recipe, and nothing is deleted', async () => {
    service = serviceStub({ recipe: RECIPE, count: 3 })
    const res = await handler(edgeRequest({ recipe_id: 'r1' }))
    expect(res.status).toBe(409)
    expect(service.deletedIds).toEqual([])
  })

  test('500 when the reference count fails', async () => {
    service = serviceStub({ recipe: RECIPE, countError: { message: 'db down' } })
    expect((await handler(edgeRequest({ recipe_id: 'r1' }))).status).toBe(500)
  })

  test('500 when the delete itself fails', async () => {
    service = serviceStub({ recipe: RECIPE, deleteError: { message: 'fk' } })
    expect((await handler(edgeRequest({ recipe_id: 'r1' }))).status).toBe(500)
  })

  test('200 returns id and slug and deletes exactly that recipe (second allowlisted admin too)', async () => {
    supa = fakeEdgeClient({ user: { id: 'admin_2' } })
    const res = await handler(edgeRequest({ recipe_id: 'r1' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(RECIPE)
    expect(service.deletedIds).toEqual([['recipes', 'r1']])
  })
})
