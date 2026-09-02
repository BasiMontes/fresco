// FRESCO-385 (A4-M9): Sentry sink for UNEXPECTED Edge Function errors.
//
// The Next.js app already reports to Sentry via `@sentry/nextjs`
// (sentry.server.config.ts / sentry.edge.config.ts). The Supabase Edge
// Functions run on Deno, a separate runtime with no Sentry wiring — an
// uncaught throw there only reached `console.error` / the Supabase log
// drains, so a production failure raised no alert.
//
// No `@sentry/deno` SDK here — same call as `_shared/posthog.ts`: one direct
// `fetch` to Sentry's envelope endpoint. Utility convention (CLAUDE.md §10):
// silent-fail — a reporting outage must never fail or slow a request beyond
// the already-degraded 500 path that calls it.
//
// Activation is opt-in per environment: `captureEdgeException` no-ops unless
// `SENTRY_DSN` is set as a Function secret AND `SUPABASE_URL` is a hosted
// project. The local stack (incl. CI, per `_shared/cors.ts`) is always
// `http://kong:8000`, so CI can never contaminate the production Sentry
// regardless of FRESCO-376 (H7) — the guard here does not depend on it.

import { isHostedSupabase } from './cors.ts'
import { logger } from './logger.ts'

export interface SentryContext {
  /** The Edge Function name (`FN_NAME` in each handler). */
  fn: string
  /** Correlates with the `error_id` field in the matching `logger.error` line. */
  errorId: string
  /** The caller's `auth.uid()`, when a JWT was present. */
  userId?: string
  url?: string
  method?: string
}

interface ParsedDsn {
  endpoint: string
  publicKey: string
}

/** Parses `https://<publicKey>@<host>/<projectId>` into the envelope endpoint + key. Returns null for anything malformed. */
export function parseSentryDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn)
    const projectId = url.pathname.replace(/^\/+/, '')
    if (!url.username || !projectId) {
      return null
    }
    return {
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      publicKey: url.username,
    }
  } catch {
    return null
  }
}

/**
 * Builds the HTTP request pieces for one Sentry `event` envelope (Sentry
 * protocol v7). Pure — no `Deno`, no `fetch` — so it is unit-testable.
 */
export function buildSentryEnvelope(
  dsn: string,
  error: unknown,
  context: SentryContext,
  environment: string,
): { url: string, headers: Record<string, string>, body: string } | null {
  const parsed = parseSentryDsn(dsn)
  if (!parsed) {
    return null
  }

  const eventId = crypto.randomUUID().replace(/-/g, '')
  const now = new Date().toISOString()
  const isError = error instanceof Error

  const event: Record<string, unknown> = {
    event_id: eventId,
    timestamp: now,
    platform: 'other',
    level: 'error',
    logger: 'edge-function',
    environment,
    server_name: context.fn,
    transaction: context.fn,
    exception: {
      values: [{
        type: isError ? error.name : 'Error',
        value: isError ? error.message : String(error),
      }],
    },
    tags: { fn: context.fn, error_id: context.errorId },
    extra: { stack: isError ? error.stack : undefined },
  }
  if (context.userId) {
    event.user = { id: context.userId }
  }
  if (context.url) {
    event.request = { url: context.url, method: context.method }
  }

  const body = [
    JSON.stringify({ event_id: eventId, sent_at: now }),
    JSON.stringify({ type: 'event', content_type: 'application/json' }),
    JSON.stringify(event),
  ].join('\n')

  return {
    url: parsed.endpoint,
    headers: {
      'Content-Type': 'application/x-sentry-envelope',
      'X-Sentry-Auth': `Sentry sentry_version=7,sentry_client=fresco-edge/1.0,sentry_key=${parsed.publicKey}`,
    },
    body,
  }
}

function resolveEnv(): string {
  const fromDeno = typeof Deno !== 'undefined'
    ? (Deno.env.get('SENTRY_ENVIRONMENT') ?? Deno.env.get('SB_EXECUTION_ENV'))
    : undefined
  return fromDeno ?? 'production'
}

/**
 * Reports an unexpected Edge Function error to Sentry. No-ops (and never
 * throws) when Sentry is not configured for this environment.
 */
export async function captureEdgeException(error: unknown, context: SentryContext): Promise<void> {
  if (typeof Deno === 'undefined') {
    return
  }
  const dsn = Deno.env.get('SENTRY_DSN')
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  if (!dsn || !isHostedSupabase(supabaseUrl)) {
    return
  }

  const envelope = buildSentryEnvelope(dsn, error, context, resolveEnv())
  if (!envelope) {
    logger.warn('SENTRY_DSN is set but malformed — skipping capture', { fn: 'captureEdgeException' })
    return
  }

  try {
    const res = await fetch(envelope.url, {
      method: 'POST',
      headers: envelope.headers,
      body: envelope.body,
    })
    if (!res.ok) {
      logger.warn('Sentry envelope returned a non-2xx status', {
        fn: 'captureEdgeException',
        status: res.status,
        error_id: context.errorId,
      })
    }
  } catch (sendError) {
    logger.warn('Sentry envelope request failed', {
      fn: 'captureEdgeException',
      error_id: context.errorId,
      error: sendError instanceof Error ? sendError.message : String(sendError),
    })
  }
}
