import type { SendWeeklyPushRemindersResponse } from '../../../api/schemas/api-contracts.types.ts'

export type { SendWeeklyPushRemindersResponse }

/** One row from the `get_push_subscriptions_without_current_plan` RPC. */
export interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}
