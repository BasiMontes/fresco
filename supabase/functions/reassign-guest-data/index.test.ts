import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { captureDenoServe, edgeRequest, type EdgeHandler, fakeEdgeClient, getEdgeHandler } from '@/tests/mocks/edge-function'

/**
 * FRESCO-411 — orchestration coverage for `reassign-guest-data/index.ts`
 * (ADR-0004 + ADR-0022 token-verified ownership proof). Pins the handler:
 * guest-only guard → rate-limit → body validation → target-token
 * verification → service-role `reassign_guest_data` RPC → orphan cleanup.
 */

const GUEST_AUTH = 'Bearer guest.jwt'
const TARGET_TOKEN = 'target.session.token'
let clientsByAuth: Record<string, ReturnType<typeof fakeEdgeClient>> = {}
let serviceClient = fakeEdgeClient()

captureDenoServe()
mock.module('../_shared/supabase-client.ts', () => ({
  createRequestClient: (authHeader: string) => (clientsByAuth[authHeader] ?? fakeEdgeClient({ user: null })).client,
}))
mock.module('../_shared/service-role-client.ts', () => ({ createServiceRoleClient: () => serviceClient.client }))

await import('./index.ts')
const handler: EdgeHandler = getEdgeHandler()

const OK_RATE = { check_and_increment_rate_limit: { data: true } }

function wireGuest(over: Parameters<typeof fakeEdgeClient>[0] = {}) {
  clientsByAuth[GUEST_AUTH] = fakeEdgeClient({ user: { id: 'guest_1', is_anonymous: true }, rpc: OK_RATE, ...over })
}
function wireTarget(user: { id: string, is_anonymous?: boolean } | null) {
  clientsByAuth[`Bearer ${TARGET_TOKEN}`] = fakeEdgeClient({ user })
}

beforeEach(() => {
  clientsByAuth = {}
  serviceClient = fakeEdgeClient({ rpc: { reassign_guest_data: { data: 0 } } })
})

function body(over: Record<string, unknown> = {}) {
  return { targetAccessToken: TARGET_TOKEN, ...over }
}

describe('reassign-guest-data/index.ts', () => {
  test('401 with no Authorization header', async () => {
    expect((await handler(edgeRequest(body(), { auth: null }))).status).toBe(401)
  })

  test('400 when the caller is not an anonymous session', async () => {
    clientsByAuth[GUEST_AUTH] = fakeEdgeClient({ user: { id: 'user_1', is_anonymous: false }, rpc: OK_RATE })
    expect((await handler(edgeRequest(body(), { auth: GUEST_AUTH }))).status).toBe(400)
  })

  test('429 when rate-limited', async () => {
    wireGuest({ rpc: { check_and_increment_rate_limit: { data: false } } })
    expect((await handler(edgeRequest(body(), { auth: GUEST_AUTH }))).status).toBe(429)
  })

  test('400 when targetAccessToken is missing', async () => {
    wireGuest()
    expect((await handler(edgeRequest({}, { auth: GUEST_AUTH }))).status).toBe(400)
  })

  test('401 when the target token does not resolve to a user', async () => {
    wireGuest()
    wireTarget(null)
    expect((await handler(edgeRequest(body(), { auth: GUEST_AUTH }))).status).toBe(401)
  })

  test('400 when the target account is itself anonymous', async () => {
    wireGuest()
    wireTarget({ id: 'other_guest', is_anonymous: true })
    expect((await handler(edgeRequest(body(), { auth: GUEST_AUTH }))).status).toBe(400)
  })

  test('400 when the target account is the current session', async () => {
    wireGuest()
    wireTarget({ id: 'guest_1' })
    expect((await handler(edgeRequest(body(), { auth: GUEST_AUTH }))).status).toBe(400)
  })

  test('500 when the reassign_guest_data RPC errors', async () => {
    wireGuest()
    wireTarget({ id: 'real_user' })
    serviceClient = fakeEdgeClient({ rpc: { reassign_guest_data: { error: new Error('rpc boom') } } })
    expect((await handler(edgeRequest(body(), { auth: GUEST_AUTH }))).status).toBe(500)
  })

  test('200 { reassigned: true } and cleans up the orphaned guest identity', async () => {
    wireGuest()
    wireTarget({ id: 'real_user' })
    const res = await handler(edgeRequest(body(), { auth: GUEST_AUTH }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ reassigned: true })
    expect(serviceClient.rpcCalls[0]).toEqual(['reassign_guest_data', { p_from_user_id: 'guest_1', p_to_user_id: 'real_user' }])
    expect(serviceClient.deletedUserIds).toEqual(['guest_1'])
  })
})
