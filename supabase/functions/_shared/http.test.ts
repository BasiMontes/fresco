import { describe, expect, it } from 'bun:test'
import { HttpError, toErrorResponse, userIdFromAuthHeader } from './http.ts'

/** Minimal unsigned JWT with the given payload — only the `sub` claim is ever read. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`
}

function reqWith(headers: Record<string, string>): Request {
  return new Request('https://x.supabase.co/functions/v1/f', { method: 'POST', headers })
}

describe('userIdFromAuthHeader', () => {
  it('returns the sub claim from a bearer token', () => {
    expect(userIdFromAuthHeader(reqWith({ Authorization: `Bearer ${jwt({ sub: 'user-abc' })}` }))).toBe('user-abc')
  })

  it('returns undefined for a missing header, a non-bearer value, or a garbage token', () => {
    expect(userIdFromAuthHeader(reqWith({}))).toBeUndefined()
    expect(userIdFromAuthHeader(reqWith({ Authorization: 'Basic abc' }))).toBeUndefined()
    expect(userIdFromAuthHeader(reqWith({ Authorization: 'Bearer not.a.jwt' }))).toBeUndefined()
    expect(userIdFromAuthHeader(reqWith({ Authorization: `Bearer ${jwt({ role: 'anon' })}` }))).toBeUndefined()
  })
})

describe('toErrorResponse', () => {
  it('maps an HttpError to its declared status', async () => {
    const res = await toErrorResponse(new HttpError('nope', 403), { req: reqWith({}), fnName: 'f' })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'nope' })
  })

  it('maps anything else to a generic 500 without leaking the message', async () => {
    const res = await toErrorResponse(new Error('SELECT * FROM secrets'), { req: reqWith({}), fnName: 'f' })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Error interno del servidor' })
  })

  it('does not throw when Sentry capture is a no-op', async () => {
    await expect(
      toErrorResponse('plain string failure', { req: reqWith({}), fnName: 'f' }),
    ).resolves.toBeInstanceOf(Response)
  })
})
