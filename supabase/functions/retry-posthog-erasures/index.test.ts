import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test'
import { captureDenoServe, edgeRequest, type EdgeHandler, fakeEdgeClient, type FakeEdgeClient, getEdgeHandler } from '@/tests/mocks/edge-function'

/**
 * FRESCO-947 (follow-up to FRESCO-910, GDPR art. 17) — the daily sweep that retries the PostHog
 * deletions that failed when an account was erased. Pins: only the cron can call it; a row whose
 * deletion now works leaves `failed` and drops its id together (the table constraint ties the
 * two); a row that fails again counts an attempt and stays; a row past the cap is neither retried
 * nor lost, and is logged; one failing row never stops the rest; a missing credential changes no row.
 *
 * Only the service-role client is mocked as a module. `deletePostHogPerson` and the logger run for
 * real: PostHog is faked at `fetch`, the logs are read off `console` (`mock.module` is
 * process-global, so mocking those two would break their own test files).
 */

type Behaviour = 'deleted' | 'not_found' | 'fail'

let svc: FakeEdgeClient
let behaviour: Record<string, Behaviour> = {}
let lookedUp: string[] = []
let errorLines: Array<{ message: string, [key: string]: unknown }> = []
const realFetch = globalThis.fetch
const realConsoleError = console.error
const realConsoleWarn = console.warn
const ENV_KEYS = ['POSTHOG_API_HOST', 'POSTHOG_PROJECT_ID', 'POSTHOG_PERSONAL_API_KEY']

captureDenoServe()
void mock.module('../_shared/service-role-client.ts', () => ({ createServiceRoleClient: () => svc.client }))

process.env.SUPABASE_SECRET_KEYS = JSON.stringify({ default: 'service-key' })

await import('./index.ts')
const handler: EdgeHandler = getEdgeHandler()

const NOW = new Date('2026-10-14T04:30:00.000Z')

/** PostHog as `deletePostHogPerson` sees it: lookup by distinct id, then delete the person. */
function fakePostHog(input: RequestInfo | URL, init?: RequestInit): Response {
  const url = new URL(String(input))
  if ((init?.method ?? 'GET') === 'GET') {
    const distinctId = url.searchParams.get('distinct_id') ?? ''
    lookedUp.push(distinctId)
    const outcome = behaviour[distinctId] ?? 'deleted'
    if (outcome === 'fail') return new Response('unavailable', { status: 503 })
    return new Response(JSON.stringify({ results: outcome === 'not_found' ? [] : [{ id: 'person' }] }), { status: 200 })
  }
  return new Response(null, { status: 202 })
}

function failed(id: string, attempts = 0) {
  return { id: `row_${id}`, pending_posthog_distinct_id: `user_${id}`, posthog_attempts: attempts }
}

function withFailedRows(rows: ReturnType<typeof failed>[]) {
  svc = fakeEdgeClient({ rows: { account_erasures: rows } })
}

function call() {
  return handler(edgeRequest(undefined, { headers: { apikey: 'service-key' }, auth: null }))
}

const messages = () => errorLines.map(line => line.message)

interface Summary { attempted: number, deleted: number, still_failing: number, gave_up: number }

beforeEach(() => {
  behaviour = {}
  lookedUp = []
  errorLines = []
  svc = fakeEdgeClient()
  process.env.POSTHOG_API_HOST = 'https://eu.posthog.com'
  process.env.POSTHOG_PROJECT_ID = '4242'
  process.env.POSTHOG_PERSONAL_API_KEY = 'phx_test'
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => fakePostHog(input, init)) as typeof fetch
  console.error = (line: unknown) => { errorLines.push(JSON.parse(String(line))) }
  console.warn = () => {}
  setSystemTime(NOW)
})

afterEach(() => {
  globalThis.fetch = realFetch
  console.error = realConsoleError
  console.warn = realConsoleWarn
  for (const key of ENV_KEYS) delete process.env[key]
  setSystemTime()
})

describe('retry-posthog-erasures/index.ts', () => {
  test('401 when the caller is not the service-role cron, and nothing is touched', async () => {
    withFailedRows([failed('1')])

    const res = await handler(edgeRequest(undefined, { headers: { apikey: 'wrong' }, auth: null }))

    expect(res.status).toBe(401)
    expect(lookedUp).toEqual([])
    expect(svc.updates).toEqual([])
  })

  test('a deletion that now works moves the row out of failed and drops the id in the same write', async () => {
    withFailedRows([failed('1')])

    const res = await call()

    expect(res.status).toBe(200)
    expect(lookedUp).toEqual(['user_1'])
    expect(svc.updates).toEqual([['account_erasures', {
      posthog: 'deleted',
      pending_posthog_distinct_id: null,
      posthog_last_attempt_at: NOW.toISOString(),
    }]])
    expect(await res.json() as Summary).toEqual({ attempted: 1, deleted: 1, still_failing: 0, gave_up: 0 })
  })

  test('a person PostHog no longer has is recorded as not_found and the id is dropped', async () => {
    withFailedRows([failed('1')])
    behaviour = { user_1: 'not_found' }

    await call()

    expect(svc.updates[0]?.[1]).toMatchObject({ posthog: 'not_found', pending_posthog_distinct_id: null })
  })

  test('a deletion that fails again counts one attempt and keeps the row failed with its id', async () => {
    withFailedRows([failed('1', 3)])
    behaviour = { user_1: 'fail' }

    const res = await call()

    expect(res.status).toBe(200)
    expect(svc.updates).toEqual([['account_erasures', { posthog_attempts: 4, posthog_last_attempt_at: NOW.toISOString() }]])
    expect(await res.json() as Summary).toEqual({ attempted: 1, deleted: 0, still_failing: 1, gave_up: 0 })
  })

  test('a row past the attempt cap is not retried, not changed, and is logged without the user id', async () => {
    withFailedRows([failed('1', 10)])

    const res = await call()

    expect(lookedUp).toEqual([])
    expect(svc.updates).toEqual([])
    expect(messages()).toContain('PostHog erasure retries exhausted, manual deletion needed')
    expect(JSON.stringify(errorLines)).not.toContain('user_1')
    expect(await res.json() as Summary).toEqual({ attempted: 0, deleted: 0, still_failing: 0, gave_up: 1 })
  })

  test('one failing row does not stop the rows after it', async () => {
    withFailedRows([failed('1'), failed('2'), failed('3')])
    behaviour = { user_2: 'fail' }

    const res = await call()

    expect(lookedUp).toEqual(['user_1', 'user_2', 'user_3'])
    expect(await res.json() as Summary).toEqual({ attempted: 3, deleted: 2, still_failing: 1, gave_up: 0 })
  })

  test('without PostHog credentials no row is changed and no attempt is spent', async () => {
    withFailedRows([failed('1'), failed('2')])
    delete process.env.POSTHOG_PERSONAL_API_KEY

    const res = await call()

    expect(lookedUp).toEqual([])
    expect(svc.updates).toEqual([])
    expect(messages()).toContain('PostHog credentials are not configured, nothing was retried')
    expect(await res.json() as Summary).toEqual({ attempted: 1, deleted: 0, still_failing: 1, gave_up: 0 })
  })

  test('a failed read of the table answers 500 instead of a quiet empty pass', async () => {
    svc = fakeEdgeClient({ selectError: { account_erasures: new Error('permission denied') } })

    const res = await call()

    expect(res.status).toBe(500)
  })
})
