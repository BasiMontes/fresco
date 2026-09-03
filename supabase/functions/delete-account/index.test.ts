import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { captureDenoServe, edgeRequest, type EdgeHandler, fakeEdgeClient, getEdgeHandler } from '@/tests/mocks/edge-function'

/**
 * FRESCO-411 — orchestration coverage for `delete-account/index.ts`
 * (FRESCO-70 + ADR-0023 recent-re-auth). Pure `reauth.ts` helpers keep
 * their own tests; this pins the handler: auth → rate-limit → (registered
 * only) recent-re-auth → service-role `admin.deleteUser`, and the guest
 * short-circuit.
 */

const MAIN_AUTH = 'Bearer main.jwt'
let clientsByAuth: Record<string, ReturnType<typeof fakeEdgeClient>> = {}
let serviceClient = fakeEdgeClient()

captureDenoServe()
mock.module('../_shared/supabase-client.ts', () => ({
  createRequestClient: (authHeader: string) => (clientsByAuth[authHeader] ?? fakeEdgeClient({ user: null })).client,
}))
mock.module('../_shared/service-role-client.ts', () => ({ createServiceRoleClient: () => serviceClient.client }))

await import('./index.ts')
const handler: EdgeHandler = getEdgeHandler()

/** Unsigned JWT with the given `iat` (seconds) + `sub` — `reauth.ts` only reads the payload. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`
}

const NOW_S = Math.floor(Date.now() / 1000)
const OK_RATE = { check_and_increment_rate_limit: { data: true } }

beforeEach(() => {
  clientsByAuth = {}
  serviceClient = fakeEdgeClient()
})

function registered(reauthUserId: string | null, iat = NOW_S) {
  const reauthToken = jwt({ iat, sub: reauthUserId ?? 'x' })
  clientsByAuth[MAIN_AUTH] = fakeEdgeClient({ user: { id: 'user_1', is_anonymous: false }, rpc: OK_RATE })
  clientsByAuth[`Bearer ${reauthToken}`] = fakeEdgeClient({ user: reauthUserId ? { id: reauthUserId } : null })
  return reauthToken
}

describe('delete-account/index.ts', () => {
  test('401 with no Authorization header', async () => {
    const res = await handler(edgeRequest({}, { auth: null }))
    expect(res.status).toBe(401)
  })

  test('401 when the JWT resolves to no user', async () => {
    clientsByAuth[MAIN_AUTH] = fakeEdgeClient({ user: null })
    const res = await handler(edgeRequest({}, { auth: MAIN_AUTH }))
    expect(res.status).toBe(401)
  })

  test('429 when rate-limited', async () => {
    clientsByAuth[MAIN_AUTH] = fakeEdgeClient({ user: { id: 'user_1', is_anonymous: false }, rpc: { check_and_increment_rate_limit: { data: false } } })
    const res = await handler(edgeRequest({}, { auth: MAIN_AUTH }))
    expect(res.status).toBe(429)
  })

  test('401 when a registered caller sends no reauthToken', async () => {
    clientsByAuth[MAIN_AUTH] = fakeEdgeClient({ user: { id: 'user_1', is_anonymous: false }, rpc: OK_RATE })
    const res = await handler(edgeRequest({}, { auth: MAIN_AUTH }))
    expect(res.status).toBe(401)
    expect(serviceClient.deletedUserIds).toHaveLength(0)
  })

  test('401 when the reauthToken is stale', async () => {
    const token = registered('user_1', NOW_S - 10 * 60)
    const res = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
    expect(res.status).toBe(401)
  })

  test('401 when the reauthToken belongs to a different user', async () => {
    const token = registered('someone_else')
    const res = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
    expect(res.status).toBe(401)
  })

  test('200 and deletes the account for a registered caller with a fresh reauthToken', async () => {
    const token = registered('user_1')
    const res = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: true })
    expect(serviceClient.deletedUserIds).toEqual(['user_1'])
  })

  test('200 for a guest caller without any reauth step', async () => {
    clientsByAuth[MAIN_AUTH] = fakeEdgeClient({ user: { id: 'guest_1', is_anonymous: true }, rpc: OK_RATE })
    const res = await handler(edgeRequest({}, { auth: MAIN_AUTH }))
    expect(res.status).toBe(200)
    expect(serviceClient.deletedUserIds).toEqual(['guest_1'])
  })

  test('500 when admin.deleteUser fails', async () => {
    const token = registered('user_1')
    serviceClient = fakeEdgeClient({ adminDeleteError: new Error('supabase admin down') })
    const res = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
    expect(res.status).toBe(500)
  })
})
