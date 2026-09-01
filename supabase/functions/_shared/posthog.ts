// FRESCO-372 (A4-H15): server-side PostHog capture for Deno Edge Functions.
// No `posthog-node` here — that package targets Node, not Deno, and pulling
// a full SDK for one `fetch` call is not worth it. Direct HTTP against
// PostHog's capture endpoint, same shape `lib/posthog/server.ts` gets from
// `posthog-node` under the hood.
//
// `POSTHOG_API_KEY` is the project's public write key (ADR-0013: not a
// secret to protect, just unavailable inside this runtime without being set
// as a Function secret) — same value as `NEXT_PUBLIC_POSTHOG_KEY`.
// `POSTHOG_HOST` mirrors `NEXT_PUBLIC_POSTHOG_HOST` (e.g.
// `https://eu.posthog.com`).
//
// Utility convention (CLAUDE.md §10): silent-fail. An analytics outage must
// never fail or slow down an actual push send — every call site awaits this
// but the promise itself never rejects.

import { logger } from './logger.ts'

export interface CaptureServerEventArgs {
  distinctId: string
  event: string
  properties?: Record<string, unknown>
}

export async function captureServerEvent({ distinctId, event, properties }: CaptureServerEventArgs): Promise<void> {
  const apiKey = Deno.env.get('POSTHOG_API_KEY')
  const host = Deno.env.get('POSTHOG_HOST')
  if (!apiKey || !host) {
    // Missing config is not an error worth logging on every send — this
    // Edge Function's real job (sending the push) still succeeded.
    return
  }

  try {
    const res = await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties,
      }),
    })
    if (!res.ok) {
      logger.warn('PostHog capture returned a non-2xx status', {
        fn: 'captureServerEvent',
        event,
        status: res.status,
      })
    }
  } catch (error) {
    logger.warn('PostHog capture request failed', {
      fn: 'captureServerEvent',
      event,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
