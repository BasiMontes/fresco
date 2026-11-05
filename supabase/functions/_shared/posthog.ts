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

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger.ts'

export interface CaptureServerEventArgs {
  /** A service-role client that can read `user_profiles.analytics_consent`. */
  supabase: SupabaseClient
  distinctId: string
  event: string
  properties?: Record<string, unknown>
}

// FRESCO-919 (ADR-0044): the cookie-banner decision is stored in
// `user_profiles.analytics_consent`. Opt-in and fail closed: only an explicit
// `true` sends; a rejection, an unsynced profile, a missing row or a read error
// all suppress the event. Mirrors `lib/posthog/server.ts`.
/**
 * FRESCO-1124: the legal texts version the analytics decision must have been taken under. A COPY of
 * `LEGAL_TEXTS_VERSION` (`lib/legal/consent.ts`): this function deploys on its own and cannot import the app.
 * `lib/legal/analytics-consent-version.test.ts` fails when the two differ, so a version bump cannot forget this one.
 */
export const ANALYTICS_CONSENT_VERSION = 'provisional-2026-10-19'

async function hasAnalyticsConsent(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('analytics_consent, analytics_consent_version')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    logger.warn('Could not read analytics consent, suppressing the event', {
      fn: 'captureServerEvent',
      error: error.message,
    })
    return false
  }

  // FRESCO-1124: a stored `true` only counts for the texts version in force; an older one is stale.
  return data?.analytics_consent === true && data.analytics_consent_version === ANALYTICS_CONSENT_VERSION
}

export async function captureServerEvent({ supabase, distinctId, event, properties }: CaptureServerEventArgs): Promise<void> {
  const apiKey = Deno.env.get('POSTHOG_API_KEY')
  const host = Deno.env.get('POSTHOG_HOST')
  if (!apiKey || !host) {
    // Missing config is not an error worth logging on every send — this
    // Edge Function's real job (sending the push) still succeeded.
    return
  }

  try {
    if (!(await hasAnalyticsConsent(supabase, distinctId))) {
      return
    }

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
