// FRESCO-241 PR3: weekly web-push re-engagement send. Closes out the loop
// PR1 (push_subscriptions table) and PR2 (client subscribe/unsubscribe +
// service worker) built.
//
// Triggered exclusively by pg_cron -> pg_net (ADR-0011, see the
// `schedule_weekly_push_reminders` migration) — never by a browser, so
// there is no CORS surface and no per-user JWT to verify. Authorization
// instead proves the caller IS that cron job specifically: see
// `requireServiceRoleCaller` in `_shared/auth.ts`.
//
// Sends one Web Push notification per subscription (ADR-0012: `web-push`
// npm package via Deno's `npm:` specifier — VAPID JWT signing + `aes128gcm`
// payload encryption) to every `push_subscriptions` row belonging to a user
// with no `meal_plans` row for the current ISO week (AC2/AC4, TECHDEBT-
// FRESCO-241). AC5: a 404/410 from the push service means the endpoint is
// dead — deleted in this same run. Any other failure (5xx, timeout, ...) is
// logged and skipped — not evidence the subscription itself is bad, and one
// bad send must never abort the rest of the batch.

import webpush from 'npm:web-push@3'
import { HttpError, jsonResponse, toErrorResponse } from '../_shared/http.ts'
import { requireServiceRoleCaller } from '../_shared/auth.ts'
import { createServiceRoleClient } from '../_shared/service-role-client.ts'
import { logger } from '../_shared/logger.ts'
import { captureServerEvent } from '../_shared/posthog.ts'
import { getCurrentIsoWeek } from './iso-week.ts'
import type { PushSubscriptionRow, SendWeeklyPushRemindersResponse } from './types.ts'

const FN_NAME = 'send-weekly-reengagement-push'

// Copy per the ticket's own framing ("te avisamos si se te pasó planificar
// el domingo") — matches `public/sw.js`'s payload contract
// (`{ title, body, url }`) exactly; `url` lands on `/menu`, the same
// default `sw.js` itself falls back to for a malformed/empty push.
// FRESCO-372 (A4-H15): body was rioplatense ("armaste" + the vos imperative
// "hacelo") — rewritten to español de España, matching the title's own
// "planificaste".
const RE_ENGAGEMENT_TITLE = '¿Ya planificaste esta semana?'
const RE_ENGAGEMENT_BODY = 'Todavía no has planificado tu menú semanal — hazlo en un par de minutos.'
const RE_ENGAGEMENT_URL = '/menu'

Deno.serve(async (req: Request) => {
  try {
    // 1. Caller identity — this function sends real notifications to real
    // users and must never be triggerable by anyone but the pg_cron job.
    requireServiceRoleCaller(req)

    // 2. VAPID setup from Edge Function secrets (ADR-0012) — never the
    // general `.env`, which isn't available inside this runtime. Missing
    // secrets fail loudly here rather than sending unsigned/broken pushes.
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT')
    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      throw new HttpError(
        'Faltan las secrets VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT',
        500
      )
    }
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    // 3. Business query (AC2/AC4): every push_subscriptions row for a user
    // with no meal_plans row for the current ISO week. Cross-user by
    // design — lives in a service_role-only RPC
    // (get_push_subscriptions_without_current_plan), same least-privilege
    // pattern as reassign_guest_data (ADR-0004): EXECUTE revoked from
    // every ordinary role, granted only to service_role.
    const semanaIso = getCurrentIsoWeek()
    const serviceClient = createServiceRoleClient()
    const { data: subscriptions, error: queryError } = await serviceClient
      .rpc('get_push_subscriptions_without_current_plan', { p_semana_iso: semanaIso })
      .returns<PushSubscriptionRow[]>()

    if (queryError) {
      logger.error('Failed to query push_subscriptions without a current-week plan', {
        fn: FN_NAME,
        error: queryError.message,
      })
      throw new HttpError('Error consultando las suscripciones a notificar', 500)
    }

    const targets = subscriptions ?? []
    const usersTargeted = new Set(targets.map(sub => sub.user_id)).size

    // 4. Send, per subscription. One bad subscription must never abort the
    // rest of the batch — each send is independently caught (idempotency
    // note: this trusts pg_cron to run the job once a week, per Step 6's
    // "confianza en el scheduler" option — no per-week "already sent"
    // dedup record; a rare cron double-fire in the same week would just
    // mean an extra notification, not a correctness bug).
    let notificationsSent = 0
    let staleSubscriptionsRemoved = 0

    for (const sub of targets) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: RE_ENGAGEMENT_TITLE, body: RE_ENGAGEMENT_BODY, url: RE_ENGAGEMENT_URL })
        )
        notificationsSent++

        // FRESCO-372 (A4-H15): fire-and-forget, never blocks/fails the send
        // loop (captureServerEvent silent-fails on its own — see
        // _shared/posthog.ts). `'push_sent'` is a literal, not an import from
        // `lib/posthog/event-names.ts` — this Deno runtime can't reach the
        // Next.js app's module tree. Keep it in sync with
        // `POSTHOG_EVENTS.PUSH_SENT` by hand.
        await captureServerEvent({
          distinctId: sub.user_id,
          event: 'push_sent',
          properties: { semana_iso: semanaIso },
        })

        const { error: touchError } = await serviceClient
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id)
        if (touchError) {
          logger.warn('Failed to bump last_used_at after a successful send', {
            fn: FN_NAME,
            subscriptionId: sub.id,
            error: touchError.message,
          })
        }
      }
      catch (err) {
        const statusCode = err && typeof err === 'object' && 'statusCode' in err
          ? (err as { statusCode?: number }).statusCode
          : undefined

        if (statusCode === 404 || statusCode === 410) {
          // AC5: stale/expired endpoint — delete now, in this same run,
          // rather than retrying against a dead endpoint indefinitely.
          const { error: deleteError } = await serviceClient
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id)
          if (deleteError) {
            logger.error('Failed to delete a stale push_subscriptions row', {
              fn: FN_NAME,
              subscriptionId: sub.id,
              error: deleteError.message,
            })
          }
          else {
            staleSubscriptionsRemoved++
          }
        }
        else {
          // Transient push-service failure (5xx, network timeout, ...) —
          // not evidence the subscription itself is dead, so it stays.
          logger.error('Push send failed for one subscription', {
            fn: FN_NAME,
            subscriptionId: sub.id,
            statusCode,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    const response: SendWeeklyPushRemindersResponse = {
      semana_iso: semanaIso,
      users_targeted: usersTargeted,
      notifications_sent: notificationsSent,
      stale_subscriptions_removed: staleSubscriptionsRemoved,
    }
    return jsonResponse(response, { req })
  }
  catch (err) {
    return toErrorResponse(err, { req, fnName: FN_NAME })
  }
})
