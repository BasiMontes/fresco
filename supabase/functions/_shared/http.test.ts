import { describe, expect, it } from 'bun:test'
import { HttpError, readJsonBody, toErrorResponse, userIdFromAuthHeader } from './http.ts'

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

// FRESCO-1178 — a deliberate 5xx (the menu could not be saved, a secret is missing) reaches Sentry, a 4xx does not.
describe('toErrorResponse and Sentry (FRESCO-1178)', () => {
  type Capture = NonNullable<Parameters<typeof toErrorResponse>[1]['capture']>
  const recorder = () => {
    const calls: Parameters<Capture>[] = []
    const capture: Capture = (error, context) => {
      calls.push([error, context])
      return Promise.resolve()
    }
    return { calls, capture }
  }

  it('reports an HttpError 500 to Sentry, tagged with the function, and still answers with its status', async () => {
    const { calls, capture } = recorder()
    const error = new HttpError('No se pudo guardar el menú', 500)
    const res = await toErrorResponse(error, {
      req: reqWith({ Authorization: `Bearer ${jwt({ sub: 'user-1' })}` }),
      fnName: 'generate-meal-plan',
      capture,
    })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'No se pudo guardar el menú' })
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe(error)
    expect(calls[0][1]).toMatchObject({ fn: 'generate-meal-plan', userId: 'user-1', method: 'POST' })
    expect(calls[0][1].errorId).toBeTruthy()
  })

  it('reports any status from 500 up (a 503 too)', async () => {
    const { calls, capture } = recorder()
    await toErrorResponse(new HttpError('sin servicio', 503), { req: reqWith({}), fnName: 'f', capture })
    expect(calls).toHaveLength(1)
  })

  it.each([400, 401, 403, 404, 409, 429])('does not report a %i: it is the caller\'s mistake', async (status) => {
    const { calls, capture } = recorder()
    const res = await toErrorResponse(new HttpError('no', status), { req: reqWith({}), fnName: 'f', capture })
    expect(res.status).toBe(status)
    expect(calls).toHaveLength(0)
  })

  it('still reports an unexpected error, once', async () => {
    const { calls, capture } = recorder()
    await toErrorResponse(new Error('boom'), { req: reqWith({}), fnName: 'f', capture })
    expect(calls).toHaveLength(1)
  })
})

function bodyReq(body: string): Request {
  return new Request('https://x.supabase.co/functions/v1/f', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

async function statusOf(promise: Promise<unknown>): Promise<number | undefined> {
  try {
    await promise
    return undefined
  } catch (err) {
    return err instanceof HttpError ? err.status : -1
  }
}

describe('readJsonBody (A7-API-05, FRESCO-1017)', () => {
  it('returns the parsed object', async () => {
    expect(await readJsonBody(bodyReq('{"meal_plan_id":"abc","refresh":true}'))).toEqual({ meal_plan_id: 'abc', refresh: true })
  })

  it('answers 400, not a 500, to a body that is not JSON', async () => {
    expect(await statusOf(readJsonBody(bodyReq('{not json')))).toBe(400)
    expect(await statusOf(readJsonBody(bodyReq('')))).toBe(400)
  })

  it('answers 400 to JSON that is not an object', async () => {
    for (const body of ['null', '[]', '"text"', '42', 'true']) {
      expect(await statusOf(readJsonBody(bodyReq(body)))).toBe(400)
    }
  })

  it('answers 400 to a named field of the wrong type', async () => {
    const fields = { meal_plan_id: 'string', refresh: 'boolean' } as const
    expect(await statusOf(readJsonBody(bodyReq('{"meal_plan_id":{}}'), fields))).toBe(400)
    expect(await statusOf(readJsonBody(bodyReq('{"meal_plan_id":5}'), fields))).toBe(400)
    expect(await statusOf(readJsonBody(bodyReq('{"meal_plan_id":"a","refresh":"yes"}'), fields))).toBe(400)
  })

  it('leaves absent and null fields to the caller, and ignores unnamed fields', async () => {
    const fields = { meal_plan_id: 'string', refresh: 'boolean' } as const
    expect(await readJsonBody(bodyReq('{}'), fields)).toEqual({})
    expect(await readJsonBody(bodyReq('{"meal_plan_id":null,"extra":[1]}'), fields)).toEqual({ meal_plan_id: null, extra: [1] })
  })

  it('does not pass through toErrorResponse as a 500: the error is an HttpError', async () => {
    const err = await readJsonBody(bodyReq('{not json')).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(HttpError)
    const res = await toErrorResponse(err, { req: reqWith({}), fnName: 'f' })
    expect(res.status).toBe(400)
  })
})
