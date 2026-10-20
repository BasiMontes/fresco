import { appendFileSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

/**
 * FRESCO-1033: grant Pro without a charge to a pilot participant, or take it back.
 *
 *   bunx varlock run -- bun scripts/grant-pro.ts grant <email> --until 2026-11-30 [--yes]
 *   bunx varlock run -- bun scripts/grant-pro.ts revoke <email> [--yes]
 *
 * Dry run unless `--yes`. Entitlement is `plan = 'pro'` plus a `plan_expires_at` that has not passed
 * (supabase/functions/generate-meal-plan/entitlement.ts), so the grant stops counting by itself on the
 * end date. The Stripe reconcile cron only visits profiles with a `stripe_subscription_id`, so a grant
 * on a profile without one is left alone; a profile that has one is refused here, because the cron
 * would overwrite the grant on its next pass. The write uses the service role, which the
 * `protect_subscription_columns` trigger allows. The email is looked up and never printed.
 */

export const MAX_GRANT_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface GrantableProfile {
  plan: string
  plan_expires_at: string | null
  stripe_subscription_id: string | null
}

export type Plan = { ok: true, set: { plan: 'pro' | 'free', plan_expires_at: string | null } } | { ok: false, reason: string };

/** End of the given day, UTC, so "until 2026-11-30" keeps Pro through that whole day. */
export function endOfDayUtc(until: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return null;
  }
  const iso = `${until}T23:59:59.000Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) || date.toISOString() !== iso ? null : iso;
}

export function planGrant(profile: GrantableProfile, until: string, now: number): Plan {
  const expires = endOfDayUtc(until);
  if (!expires) {
    return { ok: false, reason: 'The end date must be a real date written YYYY-MM-DD.' };
  }
  if (Date.parse(expires) <= now) {
    return { ok: false, reason: 'The end date is already in the past.' };
  }
  if (Date.parse(expires) - now > MAX_GRANT_DAYS * DAY_MS) {
    return { ok: false, reason: `A grant lasts at most ${MAX_GRANT_DAYS} days.` };
  }
  if (profile.stripe_subscription_id) {
    return { ok: false, reason: 'This account has a Stripe subscription; the reconcile cron would overwrite a manual grant.' };
  }
  if (profile.plan === 'family') {
    return { ok: false, reason: 'This account is on the family plan.' };
  }
  return { ok: true, set: { plan: 'pro', plan_expires_at: expires } };
}

export function planRevoke(profile: GrantableProfile): Plan {
  if (profile.stripe_subscription_id) {
    return { ok: false, reason: 'This account has a Stripe subscription; cancel it in Stripe, not here.' };
  }
  if (profile.plan !== 'pro') {
    return { ok: false, reason: 'This account is not on Pro; nothing to remove.' };
  }
  return { ok: true, set: { plan: 'free', plan_expires_at: null } };
}

export interface Command {
  action: 'grant' | 'revoke'
  email: string
  until: string | null
  yes: boolean
}

export function parseArgs(argv: string[]): Command | string {
  const [action, email, ...rest] = argv;
  if ((action !== 'grant' && action !== 'revoke') || !email || email.startsWith('--')) {
    return 'Usage: grant <email> --until YYYY-MM-DD [--yes] | revoke <email> [--yes]';
  }
  const untilIndex = rest.indexOf('--until');
  const until = untilIndex >= 0 ? rest[untilIndex + 1] ?? null : null;
  if (action === 'grant' && !until) {
    return 'grant needs --until YYYY-MM-DD.';
  }
  return { action, email: email.toLowerCase(), until, yes: rest.includes('--yes') };
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (typeof parsed === 'string') {
    console.error(parsed);
    return 2;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (run through varlock).');
    return 2;
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let userId: string | null = null;
  for (let page = 1; !userId; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error(`Could not list users: ${error.message}`);
      return 1;
    }
    userId = data.users.find(u => !u.is_anonymous && u.email?.toLowerCase() === parsed.email)?.id ?? null;
    if (data.users.length < 200) {
      break;
    }
  }
  if (!userId) {
    console.error('No registered, non-anonymous account has that email.');
    return 1;
  }

  const { data: profile, error: readError } = await supabase
    .from('user_profiles')
    .select('plan, plan_expires_at, stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle();
  if (readError || !profile) {
    console.error('The account has no profile row.');
    return 1;
  }

  const plan = parsed.action === 'grant' ? planGrant(profile, parsed.until ?? '', Date.now()) : planRevoke(profile);
  if (!plan.ok) {
    console.error(`Refused: ${plan.reason}`);
    return 1;
  }

  const shortId = userId.slice(0, 8);
  console.log(`${parsed.action} on account ${shortId}: plan ${profile.plan} -> ${plan.set.plan}, expires ${profile.plan_expires_at ?? 'never'} -> ${plan.set.plan_expires_at ?? 'none'}`);
  if (!parsed.yes) {
    console.log('Dry run. Pass --yes to write.');
    return 0;
  }

  const { error: writeError } = await supabase.from('user_profiles').update(plan.set).eq('id', userId);
  if (writeError) {
    console.error(`Write failed: ${writeError.message}`);
    return 1;
  }
  const { data: after } = await supabase.from('user_profiles').select('plan, plan_expires_at').eq('id', userId).single();
  if (after?.plan !== plan.set.plan) {
    console.error('Write reported success but the profile reads back different.');
    return 1;
  }

  mkdirSync('.session', { recursive: true });
  appendFileSync('.session/pilot-grants.jsonl', `${JSON.stringify({
    at: new Date().toISOString(),
    by: process.env.USER ?? 'unknown',
    action: parsed.action,
    account: userId,
    until: plan.set.plan_expires_at,
  })}\n`);
  console.log('Done and read back. Recorded in .session/pilot-grants.jsonl.');
  return 0;
}

if (import.meta.main) {
  process.exit(await main());
}
