import { describe, expect, it } from 'bun:test'
import { buildSentryEnvelope, captureEdgeException, parseSentryDsn } from './sentry.ts'

const DSN = 'https://abc123def456@o123456.ingest.sentry.io/7891011'

const CTX = {
  fn: 'generate-meal-plan',
  errorId: '11111111-1111-1111-1111-111111111111',
  userId: 'user-42',
  url: 'https://x.supabase.co/functions/v1/generate-meal-plan',
  method: 'POST',
}

describe('parseSentryDsn', () => {
  it('splits a modern DSN into the envelope endpoint + public key', () => {
    expect(parseSentryDsn(DSN)).toEqual({
      endpoint: 'https://o123456.ingest.sentry.io/api/7891011/envelope/',
      publicKey: 'abc123def456',
    })
  })

  it('returns null for a DSN with no key or no project id', () => {
    expect(parseSentryDsn('https://o123456.ingest.sentry.io/7891011')).toBeNull()
    expect(parseSentryDsn('https://abc@o123456.ingest.sentry.io/')).toBeNull()
    expect(parseSentryDsn('not a url')).toBeNull()
    expect(parseSentryDsn('')).toBeNull()
  })
})

describe('buildSentryEnvelope', () => {
  it('returns null for a malformed DSN', () => {
    expect(buildSentryEnvelope('nope', new Error('x'), CTX, 'production')).toBeNull()
  })

  it('targets the envelope endpoint with a v7 auth header', () => {
    const env = buildSentryEnvelope(DSN, new Error('boom'), CTX, 'production')!
    expect(env.url).toBe('https://o123456.ingest.sentry.io/api/7891011/envelope/')
    expect(env.headers['Content-Type']).toBe('application/x-sentry-envelope')
    expect(env.headers['X-Sentry-Auth']).toContain('sentry_version=7')
    expect(env.headers['X-Sentry-Auth']).toContain('sentry_key=abc123def456')
  })

  it('emits three NDJSON lines: envelope header, item header, event', () => {
    const env = buildSentryEnvelope(DSN, new Error('boom'), CTX, 'staging')!
    const lines = env.body.split('\n')
    expect(lines).toHaveLength(3)
    expect(JSON.parse(lines[0]!)).toHaveProperty('event_id')
    expect(JSON.parse(lines[1]!)).toEqual({ type: 'event', content_type: 'application/json' })
    const event = JSON.parse(lines[2]!)
    expect(event.exception.values[0]).toMatchObject({ type: 'Error', value: 'boom' })
    expect(event.tags).toEqual({ fn: 'generate-meal-plan', error_id: CTX.errorId })
    expect(event.user).toEqual({ id: 'user-42' })
    expect(event.request).toEqual({ url: CTX.url, method: 'POST' })
    expect(event.environment).toBe('staging')
    expect(event.level).toBe('error')
  })

  it('omits user when there is no userId, and request when there is no url', () => {
    const env = buildSentryEnvelope(DSN, new Error('boom'), { fn: 'f', errorId: 'e' }, 'production')!
    const event = JSON.parse(env.body.split('\n')[2]!)
    expect(event.user).toBeUndefined()
    expect(event.request).toBeUndefined()
  })

  it('handles a non-Error throw', () => {
    const env = buildSentryEnvelope(DSN, 'string failure', { fn: 'f', errorId: 'e' }, 'production')!
    const event = JSON.parse(env.body.split('\n')[2]!)
    expect(event.exception.values[0]).toEqual({ type: 'Error', value: 'string failure' })
  })
})

describe('captureEdgeException', () => {
  it('resolves without throwing when Sentry is not configured (no Deno / no DSN)', async () => {
    await expect(captureEdgeException(new Error('boom'), { fn: 'f', errorId: 'e' })).resolves.toBeUndefined()
  })
})
