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
