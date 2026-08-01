// Shared HTTP error/response helpers for every Edge Function.
// CLAUDE.md §10 Errors convention: public methods fail fast. HttpError is
// thrown by auth/validation code and caught once at each function's
// top-level handler via toErrorResponse() — see api-contracts.md §0 for the
// { error: string } response shape this produces.
import { getCorsHeaders } from './cors.ts'
import { logger } from './logger.ts'

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
 * Converts a thrown error into its HTTP response. Call this once, from each
 * function's top-level catch block. An HttpError maps to its declared
 * status; anything else is an unexpected 500 (logged, never leaked verbatim
 * to the caller).
 */
export function toErrorResponse(err: unknown, options: { req: Request, fnName: string }): Response {
  if (err instanceof HttpError) {
    return errorResponse(err.message, { req: options.req, status: err.status })
  }
  logger.error('Unexpected error', { fn: options.fnName, error: err instanceof Error ? err.message : String(err) })
  return errorResponse('Error interno del servidor', { req: options.req, status: 500 })
}
