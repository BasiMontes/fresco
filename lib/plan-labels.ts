import type { UserProfile } from '@schemas';

/**
 * Plan-tier label copy (FRESCO-84) — single source of truth shared by
 * `components/layout/sidebar-account.tsx` and `app/(app)/profile/page.tsx`,
 * which both render the same tier tag for the signed-in user. Previously
 * duplicated byte-for-byte in both files; extracted here so a future change
 * to the visual criteria only needs one edit.
 */
export const PLAN_LABELS: Record<UserProfile['plan'], string> = {
  free: 'Plan Free',
  pro: 'Plan Pro',
  family: 'Plan Family',
};

/**
 * Maps a plan tier to the `Tag` component's visual variant (FRESCO-84):
 * `free` reads as `neutral`, any paid tier (`pro`/`family`) reads as
 * `accent`. Same criteria previously duplicated in both consumers above.
 */
export function getPlanTagVariant(plan: UserProfile['plan']): 'neutral' | 'accent' {
  return plan === 'free' ? 'neutral' : 'accent';
}
