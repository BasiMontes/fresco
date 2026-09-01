import type { PlanUsuario } from '@schemas';
import type { User } from '@supabase/supabase-js';

/**
 * FRESCO-366 / A4-B4: the person properties PostHog `$set`s on every
 * identify. `is_guest` + `plan` drive segmentation in every funnel and
 * retention report (guest vs. registered, Free vs. Pro) without a custom
 * cohort; `signup_method` records how the person first entered. The index
 * signature keeps this assignable to `posthog.identify`'s properties bag.
 */
export interface PersonProperties {
  is_guest: boolean
  plan: PlanUsuario
  signup_method?: string
  [key: string]: unknown
}

type IdentityInput = Pick<User, 'is_anonymous' | 'user_metadata'>;

/**
 * Pure derivation — no network. The caller resolves `plan` from
 * `user_profiles` (a guest never has a row, so `plan` is forced to `'free'`
 * for them regardless of what is passed). `signup_method` comes from
 * `user_metadata.signup_method` when present (written at sign-up), else
 * defaults to `'guest'` for an anonymous session and is omitted otherwise —
 * an omitted key leaves any previously-set value untouched.
 */
export function derivePersonProperties(user: IdentityInput, plan: PlanUsuario): PersonProperties {
  const isGuest = user.is_anonymous === true;
  const metadataMethod = typeof user.user_metadata?.signup_method === 'string'
    ? user.user_metadata.signup_method
    : undefined;
  const signupMethod = metadataMethod ?? (isGuest ? 'guest' : undefined);

  return {
    is_guest: isGuest,
    plan: isGuest ? 'free' : plan,
    ...(signupMethod ? { signup_method: signupMethod } : {}),
  };
}
