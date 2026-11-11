// FRESCO-1164 (review finding PAY-N3, ADR-0061): the Stripe MODE guard of the Edge Functions.
//
// The Vercel app refuses a Stripe event whose mode is not the mode of its key and of the shared
// database (`lib/billing/stripe-mode.ts`). The Edge Functions had no such check: once billing is
// live, a `STRIPE_SECRET_KEY` secret that still holds the TEST key answers `resource_missing` for
// every real customer, `delete-account` reads that as "nothing to cancel", the account is erased
// and the real subscription keeps charging someone who no longer has an account.
//
// So a function that is about to act on a customer through Stripe first compares the mode of its
// key (by prefix) with `billing_mode.stripe_livemode`, and refuses when they differ or when either
// cannot be established. It fails closed: guessing a mode would defeat the guard.

import type { SupabaseClient } from '@supabase/supabase-js'
import { StripeNotConfiguredError } from './stripe-billing.ts'

const LIVE_KEY_PREFIXES = ['sk_live_', 'rk_live_']
const TEST_KEY_PREFIXES = ['sk_test_', 'rk_test_']

/** The key's Stripe mode and the database's differ, or one of them is unknown. */
export class StripeModeMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StripeModeMismatchError'
  }
}

const modeName = (livemode: boolean): string => (livemode ? 'live' : 'test')

/** The Stripe mode of a secret key, from its prefix. Throws on an unrecognised key. */
export function stripeKeyLivemode(key: string): boolean {
  if (LIVE_KEY_PREFIXES.some(prefix => key.startsWith(prefix))) return true
  if (TEST_KEY_PREFIXES.some(prefix => key.startsWith(prefix))) return false
  throw new StripeModeMismatchError('STRIPE_SECRET_KEY does not start with sk_live_ / sk_test_ (rk_ for restricted keys): its Stripe mode is unknown.')
}

/**
 * Throws `StripeNotConfiguredError` when there is no key (the caller decides whether it can go on
 * without Stripe), `StripeModeMismatchError` when the key's mode differs from `billing_mode` or the
 * key is unrecognisable, and the Supabase error when `billing_mode` cannot be read. Takes the
 * service-role client: `billing_mode` is closed to every client role.
 */
export async function assertStripeKeyMatchesBillingMode(client: SupabaseClient): Promise<void> {
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) throw new StripeNotConfiguredError()
  const keyLivemode = stripeKeyLivemode(key)

  const { data, error } = await client.from('billing_mode').select('stripe_livemode').maybeSingle<{ stripe_livemode: boolean }>()
  if (error) throw error
  if (!data) throw new StripeModeMismatchError('billing_mode has no row: the Stripe mode of the database is unknown.')

  if (data.stripe_livemode !== keyLivemode) {
    throw new StripeModeMismatchError(`STRIPE_SECRET_KEY is a ${modeName(keyLivemode)}-mode key but billing_mode serves ${modeName(data.stripe_livemode)} mode.`)
  }
}
