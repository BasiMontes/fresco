// FRESCO-910 (audit C-06, GDPR art. 17): the record that an account was erased.
//
// `delete-account` writes it AFTER the auth user is gone, because the cascade erases every
// row that could say so. It holds the SHA-256 of the user id, not the id (see the
// `account_erasures` migration); the one exception is an id whose PostHog deletion failed,
// kept so that deletion can be retried.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PostHogErasure } from './posthog-erasure.ts'

export interface AccountErasureOutcome {
  userId: string
  stripe: 'none' | 'cancelled'
  posthog: PostHogErasure | 'failed'
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Throws on a write error; the caller logs it and still answers the deletion as done. */
export async function recordAccountErasure(client: SupabaseClient, outcome: AccountErasureOutcome): Promise<void> {
  const { error } = await client.from('account_erasures').insert({
    user_hash: await sha256Hex(outcome.userId),
    stripe: outcome.stripe,
    posthog: outcome.posthog,
    pending_posthog_distinct_id: outcome.posthog === 'failed' ? outcome.userId : null,
  })
  if (error) throw error
}
