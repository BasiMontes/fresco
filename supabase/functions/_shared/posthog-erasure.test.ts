import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { captureDenoServe } from '@/tests/mocks/edge-function'
import { deletePostHogPerson } from './posthog-erasure.ts'

/**
 * FRESCO-910 (audit C-06) — erasing a person from PostHog: configuration gate, the
 * lookup-then-delete sequence, and that a failed call throws (the caller records it).
 * `fetch` is replaced, so nothing touches the network.
 */

captureDenoServe()

interface Call { url: string, method: string, authorization: string | null }
let calls: Call[] = []
let responses: Response[] = []
const realFetch = globalThis.fetch
const ENV_KEYS: string[] = ['POSTHOG_API_HOST', 'POSTHOG_PROJECT_ID', 'POSTHOG_PERSONAL_API_KEY']

beforeEach(() => {
  calls = []
  responses = []
  process.env.POSTHOG_API_HOST = 'https://eu.posthog.com/'
  process.env.POSTHOG_PROJECT_ID = '4242'
  process.env.POSTHOG_PERSONAL_API_KEY = 'phx_test'
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? 'GET', authorization: new Headers(init?.headers).get('Authorization') })
    const next = responses.shift()
    if (!next) throw new Error('unexpected fetch')
    return next
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  for (const key of ENV_KEYS) delete process.env[key]
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('deletePostHogPerson', () => {
  test.each(ENV_KEYS)('reports not_configured, without calling PostHog, when %s is missing', async (missing) => {
    delete process.env[missing]

    expect(await deletePostHogPerson('user_1')).toBe('not_configured')
    expect(calls).toEqual([])
  })

  test('looks the person up by distinct id, then deletes it with its events', async () => {
    responses = [json({ results: [{ id: 'person-uuid' }] }), new Response(null, { status: 202 })]

    expect(await deletePostHogPerson('user 1')).toBe('deleted')
    expect(calls).toEqual([
      { url: 'https://eu.posthog.com/api/projects/4242/persons/?distinct_id=user%201', method: 'GET', authorization: 'Bearer phx_test' },
      { url: 'https://eu.posthog.com/api/projects/4242/persons/person-uuid/?delete_events=true', method: 'DELETE', authorization: 'Bearer phx_test' },
    ])
  })

  test('reports not_found, and deletes nothing, when PostHog has no such person', async () => {
    responses = [json({ results: [] })]

    expect(await deletePostHogPerson('user_1')).toBe('not_found')
    expect(calls).toHaveLength(1)
  })

  test('treats a 404 on the delete as already gone', async () => {
    responses = [json({ results: [{ id: 7 }] }), new Response(null, { status: 404 })]

    expect(await deletePostHogPerson('user_1')).toBe('not_found')
  })

  test('throws when the lookup fails, so the caller can record it', async () => {
    responses = [new Response('nope', { status: 401 })]

    await expect(deletePostHogPerson('user_1')).rejects.toThrow('lookup failed with status 401')
  })

  test('throws when the delete fails', async () => {
    responses = [json({ results: [{ id: 7 }] }), new Response('boom', { status: 500 })]

    await expect(deletePostHogPerson('user_1')).rejects.toThrow('deletion failed with status 500')
  })
})
