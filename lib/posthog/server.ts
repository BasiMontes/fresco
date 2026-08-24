/**
 * Server-side PostHog capture (`posthog-node`) — ADR-0013's payment-event
 * carve-out: `app/api/stripe/webhook/route.ts` has no browser, so
 * `posthog-js` structurally cannot fire `subscription_started` there, and a
 * server-side capture also survives ad-blockers on the one event this ticket
 * treats as business-critical.
 */

import { PostHog } from 'posthog-node';

export interface ServerCaptureParams {
  distinctId: string
  event: string
  properties?: Record<string, unknown>
}

let cachedClient: PostHog | undefined;

function getServerClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    return null;
  }
  // Same project API key as the client SDK — PostHog's ingestion key isn't a
  // secret, it's the public write key (ADR-0013's `.env.example` comment).
  cachedClient ??= new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    // A Vercel serverless invocation can end the instant the response is
    // returned, before posthog-node's default batched flush would run —
    // shipping every capture immediately is the documented posthog-node
    // pattern for serverless runtimes.
    flushAt: 1,
    flushInterval: 0,
  });
  return cachedClient;
}

/**
 * Utility, not a public API boundary (§10 Errors convention) — a capture
 * failure here must never surface as a payment-processing error. The Stripe
 * webhook handler already tolerates a thrown error from this call site (logs
 * + still returns 200), but this stays silent-fail on its own so an
 * analytics outage is never conflated with a real Supabase write failure in
 * the logs.
 */
export async function captureServerEvent({ distinctId, event, properties }: ServerCaptureParams): Promise<void> {
  const client = getServerClient();
  if (!client) {
    return;
  }
  try {
    client.capture({ distinctId, event, properties });
    await client.flush();
  }
  catch (error) {
    console.error('[lib/posthog/server] captureServerEvent failed', error);
  }
}
