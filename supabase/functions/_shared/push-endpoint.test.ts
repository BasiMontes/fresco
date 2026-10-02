import { describe, expect, test } from 'bun:test'
import { ALLOWED_PUSH_ENDPOINTS, REJECTED_PUSH_ENDPOINTS } from './push-endpoint.fixtures.ts'
import { isAllowedPushEndpoint, MAX_PUSH_ENDPOINT_LENGTH } from './push-endpoint.ts'

describe('isAllowedPushEndpoint (FRESCO-779)', () => {
  test.each(ALLOWED_PUSH_ENDPOINTS)('accepts the real push service endpoint %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true)
  })

  test.each(REJECTED_PUSH_ENDPOINTS)('rejects %j', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false)
  })

  test('rejects an endpoint longer than the cap even on an allowed host', () => {
    const path = 'a'.repeat(MAX_PUSH_ENDPOINT_LENGTH)
    expect(isAllowedPushEndpoint(`https://fcm.googleapis.com/${path}`)).toBe(false)
    const fits = `https://fcm.googleapis.com/${'a'.repeat(MAX_PUSH_ENDPOINT_LENGTH - 'https://fcm.googleapis.com/'.length)}`
    expect(fits.length).toBe(MAX_PUSH_ENDPOINT_LENGTH)
    expect(isAllowedPushEndpoint(fits)).toBe(true)
  })
})
