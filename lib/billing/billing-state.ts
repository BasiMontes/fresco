import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type UserProfileRow = Database['public']['Tables']['user_profiles']['Row'];

/** What the signed-in user's profile says about their Stripe subscription. */
export type BillingState = Pick<UserProfileRow, 'plan' | 'stripe_customer_id' | 'stripe_subscription_id'>;

/**
 * The CURRENTLY signed-in user's billing columns, or `null` when no profile
 * row exists yet. Read through the caller's own RLS-scoped client by the three
 * Stripe routes that need it (`checkout`, `portal`, `pro-price`), which used to
 * each run their own query for a different subset of these columns.
 * Throws on a read error; each route maps that to its own 500 message.
 */
export async function getBillingState(client: SupabaseClient<Database>, userId: string): Promise<BillingState | null> {
  const { data, error } = await client
    .from('user_profiles')
    .select('plan, stripe_customer_id, stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
