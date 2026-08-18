import type { Database } from './types';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { clientEnv } from '@/lib/env';

// Service-role Supabase client — bypasses RLS via `SUPABASE_SERVICE_ROLE_KEY`.
// NEVER import this from a Client Component or any code path reachable by the
// browser. It exists for exactly one caller today:
// `app/api/stripe/webhook/route.ts` (STORY-FRESCO-228) — a Stripe webhook has
// no authenticated Supabase session to scope an RLS-bound client to, but it
// still needs to write `plan`/`stripe_customer_id`/`stripe_subscription_id`/
// `plan_expires_at` onto an arbitrary user's `user_profiles` row (ADR-0007:
// the webhook is the only writer of subscription state). Every other
// server-side read/write in this app goes through the cookie-based,
// RLS-scoped client in `lib/supabase/server.ts` instead.

function requireServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required — copy .env.example to .env and fill it in');
  }

  return key;
}

/** Service-role Supabase client factory. No cookies, no user session — RLS-bypassing by design. */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    requireServiceRoleKey(),
  );
}
