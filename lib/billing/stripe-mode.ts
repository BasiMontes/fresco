import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Client = SupabaseClient<Database>;

/**
 * FRESCO-1001 (audit 7b: A7-PAY-01, ADR-0061): the Stripe MODE guard.
 *
 * Every environment (`fresco-dev`, `fresco-pre`, `fresco-pro`) shares one Supabase project,
 * and each deploy verifies its own webhook secret. Once production uses live keys, `fresco-pre`
 * (test keys, public) would still write the shared `user_profiles` row, so a test card there
 * would make a production account Pro. A check that only compares the event with THIS deploy's
 * key passes on `fresco-pre` (a test deploy receiving a test event), so there are two layers:
 *
 *   1. environment: the event's `livemode` equals the mode of this deploy's `STRIPE_SECRET_KEY`.
 *      Catches a deploy configured with the wrong key: Stripe keeps retrying, so a real payment
 *      is not lost once the key is fixed.
 *   2. database: the event's `livemode` equals `billing_mode.stripe_livemode`, the mode the
 *      shared database serves (test until the owner flips it once at go-live). This is the layer
 *      that stops `fresco-pre`.
 *
 * Pure verdicts live here; the webhook and the grant decide what a refusal means.
 */

export type StripeModeLayer = 'environment' | 'database';

export type ModeVerdict
  = | { ok: true }
    | { ok: false, layer: StripeModeLayer, eventLivemode: boolean, expectedLivemode: boolean };

const LIVE_KEY_PREFIXES = ['sk_live_', 'rk_live_'];
const TEST_KEY_PREFIXES = ['sk_test_', 'rk_test_'];

/**
 * The Stripe mode of this deploy, read from the prefix of its secret key. Throws on a missing
 * or unrecognised key: guessing a mode would defeat the guard.
 */
export function environmentLivemode(key: string | undefined = process.env.STRIPE_SECRET_KEY): boolean {
  if (key && LIVE_KEY_PREFIXES.some(prefix => key.startsWith(prefix))) {
    return true;
  }
  if (key && TEST_KEY_PREFIXES.some(prefix => key.startsWith(prefix))) {
    return false;
  }
  throw new Error('STRIPE_SECRET_KEY is missing or does not start with sk_live_ / sk_test_ (rk_ for restricted keys): the Stripe mode of this deploy is unknown.');
}

/**
 * The mode the shared database serves. Throws when the row is missing or unreadable: the guard
 * fails closed, never to a default. `billing_mode` is closed to every client role, so this takes
 * the service-role client.
 */
export async function readDatabaseLivemode(client: Client): Promise<boolean> {
  const { data, error } = await client.from('billing_mode').select('stripe_livemode').maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('billing_mode has no row: the Stripe mode of the database is unknown.');
  }

  return data.stripe_livemode;
}

/** Pure: does an event of this mode belong to this deploy and to this database? */
export function judgeEventMode({ eventLivemode, environmentLivemode: environment, databaseLivemode }: {
  eventLivemode: boolean
  environmentLivemode: boolean
  databaseLivemode: boolean
}): ModeVerdict {
  if (eventLivemode !== environment) {
    return { ok: false, layer: 'environment', eventLivemode, expectedLivemode: environment };
  }
  if (eventLivemode !== databaseLivemode) {
    return { ok: false, layer: 'database', eventLivemode, expectedLivemode: databaseLivemode };
  }
  return { ok: true };
}

/**
 * Reads this deploy's mode and the database's and judges an event of `eventLivemode`. Anything
 * other than an explicit boolean on the event is refused as a mismatch with both layers.
 */
export async function judgeStripeEventMode(client: Client, eventLivemode: unknown): Promise<ModeVerdict> {
  const environment = environmentLivemode();
  const databaseLivemode = await readDatabaseLivemode(client);

  if (typeof eventLivemode !== 'boolean') {
    return { ok: false, layer: 'environment', eventLivemode: false, expectedLivemode: environment };
  }

  return judgeEventMode({ eventLivemode, environmentLivemode: environment, databaseLivemode });
}

export function describeModeVerdict(verdict: Extract<ModeVerdict, { ok: false }>): string {
  const mode = (livemode: boolean) => (livemode ? 'live' : 'test');
  return `a ${mode(verdict.eventLivemode)}-mode Stripe event does not belong to this ${verdict.layer} (${mode(verdict.expectedLivemode)} mode)`;
}
