// FRESCO-1183 (integral review E2+B3): one place for a scheduled Edge job to say "this pass did not do its work".
//
// `logger.error` only reaches the Supabase log drains, so a pass in which sends or deletions failed
// raised no alert (a 403 from mismatched VAPID keys was logged per subscription and kept failing every
// week). This also sends an aggregated event to Sentry. Like `captureEdgeException`, it is silent-fail:
// a reporting outage must never fail the job it describes.

import { logger } from './logger.ts'
import { captureEdgeException } from './sentry.ts'

export async function reportJobFailure(fn: string, message: string, details: Record<string, unknown> = {}): Promise<void> {
  const errorId = crypto.randomUUID()
  logger.error(message, { fn, error_id: errorId, ...details })
  await captureEdgeException(new Error(`${message} ${JSON.stringify(details)}`), { fn, errorId })
}
