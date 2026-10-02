import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test'
import { captureDenoServe, edgeRequest, type EdgeHandler, fakeEdgeClient, type FakeEdgeClient, getEdgeHandler } from '@/tests/mocks/edge-function'

/**
 * FRESCO-779 (audit-6 A6-S2) — the weekly push sender must not be a blind SSRF
 * and must not let one slow endpoint stall the batch. Pins: endpoints off the
 * push-service allowlist are never fetched, every send carries a timeout, sends
 * run in bounded parallel batches, a failing send never aborts the rest, and the
 * batch stops starting new sends once its time budget is spent.
 */

interface SendCall { endpoint: string, options: unknown }

let svc: FakeEdgeClient
let sends: SendCall[] = []
let inFlight = 0
let maxInFlight = 0
let sendImpl: (endpoint: string) => Promise<void> = async () => {}

captureDenoServe()
void mock.module('../_shared/service-role-client.ts', () => ({ createServiceRoleClient: () => svc.client }))
void mock.module('../_shared/posthog.ts', () => ({ captureServerEvent: async () => {} }))
void mock.module('web-push', () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: async (subscription: { endpoint: string }, _payload: string, options: unknown) => {
      sends.push({ endpoint: subscription.endpoint, options })
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      try {
        await sendImpl(subscription.endpoint)
      }
      finally {
        inFlight--
      }
    },
  },
}))

process.env.SUPABASE_SECRET_KEYS = JSON.stringify({ default: 'service-key' })
process.env.VAPID_PUBLIC_KEY = 'pub'
process.env.VAPID_PRIVATE_KEY = 'priv'
process.env.VAPID_SUBJECT = 'mailto:test@example.com'

await import('./index.ts')
const handler: EdgeHandler = getEdgeHandler()

const GOOD = 'https://fcm.googleapis.com/fcm/send/'

function row(i: number, endpoint = `${GOOD}${i}`) {
  return { id: `sub_${i}`, user_id: `user_${i}`, endpoint, p256dh: 'k', auth: 'a' }
}

function call() {
  return handler(edgeRequest(undefined, { headers: { apikey: 'service-key' }, auth: null }))
}

function withTargets(rows: ReturnType<typeof row>[]) {
  svc = fakeEdgeClient({ rpc: { get_push_subscriptions_without_current_plan: { data: rows } } })
}

beforeEach(() => {
  sends = []
  inFlight = 0
  maxInFlight = 0
  sendImpl = async () => {}
  svc = fakeEdgeClient()
})

afterEach(() => {
  setSystemTime()
})

describe('send-weekly-reengagement-push/index.ts', () => {
  test('401 when the caller is not the service-role cron', async () => {
    const res = await handler(edgeRequest(undefined, { headers: { apikey: 'wrong' }, auth: null }))
    expect(res.status).toBe(401)
    expect(sends).toEqual([])
  })

  test('sends to a real push endpoint with a request timeout', async () => {
    withTargets([row(1)])
    const res = await call()
    expect(res.status).toBe(200)
    expect(sends).toHaveLength(1)
    expect((sends[0].options as { timeout: number }).timeout).toBeGreaterThan(0)
    expect((sends[0].options as { timeout: number }).timeout).toBeLessThanOrEqual(15_000)
  })

  test('never fetches an endpoint outside the push-service allowlist (A6-S2)', async () => {
    withTargets([
      row(1),
      row(2, 'https://attacker.tld/x'),
      row(3, 'http://169.254.169.254/latest/meta-data/'),
      row(4, 'https://fcm.googleapis.com.attacker.tld/x'),
    ])
    const res = await call()
    expect(res.status).toBe(200)
    expect(sends.map(s => s.endpoint)).toEqual([`${GOOD}1`])
    const body = await res.json() as { users_targeted: number, notifications_sent: number }
    expect(body.notifications_sent).toBe(1)
    expect(body.users_targeted).toBe(1)
  })

  test('runs sends in bounded parallel batches instead of one at a time', async () => {
    withTargets(Array.from({ length: 25 }, (_, i) => row(i)))
    sendImpl = async () => {
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    const res = await call()
    expect(res.status).toBe(200)
    expect(sends).toHaveLength(25)
    expect(maxInFlight).toBeGreaterThan(1)
    expect(maxInFlight).toBeLessThanOrEqual(10)
  })

  test('a failing send is skipped and the rest of the batch still goes out', async () => {
    withTargets([row(1), row(2), row(3)])
    sendImpl = async (endpoint) => {
      if (endpoint.endsWith('/2')) throw Object.assign(new Error('timeout'), { statusCode: 504 })
    }
    const res = await call()
    expect(res.status).toBe(200)
    expect(sends).toHaveLength(3)
    expect(await res.json()).toMatchObject({ notifications_sent: 2, stale_subscriptions_removed: 0 })
    expect(svc.deletes).toEqual([])
  })

  test('a 410 from the push service removes the dead subscription', async () => {
    withTargets([row(1), row(2)])
    sendImpl = async (endpoint) => {
      if (endpoint.endsWith('/1')) throw Object.assign(new Error('gone'), { statusCode: 410 })
    }
    const res = await call()
    expect(await res.json()).toMatchObject({ notifications_sent: 1, stale_subscriptions_removed: 1 })
    expect(svc.deletes).toEqual([['push_subscriptions', 'sub_1']])
  })

  test('stops starting new batches once the time budget is spent', async () => {
    withTargets(Array.from({ length: 30 }, (_, i) => row(i)))
    sendImpl = async () => {
      // The first batch "takes" longer than the whole budget.
      setSystemTime(new Date(Date.now() + 10 * 60 * 1000))
    }
    const res = await call()
    expect(res.status).toBe(200)
    expect(sends).toHaveLength(10)
  })
})
