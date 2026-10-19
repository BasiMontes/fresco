// Shared HTTP error/response helpers for every Edge Function.
// CLAUDE.md §10 Errors convention: public methods fail fast. HttpError is
// thrown by auth/validation code and caught once at each function's
// top-level handler via toErrorResponse() — see api-contracts.md §0 for the
// { error: string } response shape this produces.
import { getCorsHeaders } from './cors.ts'
import { logger } from './logger.ts'
import { captureEdgeException } from './sentry.ts'

export interface ErrorBody {
  error: string
}

export class HttpError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export function errorResponse(message: string, options: { req: Request, status: number }): Response {
  const body: ErrorBody = { error: message }
  return new Response(JSON.stringify(body), {
    status: options.status,
    headers: { ...getCorsHeaders(options.req), 'Content-Type': 'application/json' },
  })
}

export function jsonResponse<T>(data: T, options: { req: Request, status?: number }): Response {
  return new Response(JSON.stringify(data), {
    status: options.status ?? 200,
    headers: { ...getCorsHeaders(options.req), 'Content-Type': 'application/json' },
  })
}

type BodyFieldKind = 'string' | 'boolean' | 'number'

// A lookup, not `typeof value !== kind`: deno lint (valid-typeof) only accepts a literal there.
const BODY_FIELD_CHECKS: Record<BodyFieldKind, (value: unknown) => boolean> = {
  string: value => typeof value === 'string',
  boolean: value => typeof value === 'boolean',
  number: value => typeof value === 'number',
}

/**
 * Parses the request body as a JSON object and fails with a 400, never a 500
 * (A7-API-05, FRESCO-1017). A bare `req.json()` throws a `SyntaxError` on `{not json`,
 * which `toErrorResponse` would report as a server failure and page Sentry.
 *
 * Rejects a body that is not valid JSON or is not a plain object (`null`, `[]`, `"x"`).
 * `fields` names the keys whose TYPE is checked when present: `null`/absent is left to the
 * caller's own "missing field" check, a value of the wrong type (for example
 * `{"meal_plan_id":{}}`) is a 400 here instead of reaching a query.
 */
export async function readJsonBody<T>(req: Request, fields: Record<string, BodyFieldKind> = {}): Promise<T> {
  let parsed: unknown
  try {
    parsed = await req.json()
  } catch {
    throw new HttpError('El cuerpo de la petición no es JSON válido', 400)
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new HttpError('El cuerpo de la petición debe ser un objeto JSON', 400)
  }
  const body = parsed as Record<string, unknown>
  for (const [key, kind] of Object.entries(fields)) {
    const value = body[key]
    if (value === undefined || value === null) continue
    if (!BODY_FIELD_CHECKS[kind](value)) {
      throw new HttpError(`El campo ${key} debe ser de tipo ${kind}`, 400)
    }
  }
  return parsed as T
}

/**
 * Best-effort `auth.uid()` for error tagging: the `sub` claim of the bearer
 * JWT, decoded WITHOUT verification (the value is only ever used as a Sentry
 * tag, never for authorization). Returns undefined for a missing/malformed
 * token.
 */
export function userIdFromAuthHeader(req: Request): string | undefined {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) {
    return undefined
  }
  try {
    const payload = token.split('.')[1]
    if (!payload) {
      return undefined
    }
    let b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    b64 += '='.repeat((4 - (b64.length % 4)) % 4)
    const sub = (JSON.parse(atob(b64)) as { sub?: unknown }).sub
    return typeof sub === 'string' ? sub : undefined
  } catch {
    return undefined
  }
}

/**
 * Converts a thrown error into its HTTP response. Call this once, from each
 * function's top-level catch block. An HttpError maps to its declared
 * status; anything else is an unexpected 500 — logged, reported to Sentry
 * (FRESCO-385), and never leaked verbatim to the caller.
 */
export async function toErrorResponse(err: unknown, options: { req: Request, fnName: string }): Promise<Response> {
  if (err instanceof HttpError) {
    return errorResponse(err.message, { req: options.req, status: err.status })
  }

  const errorId = crypto.randomUUID()
  logger.error('Unexpected error', {
    fn: options.fnName,
    error: err instanceof Error ? err.message : String(err),
    error_id: errorId,
  })
  await captureEdgeException(err, {
    fn: options.fnName,
    errorId,
    userId: userIdFromAuthHeader(options.req),
    url: options.req.url,
    method: options.req.method,
  })

  return errorResponse('Error interno del servidor', { req: options.req, status: 500 })
}
