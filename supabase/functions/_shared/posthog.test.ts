import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { captureDenoServe } from '@/tests/mocks/edge-function'

/**
 * FRESCO-991 — `captureServerEvent` is consent-gated analytics (ADR-0044):
 * only an explicit `analytics_consent = true` sends; every other state
 * (rejected, unsynced, missing row, read error, missing config) stays silent,
 * and no failure ever rejects the caller.
 */

interface ConsentRead { data?: { analytics_consent?: boolean | null } | null, error?: { message: string } | null }

function supabaseWith(read: ConsentRead) {
  return {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: read.data ?? null, error: read.error ?? null }) }) }) }),
  } as never
}

// `mock.module` is process-global and send-weekly-reengagement-push stubs this module; the query
// string gives this file the real implementation regardless of test order.
const realModulePath: string = './posthog.ts?real'
const { captureServerEvent } = (await import(realModulePath)) as typeof import('./posthog.ts')

const realFetch = globalThis.fetch
const ENV = { POSTHOG_API_KEY: 'phc_test', POSTHOG_HOST: 'https://eu.posthog.test' }
const deno = () => (globalThis as unknown as { Deno: { env: { get: (key: string) => string | undefined } } }).Deno
let realEnv: { get: (key: string) => string | undefined }
let env: Record<string, string | undefined>
let calls: Array<{ url: string, init: RequestInit }>
let fetchResult: () => Promise<Response>

beforeEach(() => {
  captureDenoServe()
  // Other suites install their own Deno shim in the shared process; pin ours.
  realEnv = deno().env
  env = { ...ENV }
  deno().env = { get: key => env[key] }
  calls = []
  fetchResult = async () => new Response('{}', { status: 200 })
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return fetchResult()
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  deno().env = realEnv
})

const send = (read: ConsentRead) =>
  captureServerEvent({ supabase: supabaseWith(read), distinctId: 'u1', event: 'push_sent', properties: { kind: 'x' } })

describe('captureServerEvent', () => {
  test('sends the event with the key, id and properties when consent is explicitly true', async () => {
    await send({ data: { analytics_consent: true } })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://eu.posthog.test/capture/')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ api_key: 'phc_test', event: 'push_sent', distinct_id: 'u1', properties: { kind: 'x' } })
  })

  test.each([
    ['rejected', { data: { analytics_consent: false } }],
    ['not synced yet (null)', { data: { analytics_consent: null } }],
    ['no profile row', { data: null }],
    ['read error', { error: { message: 'down' } }],
  ])('sends nothing when consent is %s', async (_label, read) => {
    await send(read as ConsentRead)
    expect(calls).toEqual([])
  })

  test('sends nothing when the key or host is not configured', async () => {
    delete env.POSTHOG_HOST
    await send({ data: { analytics_consent: true } })
    expect(calls).toEqual([])
  })

  test('a non-2xx answer does not reject', async () => {
    fetchResult = async () => new Response('no', { status: 500 })
    await expect(send({ data: { analytics_consent: true } })).resolves.toBeUndefined()
  })

  test('a network failure does not reject', async () => {
    fetchResult = async () => { throw new Error('offline') }
    await expect(send({ data: { analytics_consent: true } })).resolves.toBeUndefined()
  })
})
